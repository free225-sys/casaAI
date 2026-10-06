"""Native PostgreSQL races: independent committed connections and exact-ID cleanup."""
from concurrent.futures import ThreadPoolExecutor
import os
from threading import Barrier, Event
from time import monotonic
import uuid

from fastapi import Depends, FastAPI
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.orm import Session

from app.api import discovery
from app.api.deps import _bearer_scheme, get_current_user
from app.core.security import create_access_token
from app.db.locks import transaction_lock
from app.db.session import engine, get_db
from app.models.catalog import School
from app.models.content import Course, Lesson
from app.models.enums import AccountStatus, ContentStatus, UserRole
from app.models.governance import AdminScope
from app.models.knowledge import KnowledgeNode, knowledge_node_used_in_lessons as links
from app.models.user import User
from app.schemas.discovery import LessonKnowledgeNodesReplacement
from app.services.discovery_service import association_state, replace_associations


@pytest.fixture
def committed_discovery():
    url = engine.url
    if not (url.host == "127.0.0.1" and url.port == 55432 and url.username == "casa_test"
            and url.database == "casa_discovery_v1_tests" == os.environ.get("CASA_TEST_DATABASE")):
        pytest.skip("Requires the explicitly isolated discovery test database")
    tag = uuid.uuid4().hex
    users = [uuid.uuid4() for _ in range(3)]
    sid, cid, lid = [prefix+tag for prefix in ("d-school-", "d-course-", "d-lesson-")]
    nodes = ["d-node-a-"+tag, "d-node-b-"+tag]
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(User)) == 0
        for uid, role in zip(users, (UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN)):
            db.add(User(id=uid, first_name="Synthetic", last_name="Race", email=f"{uid}@example.com",
                        password_hash="unused-fixture", role=role, status=AccountStatus.ACTIVE))
        db.add_all([School(id=value, name="Synthetic", short_name="SYN", color="#000000")
                    for value in (sid, sid+"-other")])
        db.add_all([KnowledgeNode(id=nid, title=nid, status=ContentStatus.PUBLISHED) for nid in nodes])
        db.flush()
        db.add_all([Course(id=cid, school_id=sid, title="Synthetic", status=ContentStatus.PUBLISHED),
                    Course(id=cid+"-other", school_id=sid+"-other", title="Other", status=ContentStatus.PUBLISHED)])
        db.add(AdminScope(user_id=users[0], school_id=sid, assigned_by=users[1]))
        db.flush()
        db.add(Lesson(id=lid, course_id=cid, title="Synthetic", status=ContentStatus.PUBLISHED))
        db.commit()
        initial = association_state(db, db.get(Lesson, lid)).model_dump()
    try:
        yield users, sid, cid, lid, nodes, initial
    finally:
        with Session(engine) as db:
            db.execute(delete(User).where(User.id.in_(users)))
            db.execute(delete(Lesson).where(Lesson.id == lid))
            db.execute(delete(Course).where(Course.id.in_((cid, cid+"-other"))))
            db.execute(delete(KnowledgeNode).where(KnowledgeNode.id.in_(nodes)))
            db.execute(delete(School).where(School.id.in_((sid, sid+"-other"))))
            db.commit()
            assert db.scalar(select(func.count()).select_from(User)) == 0


def test_concurrent_identical_or_divergent_replacements(committed_discovery):
    # Both variants use two connections, authenticated before either mutates.
    users, _, _, lid, nodes, initial = committed_discovery
    for identical in (True, False):
        with Session(engine) as db:
            db.execute(delete(links).where(links.c.lesson_id == lid))
            db.commit()
        app = FastAPI()
        app.include_router(discovery.router)
        barrier, pids = Barrier(2), set()
        def authenticated(credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme), db: Session = Depends(get_db)):
            actor = get_current_user(credentials, db)
            pids.add(db.scalar(select(func.pg_backend_pid())))
            barrier.wait(timeout=10)
            return actor
        app.dependency_overrides[get_current_user] = authenticated
        def replace(ids):
            with TestClient(app) as client:
                response = client.put(f"/api/admin/lessons/{lid}/knowledge-nodes",
                    headers={"Authorization": "Bearer "+create_access_token(users[0], "ADMIN")},
                    json={"node_ids": ids, "expected_revision": initial["revision"]})
                return response.status_code, response.json()
        desired = [[nodes[0]], [nodes[0]] if identical else [nodes[1]]]
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(replace, desired))
        assert len(pids) == 2
        assert sorted(code for code, _ in responses) == ([200, 200] if identical else [200, 409])
        with Session(engine) as db:
            current = association_state(db, db.get(Lesson, lid)).model_dump()
            successes = [body for code, body in responses if code == 200]
            assert all(body == current for body in successes)
            assert len(current["node_ids"]) == 1


@pytest.mark.parametrize("wait_lock,change", [(lock, change) for lock in ("scope", "actor")
                                            for change in ("suspend", "demote", "delete")]+[("scope", "grant"), ("scope", "parent")])
def test_revoke_while_authenticated_writer_waits(committed_discovery, change, wait_lock):
    users, _, cid, lid, nodes, initial = committed_discovery
    ready, pids = Event(), {}
    app = FastAPI()
    app.include_router(discovery.router)
    def authenticated(credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme), db: Session = Depends(get_db)):
        actor = get_current_user(credentials, db)
        pids["writer"] = db.scalar(select(func.pg_backend_pid()))
        ready.set()
        return actor
    app.dependency_overrides[get_current_user] = authenticated
    def replace():
        with TestClient(app) as client:
            return client.put(f"/api/admin/lessons/{lid}/knowledge-nodes",
                headers={"Authorization": "Bearer "+create_access_token(users[0], "ADMIN")},
                # Identical empty retry must still recheck permissions.
                json={"node_ids": [], "expected_revision": initial["revision"]})
    with Session(engine) as changer:
        pids["changer"] = changer.scalar(select(func.pg_backend_pid()))
        if wait_lock == "scope":
            transaction_lock(changer, "casa:content-scope-mutations")
        else:
            changer.scalar(select(User).where(User.id == users[0]).with_for_update())
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(replace)
            try:
                assert ready.wait(10)
                deadline, blocked = monotonic()+5, False
                with engine.connect() as observer:
                    while monotonic() < deadline and not future.done():
                        blocked = observer.scalar(text("SELECT wait_event_type FROM pg_stat_activity WHERE pid=:pid"),
                                                  {"pid": pids["writer"]}) == "Lock"
                        observer.commit()
                        if blocked:
                            break
                assert blocked, "Writer did not wait after authenticating the actor"
                if change == "delete":
                    changer.execute(delete(User).where(User.id == users[0]))
                elif change == "grant":
                    changer.execute(delete(AdminScope).where(AdminScope.user_id == users[0]))
                elif change == "parent":
                    changer.execute(update(Lesson).where(Lesson.id == lid).values(course_id=cid+"-other"))
                else:
                    value = {"status": AccountStatus.SUSPENDED} if change == "suspend" else {"role": UserRole.LEARNER}
                    changer.execute(update(User).where(User.id == users[0]).values(**value))
                changer.commit()
            finally:
                changer.rollback()
            response = future.result(timeout=10)
    assert len(set(pids.values())) == 2
    assert response.status_code == {"demote": 403, "grant": 404, "parent": 404}.get(change, 401), response.text
    with Session(engine) as db:
        assert association_state(db, db.get(Lesson, lid)).node_ids == []


def test_reference_delete_waits_until_writer_commits(committed_discovery):
    users, _, _, lid, nodes, initial = committed_discovery
    # Pause the writer after all its reference locks, before insert/commit.
    from sqlalchemy import event
    ready, release, started = Event(), Event(), Event()
    pids = {}
    def writer():
        with Session(engine) as db:
            connection = db.connection()
            pids["writer"] = db.scalar(select(func.pg_backend_pid()))
            def pause(conn, cursor, statement, parameters, context, executemany):
                if statement.lstrip().startswith("INSERT INTO knowledge_node_used_in_lessons"):
                    ready.set()
                    assert release.wait(10)
            event.listen(connection, "before_cursor_execute", pause)
            try:
                return replace_associations(db, db.get(User, users[0]), lid,
                    LessonKnowledgeNodesReplacement(node_ids=[nodes[0]], expected_revision=initial["revision"]))
            finally:
                event.remove(connection, "before_cursor_execute", pause)
    def deleter():
        with Session(engine) as db:
            pids["delete"] = db.scalar(select(func.pg_backend_pid()))
            started.set()
            db.execute(delete(KnowledgeNode).where(KnowledgeNode.id == nodes[0]))
            db.commit()
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(writer)
        try:
            assert ready.wait(10)
            second = pool.submit(deleter)
            assert started.wait(10)
            blocked, deadline = False, monotonic()+5
            with engine.connect() as observer:
                while monotonic() < deadline and not second.done():
                    blocked = observer.scalar(text("SELECT wait_event_type FROM pg_stat_activity WHERE pid=:pid"),
                                              {"pid": pids["delete"]}) == "Lock"
                    observer.commit()
                    if blocked:
                        break
            assert blocked
        finally:
            release.set()
        assert first.result(timeout=10).node_ids == [nodes[0]]
        second.result(timeout=10)
    assert len(set(pids.values())) == 2
    with Session(engine) as db:
        assert db.get(KnowledgeNode, nodes[0]) is None
        assert association_state(db, db.get(Lesson, lid)).node_ids == []
