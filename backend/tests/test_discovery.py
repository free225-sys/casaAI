"""Real PostgreSQL, metadata privacy, scope and explicit replacement semantics."""
import hashlib
import json
import uuid
from itertools import product

import pytest
from sqlalchemy import delete, event, select

from app.core.security import create_access_token
from app.models.catalog import School
from app.models.content import Course, Lesson, Pathway, pathway_courses
from app.models.enums import AccountStatus, ContentStatus, UserRole
from app.models.governance import AdminScope
from app.models.knowledge import KnowledgeNode, KnowledgeNodeApplication, knowledge_node_used_in_lessons as links
from app.models.user import User
from app.services.discovery_service import NOTION_IDS, SCENES


def auth(user):
    return {"Authorization": "Bearer " + create_access_token(user.id, user.role.value)}


@pytest.fixture
def discovery(db_session):
    users = {}
    for key, role in (("admin", UserRole.ADMIN), ("super", UserRole.SUPER_ADMIN), ("learner", UserRole.LEARNER)):
        user = User(first_name=key, last_name="Synthetic", email=f"{uuid.uuid4()}@example.com",
                    password_hash="unused-fixture", role=role, status=AccountStatus.ACTIVE)
        db_session.add(user)
        users[key] = user
    db_session.add_all([School(id=sid, name=sid, short_name=sid, color="#000000") for sid in ("discover-a", "discover-b")])
    db_session.add_all([Pathway(id=pid, title=pid, status=ContentStatus.DRAFT) for pid in ("discover-p1", "discover-p2")])
    db_session.flush()
    for cid, sid in (("discover-course", "discover-a"), ("discover-other", "discover-b"), ("discover-shared", "discover-b")):
        db_session.add(Course(id=cid, school_id=sid, title=cid, status=ContentStatus.PUBLISHED))
    for nid in NOTION_IDS:
        node = db_session.get(KnowledgeNode, nid)
        if node is None:
            db_session.add(KnowledgeNode(id=nid, title=nid, status=ContentStatus.PUBLISHED))
        else:
            node.status = ContentStatus.PUBLISHED
    db_session.flush()
    for lid, cid in (("discover-lesson", "discover-course"), ("discover-second", "discover-course"),
                     ("discover-other-lesson", "discover-other"), ("discover-shared-lesson", "discover-shared")):
        db_session.add(Lesson(id=lid, course_id=cid, title="PRIVATE_LESSON_TITLE", summary="PRIVATE_CONTENT",
                              status=ContentStatus.PUBLISHED))
    db_session.flush()
    db_session.execute(links.insert(), [{"node_id": "llm", "lesson_id": "discover-lesson"}])
    db_session.execute(pathway_courses.insert(), [
        {"pathway_id": "discover-p1", "course_id": "discover-shared", "position": 0},
        {"pathway_id": "discover-p2", "course_id": "discover-shared", "position": 0},
    ])
    db_session.commit()
    return users


def state(client, users, lesson="discover-lesson", role="super"):
    response = client.get(f"/api/admin/lessons/{lesson}/knowledge-nodes", headers=auth(users[role]))
    assert response.status_code == 200, response.text
    return response.json()


def put(client, users, ids, revision, lesson="discover-lesson", role="super"):
    return client.put(f"/api/admin/lessons/{lesson}/knowledge-nodes", headers=auth(users[role]),
                      json={"node_ids": ids, "expected_revision": revision})


def test_public_single_query_metadata_dedup_and_published_pathway_independence(client, db_session, discovery):
    db_session.execute(links.insert(), [{"node_id": "llm", "lesson_id": "discover-second"},
                                       {"node_id": "generation", "lesson_id": "discover-lesson"}])
    db_session.commit()
    statements = []
    connection = db_session.connection()
    def capture(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)
    event.listen(connection, "before_cursor_execute", capture)
    try:
        response = client.get("/api/discoveries/llm-answer/links")
    finally:
        event.remove(connection, "before_cursor_execute", capture)
    assert response.status_code == 200 and response.headers["Cache-Control"] == "no-store"
    assert len(statements) == 1
    body = response.json()
    assert body["registry_version"] == 1
    assert [row["scene_key"] for row in body["scenes"]] == [key for key, _ in SCENES]
    assert [row["id"] for row in body["notions"]] == list(NOTION_IDS)
    assert [row["id"] for row in body["courses"]] == ["discover-course"]
    for row in body["courses"]:
        assert set(row) == {"id", "title", "school_id", "level", "duration_min"}
    for row in body["notions"]:
        assert set(row) == {"id", "title"}
    assert all(len(row["course_ids"]) <= 1 for row in body["scenes"])
    assert "PRIVATE" not in response.text and "discover-lesson" not in response.text
    assert "email" not in response.text and "status" not in response.text


@pytest.mark.parametrize("node_status,lesson_status,course_status", list(product(ContentStatus, repeat=3)))
def test_three_publication_filters(client, db_session, discovery, node_status, lesson_status, course_status):
    db_session.get(KnowledgeNode, "llm").status = node_status
    db_session.get(Lesson, "discover-lesson").status = lesson_status
    db_session.get(Course, "discover-course").status = course_status
    db_session.commit()
    body = client.get("/api/discoveries/llm-answer/links").json()
    expected = all(value == ContentStatus.PUBLISHED for value in (node_status, lesson_status, course_status))
    assert bool(body["courses"]) == expected
    assert ("llm" in body["scenes"][0]["notion_ids"]) == (node_status == ContentStatus.PUBLISHED)


def test_known_empty_unknown_and_unassociated_notions(client, db_session, discovery):
    db_session.execute(delete(links).where(links.c.lesson_id == "discover-lesson"))
    db_session.commit()
    body = client.get("/api/discoveries/llm-answer/links").json()
    assert len(body["notions"]) == 8 and body["courses"] == []
    assert all(scene["course_ids"] == [] for scene in body["scenes"])
    for nid in NOTION_IDS:
        db_session.get(KnowledgeNode, nid).status = ContentStatus.ARCHIVED
    db_session.commit()
    empty = client.get("/api/discoveries/llm-answer/links").json()
    assert len(empty["scenes"]) == 6 and empty["notions"] == empty["courses"] == []
    unknown = client.get("/api/discoveries/not-real/links")
    assert unknown.status_code == 404 and unknown.json()["detail"] == "Découverte introuvable."


def test_backend_failure_is_not_an_empty_success(client, monkeypatch):
    from fastapi.testclient import TestClient
    from app.services import discovery_service
    def failed(*args):
        raise RuntimeError("Synthetic unavailable database")
    monkeypatch.setattr(discovery_service, "public_links", failed)
    with TestClient(client.app, raise_server_exceptions=False) as failing_client:
        response = failing_client.get("/api/discoveries/llm-answer/links")
        assert response.status_code == 500
        assert response.headers.get("Cache-Control") == "no-store"
        assert response.text == "Internal Server Error"
        assert "Synthetic" not in response.text
    with TestClient(client.app) as raising_client:
        with pytest.raises(RuntimeError, match="Synthetic unavailable database"):
            raising_client.get("/api/discoveries/llm-answer/links")


def test_no_store_failure_handling_does_not_change_other_routes(client, monkeypatch):
    from fastapi.testclient import TestClient
    from app.repositories.content_repository import ContentRepository
    def failed(*args, **kwargs):
        raise RuntimeError("Synthetic unrelated catalogue failure")
    monkeypatch.setattr(ContentRepository, "list_courses", failed)
    with TestClient(client.app, raise_server_exceptions=False) as failing_client:
        response = failing_client.get("/api/courses")
        assert response.status_code == 500
        assert "Cache-Control" not in response.headers


def test_discovery_wrong_method_keeps_405_and_no_store(client):
    response = client.post("/api/discoveries/llm-answer/links")
    assert response.status_code == 405
    assert response.headers.get("Cache-Control") == "no-store"
    assert "GET" in response.headers["Allow"]


def test_reference_auth_pagination_exact_metadata_and_nonpublic_nodes(client, db_session, discovery):
    assert client.get("/api/admin/knowledge-nodes").status_code == 401
    assert client.get("/api/admin/knowledge-nodes", headers=auth(discovery["learner"])).status_code == 403
    db_session.get(KnowledgeNode, "llm").status = ContentStatus.DRAFT
    db_session.get(KnowledgeNode, "generation").status = ContentStatus.ARCHIVED
    db_session.commit()
    pages = [client.get(f"/api/admin/knowledge-nodes?limit=3&offset={offset}", headers=auth(discovery["admin"])).json()
             for offset in (0, 3, 6)]
    assert all(page["total"] == 8 for page in pages)
    items = [item for page in pages for item in page["items"]]
    assert len({item["id"] for item in items}) == 8
    assert all(set(item) == {"id", "title", "status"} for item in items)
    assert {item["status"] for item in items} == {"PUBLISHED", "DRAFT", "ARCHIVED"}
    for query in ("limit=0", "limit=101", "offset=-1"):
        assert client.get("/api/admin/knowledge-nodes?"+query, headers=auth(discovery["super"])).status_code == 422


def test_scope_no_grant_school_and_shared_pathways(client, db_session, discovery):
    admin = discovery["admin"]
    path = "/api/admin/lessons/discover-lesson/knowledge-nodes"
    assert client.get(path, headers=auth(admin)).status_code == 404
    db_session.add(AdminScope(user_id=admin.id, school_id="discover-a", assigned_by=discovery["super"].id))
    db_session.add(AdminScope(user_id=admin.id, pathway_id="discover-p1", assigned_by=discovery["super"].id))
    db_session.commit()
    current = state(client, discovery, role="admin")
    assert put(client, discovery, ["generation"], current["revision"], role="admin").status_code == 200
    assert client.get("/api/admin/lessons/discover-other-lesson/knowledge-nodes", headers=auth(admin)).status_code == 404
    shared = state(client, discovery, "discover-shared-lesson", "admin")
    assert put(client, discovery, [], shared["revision"], "discover-shared-lesson", "admin").status_code == 409
    db_session.add(AdminScope(user_id=admin.id, pathway_id="discover-p2", assigned_by=discovery["super"].id))
    db_session.commit()
    assert put(client, discovery, ["llm"], shared["revision"], "discover-shared-lesson", "admin").status_code == 200
    assert client.get("/api/admin/lessons/missing/knowledge-nodes", headers=auth(discovery["super"])).status_code == 404


def test_replace_revision_retry_conflict_clear_and_old_put_preserves(client, db_session, discovery):
    initial = state(client, discovery)
    canonical = json.dumps({"lesson_id": "discover-lesson", "course_id": "discover-course", "node_ids": ["llm"]},
                           sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    assert initial["revision"] == hashlib.sha256(canonical).hexdigest()
    db_session.get(KnowledgeNode, "generation").status = ContentStatus.DRAFT
    db_session.commit()
    result = put(client, discovery, ["llm", "generation"], initial["revision"])
    assert result.status_code == 200 and result.json()["node_ids"] == ["generation", "llm"]
    assert put(client, discovery, ["generation", "llm"], initial["revision"]).json() == result.json()
    assert put(client, discovery, ["llm"], initial["revision"]).status_code == 409
    old = client.put("/api/admin/lessons/discover-lesson", headers=auth(discovery["super"]),
                     json={"course_id": "discover-course", "title": "Updated", "status": "DRAFT"})
    assert old.status_code == 200, old.text
    assert state(client, discovery) == result.json()
    assert db_session.get(KnowledgeNode, "generation").status == ContentStatus.DRAFT
    assert put(client, discovery, [], result.json()["revision"]).json()["node_ids"] == []
    assert db_session.get(Lesson, "discover-lesson").status == ContentStatus.DRAFT


@pytest.mark.parametrize("payload", [
    {}, {"expected_revision": "0"*64}, {"node_ids": []}, {"node_ids": ["llm", "llm"], "expected_revision": "0"*64},
    {"node_ids": [""], "expected_revision": "0"*64}, {"node_ids": [" llm"], "expected_revision": "0"*64},
    {"node_ids": ["llm\x00"], "expected_revision": "0"*64}, {"node_ids": ["x"*201], "expected_revision": "0"*64},
    {"node_ids": [str(i) for i in range(101)], "expected_revision": "0"*64},
    {"node_ids": [1], "expected_revision": "0"*64}, {"node_ids": [], "expected_revision": "bad"},
    {"node_ids": [], "expected_revision": "A"*64}, {"node_ids": [], "expected_revision": "0"*64, "extra": 1},
])
def test_invalid_payload_never_removes_links(client, discovery, payload):
    initial = state(client, discovery)
    response = client.put("/api/admin/lessons/discover-lesson/knowledge-nodes", headers=auth(discovery["super"]), json=payload)
    assert response.status_code == 422
    assert state(client, discovery) == initial


def test_unknown_reference_atomic_and_no_effect_on_other_lesson(client, db_session, discovery):
    initial = state(client, discovery)
    db_session.execute(links.insert(), [{"node_id": "llm", "lesson_id": "discover-second"}])
    db_session.commit()
    response = put(client, discovery, ["generation", "missing"], initial["revision"])
    assert response.status_code == 422 and response.json()["detail"] == "Notion introuvable."
    assert state(client, discovery) == initial
    assert put(client, discovery, [], initial["revision"]).status_code == 200
    assert state(client, discovery, "discover-second")["node_ids"] == ["llm"]
    assert client.get("/api/discoveries/llm-answer/links").json()["courses"][0]["id"] == "discover-course"


def test_retry_after_grant_revocation_cannot_succeed(client, db_session, discovery):
    admin = discovery["admin"]
    db_session.add(AdminScope(user_id=admin.id, school_id="discover-a", assigned_by=discovery["super"].id))
    db_session.commit()
    current = state(client, discovery, role="admin")
    db_session.execute(delete(AdminScope).where(AdminScope.user_id == admin.id))
    db_session.commit()
    assert put(client, discovery, current["node_ids"], current["revision"], role="admin").status_code == 404


@pytest.mark.parametrize("method", ["get", "put"])
def test_lesson_associations_require_active_content_admin(client, db_session, discovery, method):
    path = "/api/admin/lessons/discover-lesson/knowledge-nodes"
    kwargs = {"json": {"node_ids": [], "expected_revision": "0"*64}} if method == "put" else {}
    assert getattr(client, method)(path, **kwargs).status_code == 401
    assert getattr(client, method)(path, headers=auth(discovery["learner"]), **kwargs).status_code == 403
    discovery["super"].status = AccountStatus.SUSPENDED
    db_session.commit()
    assert getattr(client, method)(path, headers=auth(discovery["super"]), **kwargs).status_code == 401


def test_public_course_order_title_then_id_and_published_unlinked_lesson_is_not_enough(client, db_session, discovery):
    db_session.get(Course, "discover-course").title = "Same title"
    db_session.get(Course, "discover-other").title = "Same title"
    db_session.get(Lesson, "discover-lesson").status = ContentStatus.DRAFT
    db_session.commit()
    # discover-second is published, but not linked to this notion.
    assert client.get("/api/discoveries/llm-answer/links").json()["courses"] == []
    db_session.get(Lesson, "discover-lesson").status = ContentStatus.PUBLISHED
    db_session.execute(links.insert(), [{"node_id": "llm", "lesson_id": "discover-other-lesson"}])
    db_session.commit()
    body = client.get("/api/discoveries/llm-answer/links").json()
    expected = ["discover-course", "discover-other"]
    assert [course["id"] for course in body["courses"]] == expected
    assert body["scenes"][0]["course_ids"] == expected


def test_repeatable_reference_bootstrap_preserves_editorial_choices_and_removed_links(db_session, discovery):
    from scripts.seed import seed_knowledge_graph
    node = db_session.get(KnowledgeNode, "llm")
    node.status, node.title, node.formula = ContentStatus.ARCHIVED, "Editorial title", "Editorial formula"
    db_session.add(KnowledgeNodeApplication(node_id="llm", label="Editorial application"))
    db_session.execute(delete(links).where(links.c.lesson_id == "discover-lesson"))
    db_session.commit()
    data = {"knowledgeGraph": [
        {"id": "llm", "title": "Historical", "applications": ["Historical"], "usedIn": ["discover-lesson"]},
        {"id": "synthetic-new-reference", "title": "New", "applications": ["Fresh"], "usedIn": ["discover-lesson"]},
    ]}
    for _ in range(2):
        seed_knowledge_graph(db_session, data)
        db_session.commit()
    db_session.refresh(node)
    assert (node.status, node.title, node.formula) == (ContentStatus.ARCHIVED, "Editorial title", "Editorial formula")
    assert list(db_session.scalars(select(KnowledgeNodeApplication.label).where(KnowledgeNodeApplication.node_id == "llm"))) == ["Editorial application"]
    assert list(db_session.execute(select(links).where(links.c.lesson_id == "discover-lesson"))) == []
    assert list(db_session.scalars(select(KnowledgeNodeApplication.label).where(KnowledgeNodeApplication.node_id == "synthetic-new-reference"))) == ["Fresh"]
