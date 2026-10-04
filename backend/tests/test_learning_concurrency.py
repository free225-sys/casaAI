"""Independent committed transactions on the explicit disposable PR1 database."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import uuid

from fastapi import Depends, FastAPI
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
import os
import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api import admin_users, progress
from app.api.deps import _bearer_scheme, get_current_user
from app.core.security import create_access_token
from app.db.session import engine, get_db
from app.models.badge import UserBadge
from app.models.catalog import School
from app.models.content import Course, Lesson
from app.models.enums import AccountStatus, ContentStatus, UserRole
from app.models.notification import Notification
from app.models.progress import UserLessonProgress
from app.models.user import User


@pytest.fixture(autouse=True)
def disposable_only():
    url = engine.url
    if not (url.host == "127.0.0.1" and url.port == 55432 and url.database == os.environ.get("CASA_TEST_DATABASE", "casa_pr1_test") and url.username == "casa_test"):
        pytest.skip("Concurrency tests require the explicit disposable CASA PR1 database")


@pytest.fixture
def committed():
    tag = uuid.uuid4().hex
    ids = [uuid.uuid4() for _ in range(3)]
    school_id, course_id, lesson_id = (f"race-{kind}-{tag}" for kind in ("school", "course", "lesson"))
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(User)) == 0
        for i, id in enumerate(ids):
            db.add(User(id=id, first_name="Race", last_name="Synthetic", email=f"race-{i}-{tag}@example.com",
                        password_hash="unused-synthetic-hash", status=AccountStatus.ACTIVE,
                        role=UserRole.SUPER_ADMIN if i < 2 else UserRole.LEARNER))
        db.add(School(id=school_id, name="Synthetic", short_name="RACE", color="#000000"))
        db.flush()
        db.add(Course(id=course_id, school_id=school_id, title="Synthetic", status=ContentStatus.PUBLISHED))
        db.flush()
        db.add(Lesson(id=lesson_id, course_id=course_id, title="Synthetic", position=1, status=ContentStatus.PUBLISHED))
        db.commit()
    try:
        yield ids, lesson_id
    finally:
        # Only exact IDs created by this fixture; no reset/truncate/drop.
        with Session(engine) as db:
            db.execute(delete(User).where(User.id.in_(ids)))
            db.execute(delete(Course).where(Course.id == course_id))
            db.execute(delete(School).where(School.id == school_id))
            db.commit()
            assert db.scalar(select(func.count()).select_from(User)) == 0


def concurrent_requests(requests):
    app = FastAPI()
    app.include_router(admin_users.router)
    app.include_router(progress.router)
    ready = Barrier(2)
    backend_pids = set()

    def authenticated_together(
        credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
        db: Session = Depends(get_db),
    ):
        # Real JWT validation and independent SQL user reads before both act.
        user = get_current_user(credentials, db)
        backend_pids.add(db.scalar(select(func.pg_backend_pid())))
        ready.wait(timeout=10)
        return user

    app.dependency_overrides[get_current_user] = authenticated_together

    def run(request):
        method, path, user_id, role, payload = request
        with TestClient(app) as client:
            return client.request(method, path,
                headers={"Authorization": f"Bearer {create_access_token(user_id, role.value)}"},
                **({"json": payload} if payload is not None else {})).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(run, requests))
    assert len(backend_pids) == 2, "Requests must use independent PostgreSQL connections"
    return statuses


@pytest.mark.parametrize("action", ["demote", "suspend", "delete"])
def test_concurrent_authorized_admins_preserve_one_active_super(committed, action):
    ids, _ = committed
    payload = {"role": "LEARNER"} if action == "demote" else {"status": "SUSPENDED"}
    method = "DELETE" if action == "delete" else "PATCH"
    statuses = concurrent_requests([
        (method, f"/api/admin/users/{ids[1]}", ids[0], UserRole.SUPER_ADMIN, None if action == "delete" else payload),
        (method, f"/api/admin/users/{ids[0]}", ids[1], UserRole.SUPER_ADMIN, None if action == "delete" else payload),
    ])
    with Session(engine) as db:
        remaining = db.scalar(select(func.count()).select_from(User).where(User.role == UserRole.SUPER_ADMIN, User.status == AccountStatus.ACTIVE))
    assert remaining == 1, (action, statuses, remaining)
    assert sorted(statuses) == ([204, 409] if action == "delete" else [200, 409])


@pytest.mark.parametrize("endpoint", ["start", "complete", "badges"])
def test_concurrent_learning_repeats_succeed_without_duplicates(committed, endpoint):
    ids, lesson_id = committed
    if endpoint == "badges":
        with Session(engine) as db:
            from app.services.progress_service import ProgressService
            ProgressService(db).complete_lesson(ids[2], lesson_id)
        method, path = "GET", "/api/me/badges"
    else:
        method, path = "POST", f"/api/lessons/{lesson_id}/{endpoint}"
    statuses = concurrent_requests([(method, path, ids[2], UserRole.LEARNER, None)] * 2)
    assert statuses == [200, 200]
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(UserLessonProgress).where(UserLessonProgress.user_id == ids[2])) == 1
        if endpoint == "badges":
            assert db.scalar(select(func.count()).select_from(UserBadge).where(UserBadge.user_id == ids[2])) == 1
            assert db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == ids[2])) == 1
