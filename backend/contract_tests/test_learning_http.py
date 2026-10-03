"""Execute real routers/services with substituted persistence, not a live DB."""
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock
import uuid

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from sqlalchemy.orm import Session

from app.api import admin_content, admin_users, notifications, progress
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.enums import AccountStatus, ContentStatus, UserRole
from app.repositories.progress_repository import ProgressRepository
from app.repositories.document_structure_repository import DocumentStructureRepository

NOW = datetime.now(timezone.utc)
REAL_NEXT_LESSON_ID = ProgressRepository.next_lesson_id


def user(role=UserRole.LEARNER):
    return SimpleNamespace(id=uuid.uuid4(), first_name="Synthetic", last_name="Test",
                           email="test@example.invalid", role=role,
                           status=AccountStatus.ACTIVE, created_at=NOW, last_login_at=None)


@pytest.fixture
def http(monkeypatch):
    db = Mock(spec=Session)
    actor = user()
    app = FastAPI()
    for router in (progress.router, notifications.router, admin_users.router, admin_content.router):
        app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: actor
    # Real ProgressService + real mutation methods; only lesson lookup is substituted.
    stored = {}
    db.get.side_effect = lambda model, key: stored.get((model, key))

    def add(row):
        stored[type(row), (row.user_id, row.lesson_id)] = row

    db.add.side_effect = add
    lesson = SimpleNamespace(id="lesson", course_id="course", title="Synthetic lesson", level=None,
        duration_min=None, summary=None, example=None, position=1, skill_id=None, demo_id=None,
        objectives=[], sections=[], depth_levels=[])
    monkeypatch.setattr(ProgressRepository, "get_lesson_detail", lambda self, id: None if id == "missing" else lesson)
    monkeypatch.setattr(ProgressRepository, "get_validation_quiz_id", lambda self, id: None)
    monkeypatch.setattr(DocumentStructureRepository, "get_document_for_lesson", lambda self, id: None)
    monkeypatch.setattr(ProgressRepository, "next_lesson_id", lambda self, id: "next-published")
    with TestClient(app) as client:
        yield client, db, actor, app, stored


def test_start_progress_complete_repetitions_and_user_isolation(http):
    client, db, actor, _, stored = http
    first_user = actor.id
    for _ in range(2):
        response = client.post("/api/lessons/lesson/start")
        assert response.status_code == 200
        assert response.json()["status"] == "IN_PROGRESS"
    assert len(stored) == 1
    for pct in (0, 37, 100):
        response = client.patch("/api/lessons/lesson/progress", json={"progress_pct": pct})
        assert response.status_code == 200
        assert response.json()["progress_pct"] == min(pct, 99)
    for _ in range(2):
        response = client.post("/api/lessons/lesson/complete")
        assert response.status_code == 200
        assert response.json()["status"] == "COMPLETED"
        assert response.json()["progress_pct"] == 100
        assert response.json()["next_lesson_id"] == "next-published"
    assert client.post("/api/lessons/lesson/start").json()["status"] == "COMPLETED"
    assert client.patch("/api/lessons/lesson/progress", json={"progress_pct": 20}).json()["progress_pct"] == 100
    actor.id = uuid.uuid4()
    assert client.post("/api/lessons/lesson/start").json()["progress_pct"] == 0
    assert len(stored) == 2
    assert {key[1][0] for key in stored} == {first_user, actor.id}
    assert db.commit.call_count > 0


def test_lesson_detail_serializes_real_response_schema(http):
    client, *_ = http
    response = client.get("/api/lessons/lesson")
    assert response.status_code == 200
    assert response.json()["title"] == "Synthetic lesson"
    assert response.json()["has_document"] is False
    assert response.json()["sections"] == []


@pytest.mark.parametrize("pct", [-1, 101, "bad", 0.5, None])
def test_progress_invalid_bounds_rejected_before_write(http, pct):
    client, db, *_ = http
    assert client.patch("/api/lessons/lesson/progress", json={"progress_pct": pct}).status_code == 422
    db.commit.assert_not_called()


@pytest.mark.parametrize("method,suffix", [("post", "start"), ("patch", "progress"), ("post", "complete")])
def test_missing_or_unpublished_lesson_is_404_without_write(http, method, suffix):
    client, db, *_ = http
    kwargs = {"json": {"progress_pct": 12}} if method == "patch" else {}
    assert getattr(client, method)(f"/api/lessons/missing/{suffix}", **kwargs).status_code == 404
    db.commit.assert_not_called()


@pytest.mark.parametrize("role,users_status,courses_status", [
    (UserRole.LEARNER, 403, 403), (UserRole.ADMIN, 403, 200), (UserRole.SUPER_ADMIN, 200, 200),
])
def test_admin_role_boundaries(http, monkeypatch, role, users_status, courses_status):
    client, db, actor, *_ = http
    actor.role = role
    monkeypatch.setattr(admin_users.UserRepository, "list_all", lambda self, **kwargs: ([], 0))
    monkeypatch.setattr(admin_content.AdminContentRepository, "list_courses_any_status", lambda self, **kwargs: ([], 0))
    assert client.get("/api/admin/users").status_code == users_status
    assert client.get("/api/admin/courses").status_code == courses_status


@pytest.mark.parametrize("method,payload", [("patch", {"role": "LEARNER"}), ("patch", {"status": "SUSPENDED"}), ("delete", None)])
def test_self_modification_stays_400(http, method, payload):
    client, db, actor, *_ = http
    actor.role = UserRole.SUPER_ADMIN
    db.get.side_effect = lambda model, key: actor
    kwargs = {"json": payload} if payload else {}
    assert getattr(client, method)(f"/api/admin/users/{actor.id}", **kwargs).status_code == 400
    db.commit.assert_not_called()


@pytest.mark.parametrize("method,payload", [("patch", {"role": "LEARNER"}), ("patch", {"status": "SUSPENDED"}), ("delete", None)])
def test_last_active_super_admin_is_409(http, monkeypatch, method, payload):
    client, db, actor, *_ = http
    actor.role = UserRole.SUPER_ADMIN
    target = user(UserRole.SUPER_ADMIN)
    db.get.side_effect = lambda model, key: target
    monkeypatch.setattr(admin_users.UserRepository, "count_active_super_admins", lambda self: 1)
    kwargs = {"json": payload} if payload else {}
    assert getattr(client, method)(f"/api/admin/users/{target.id}", **kwargs).status_code == 409
    db.commit.assert_not_called()


def test_badge_ack_settings_are_scoped_to_authenticated_user(http, monkeypatch):
    client, db, actor, *_ = http
    service = Mock()
    service.list_for_user.return_value = []
    service.get_settings.return_value = True
    service.set_settings.return_value = False
    monkeypatch.setattr(progress, "BadgeService", lambda db: service)
    assert client.get("/api/me/badges").json() == []
    assert client.post("/api/me/badges/ack").json() == {"ok": True}
    assert client.get("/api/me/notification-settings").json() == {"notify_badges": True}
    assert client.patch("/api/me/notification-settings", json={"notify_badges": False}).json() == {"notify_badges": False}
    service.list_for_user.assert_called_once_with(actor.id)
    service.acknowledge.assert_called_once_with(actor.id)
    service.get_settings.assert_called_once_with(actor.id)
    service.set_settings.assert_called_once_with(actor.id, False)


def test_notifications_query_uses_current_user_and_limit(http):
    client, db, actor, *_ = http
    db.execute.return_value.scalars.return_value = []
    assert client.get("/api/me/notifications").json() == []
    query = db.execute.call_args.args[0].compile()
    assert actor.id in query.params.values()
    assert 30 in query.params.values()
    assert "notifications.user_id =" in str(query)


def test_next_lesson_query_filters_same_course_published_and_position(http):
    _, db, *_ = http
    db.get.side_effect = lambda model, key: SimpleNamespace(course_id="same-course", position=3)
    db.execute.return_value.scalar_one_or_none.return_value = "next"
    assert REAL_NEXT_LESSON_ID(ProgressRepository(db), "lesson") == "next"
    query = db.execute.call_args.args[0].compile()
    assert "same-course" in query.params.values()
    assert ContentStatus.PUBLISHED in query.params.values()
    assert 3 in query.params.values()
    assert "ORDER BY lessons.position" in str(query)


def test_routes_reject_missing_bearer_without_touching_db(http):
    client, db, _, app, _ = http
    app.dependency_overrides.pop(get_current_user)
    assert client.post("/api/lessons/lesson/start").status_code in (401, 403)
    db.get.assert_not_called()
