"""Learning APIs against migrated PostgreSQL and real transactional fixtures.

Never seeds a live project. Run only with an explicitly selected disposable DB.
"""
import pytest
from sqlalchemy import func, select, text

from app.core.security import create_access_token
from app.db.session import engine
from app.models.badge import UserBadge
from app.models.catalog import School
from app.models.content import Course, Lesson
from app.models.enums import AccountStatus, ContentStatus, UserRole
from app.models.notification import Notification
from app.models.progress import UserLessonProgress
from app.models.user import User
from app.schemas.admin import AdminUserUpdateRequest
from app.services.admin_user_service import AdminUserService, LastSuperAdminError


@pytest.fixture(autouse=True)
def require_disposable_database():
    url = engine.url
    if not (url.host == "127.0.0.1" and url.port == 55432 and url.database == "casa_pr1_test" and url.username == "casa_test"):
        pytest.skip("Native learning tests require the explicitly selected disposable CASA PR1 database")


@pytest.fixture
def learning(db_session):
    users = {}
    for name, role in (("learner", UserRole.LEARNER), ("other", UserRole.LEARNER),
                       ("admin", UserRole.ADMIN), ("super", UserRole.SUPER_ADMIN)):
        user = User(first_name=name, last_name="Synthetic", email=f"{name}-native@example.com",
                    password_hash="unused-synthetic-hash", role=role, status=AccountStatus.ACTIVE)
        db_session.add(user)
        users[name] = user
    db_session.add(School(id="native-school", name="Synthetic school", short_name="NAT", color="#000000"))
    db_session.flush()
    db_session.add_all([
        Course(id="native-course", school_id="native-school", title="Synthetic course", status=ContentStatus.PUBLISHED),
        Course(id="other-course", school_id="native-school", title="Other course", status=ContentStatus.PUBLISHED),
    ])
    db_session.flush()
    db_session.add_all([
        Lesson(id="native-first", course_id="native-course", title="First", position=1, status=ContentStatus.PUBLISHED),
        Lesson(id="native-draft", course_id="native-course", title="Draft", position=2, status=ContentStatus.DRAFT),
        Lesson(id="native-next", course_id="native-course", title="Next", position=3, status=ContentStatus.PUBLISHED),
        Lesson(id="other-lesson", course_id="other-course", title="Other", position=2, status=ContentStatus.PUBLISHED),
    ])
    db_session.commit()
    return users


def headers(user):
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role.value)}"}


def count(db, model, user):
    return db.scalar(select(func.count()).select_from(model).where(model.user_id == user.id))


def test_native_migration_head_and_required_schema(db_session):
    assert db_session.scalar(text("SELECT version_num FROM alembic_version")) == "0010"
    assert db_session.scalar(text("SELECT extversion FROM pg_extension WHERE extname='vector'"))
    assert db_session.scalar(text("SELECT count(*) FROM pg_enum JOIN pg_type ON pg_type.oid=pg_enum.enumtypid WHERE typname='user_role' AND enumlabel='SUPER_ADMIN'")) == 1
    assert db_session.scalar(text("SELECT count(*) FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='notify_badges'")) == 1


def test_native_progress_repeats_next_published_and_user_isolation(client, db_session, learning):
    learner, other = learning["learner"], learning["other"]
    auth = headers(learner)
    assert client.get("/api/lessons/native-first", headers=auth).status_code == 200
    for _ in range(2):
        response = client.post("/api/lessons/native-first/start", headers=auth)
        assert response.status_code == 200
        assert response.json()["progress_pct"] == 0
    assert count(db_session, UserLessonProgress, learner) == 1
    assert client.patch("/api/lessons/native-first/progress", headers=auth, json={"progress_pct": 42}).json()["progress_pct"] == 42
    assert client.patch("/api/lessons/native-first/progress", headers=auth, json={"progress_pct": 100}).json()["progress_pct"] == 99
    for _ in range(2):
        response = client.post("/api/lessons/native-first/complete", headers=auth)
        assert response.status_code == 200
        assert response.json()["next_lesson_id"] == "native-next"
        assert response.json()["progress_pct"] == 100
    assert count(db_session, UserLessonProgress, learner) == 1
    assert client.patch("/api/lessons/native-first/progress", headers=auth, json={"progress_pct": 1}).json()["progress_pct"] == 100
    assert client.get("/api/me/progress", headers=headers(other)).json() == []
    assert client.post("/api/lessons/native-first/start", headers=headers(other)).json()["progress_pct"] == 0
    assert count(db_session, UserLessonProgress, other) == 1


@pytest.mark.parametrize("pct", [-1, 101])
def test_native_progress_bounds_no_write(client, db_session, learning, pct):
    learner = learning["learner"]
    assert client.patch("/api/lessons/native-first/progress", headers=headers(learner), json={"progress_pct": pct}).status_code == 422
    assert count(db_session, UserLessonProgress, learner) == 0


@pytest.mark.parametrize("method,suffix", [("post", "start"), ("patch", "progress"), ("post", "complete")])
def test_native_draft_lesson_rejected_without_progress(client, db_session, learning, method, suffix):
    learner = learning["learner"]
    kwargs = {"json": {"progress_pct": 10}} if method == "patch" else {}
    assert getattr(client, method)(f"/api/lessons/native-draft/{suffix}", headers=headers(learner), **kwargs).status_code == 404
    assert count(db_session, UserLessonProgress, learner) == 0


def test_native_badges_notifications_repeated_read_ack_and_isolation(client, db_session, learning):
    learner, other = learning["learner"], learning["other"]
    auth = headers(learner)
    client.post("/api/lessons/native-first/complete", headers=auth)
    assert count(db_session, UserBadge, learner) == 0  # GET badges performs attribution
    for _ in range(3):
        response = client.get("/api/me/badges", headers=auth)
        assert response.status_code == 200
        assert [row["id"] for row in response.json() if row["new"]] == ["first_step"]
    assert count(db_session, UserBadge, learner) == 1
    assert count(db_session, Notification, learner) == 1
    notes = client.get("/api/me/notifications", headers=auth)
    assert notes.status_code == 200 and notes.json()[0]["type"] == "BADGE_EARNED"
    assert client.get("/api/me/notifications", headers=headers(other)).json() == []
    client.post("/api/me/badges/ack", headers=headers(other))
    assert client.get("/api/me/notifications", headers=auth).json()[0]["read"] is False
    assert client.post("/api/me/badges/ack", headers=auth).json() == {"ok": True}
    assert not any(row["new"] for row in client.get("/api/me/badges", headers=auth).json())
    assert client.get("/api/me/notifications", headers=auth).json()[0]["read"] is True


def test_native_notification_opt_out_persists_and_suppresses_new_alerts(client, db_session, learning):
    learner = learning["learner"]
    auth = headers(learner)
    assert client.get("/api/me/notification-settings", headers=auth).json() == {"notify_badges": True}
    assert client.patch("/api/me/notification-settings", headers=auth, json={"notify_badges": False}).json() == {"notify_badges": False}
    assert client.get("/api/me/notification-settings", headers=auth).json() == {"notify_badges": False}
    client.post("/api/lessons/native-first/complete", headers=auth)
    result = client.get("/api/me/badges", headers=auth)
    assert result.status_code == 200
    assert any(row["id"] == "first_step" and row["earned"] for row in result.json())
    assert not any(row["new"] for row in result.json())
    assert count(db_session, Notification, learner) == 0


@pytest.mark.parametrize("name,users_status,courses_status", [("learner", 403, 403), ("admin", 403, 200), ("super", 200, 200)])
def test_native_admin_role_boundaries(client, learning, name, users_status, courses_status):
    auth = headers(learning[name])
    assert client.get("/api/admin/users", headers=auth).status_code == users_status
    assert client.get("/api/admin/courses", headers=auth).status_code == courses_status


def test_native_admin_self_guards_are_400_and_leave_last_super_active(client, db_session, learning):
    admin = learning["super"]
    auth = headers(admin)
    assert client.delete(f"/api/admin/users/{admin.id}", headers=auth).status_code == 400
    for payload in ({"role": "LEARNER"}, {"status": "SUSPENDED"}):
        assert client.patch(f"/api/admin/users/{admin.id}", headers=auth, json=payload).status_code == 400
    db_session.refresh(admin)
    assert admin.role == UserRole.SUPER_ADMIN and admin.status == AccountStatus.ACTIVE


def test_native_last_super_guard_at_service_boundary_uses_real_sql(db_session, learning):
    # Direct service call to exercise the invariant. This is not an authenticated
    # HTTP 409 scenario: another active SUPER_ADMIN would make the count >= 2.
    active_supers = db_session.scalar(select(func.count()).select_from(User).where(User.role == UserRole.SUPER_ADMIN, User.status == AccountStatus.ACTIVE))
    if active_supers != 1:
        pytest.skip("Last-super invariant requires one active super; existing QA accounts preserved")
    service = AdminUserService(db_session)
    target, actor = learning["super"], learning["learner"]
    for payload in (AdminUserUpdateRequest(role=UserRole.LEARNER), AdminUserUpdateRequest(status=AccountStatus.SUSPENDED)):
        with pytest.raises(LastSuperAdminError):
            service.update_user(actor=actor, target_id=target.id, payload=payload)
    with pytest.raises(LastSuperAdminError):
        service.delete_user(actor=actor, target_id=target.id)
    db_session.refresh(target)
    assert target.role == UserRole.SUPER_ADMIN and target.status == AccountStatus.ACTIVE



def test_unpublished_lesson_retains_history_and_earned_badge(client, db_session, learning):
    learner = learning["learner"]
    auth = headers(learner)
    assert client.post("/api/lessons/native-first/complete", headers=auth).status_code == 200
    assert any(row["id"] == "first_step" and row["earned"] for row in client.get("/api/me/badges", headers=auth).json())
    lesson = db_session.get(Lesson, "native-first")
    lesson.status = ContentStatus.DRAFT
    db_session.commit()
    history = client.get("/api/me/progress", headers=auth)
    assert history.status_code == 200
    row = next(row for row in history.json() if row["lesson_id"] == "native-first")
    assert row["is_available"] is False
    assert row["status"] == "COMPLETED"
    assert row["progress_pct"] == 100
    assert client.get("/api/lessons/native-first", headers=auth).status_code == 404
    badges = client.get("/api/me/badges", headers=auth).json()
    assert any(row["id"] == "first_step" and row["earned"] for row in badges)
    assert count(db_session, UserBadge, learner) == 1


def test_progress_late_lower_write_keeps_acquired_percentage(client, learning):
    auth = headers(learning["learner"])
    for pct in (80, 35, 10, 80):
        response = client.patch("/api/lessons/native-first/progress", headers=auth, json={"progress_pct": pct})
        assert response.status_code == 200
        assert response.json()["progress_pct"] == 80
    assert client.post("/api/lessons/native-first/complete", headers=auth).json()["progress_pct"] == 100
    assert client.patch("/api/lessons/native-first/progress", headers=auth, json={"progress_pct": 2}).json()["progress_pct"] == 100


def test_independent_sessions_preserve_maximum_and_completion_after_cached_read(tmp_path):
    import json
    import uuid
    from sqlalchemy import delete
    from sqlalchemy.orm import Session
    from app.services.progress_service import ProgressService
    uid = uuid.uuid4()
    school_id, course_id, lesson_id = [f"race-{kind}-{uid.hex}" for kind in ("school", "course", "lesson")]
    journal = tmp_path / "owned-progress-race-ids.json"
    journal.write_text(json.dumps({"user": str(uid), "school": school_id, "course": course_id, "lesson": lesson_id, "state": "planned"}))
    with Session(engine) as db:
        db.add(User(id=uid, first_name="TEST", last_name="Race", email=f"race-{uid.hex}@example.invalid", password_hash="unused-synthetic-hash", role=UserRole.LEARNER, status=AccountStatus.ACTIVE))
        db.add(School(id=school_id, name="TEST Race", short_name="TEST", color="#000000"))
        db.flush()
        db.add(Course(id=course_id, school_id=school_id, title="TEST Race", status=ContentStatus.PUBLISHED))
        db.flush()
        db.add(Lesson(id=lesson_id, course_id=course_id, title="TEST Race", position=1, status=ContentStatus.PUBLISHED))
        db.commit()
        ProgressService(db).set_progress(uid, lesson_id, 30)
    try:
        with Session(engine) as stale, Session(engine) as other:
            cached = stale.get(UserLessonProgress, (uid, lesson_id))
            assert cached.progress_pct == 30
            assert ProgressService(other).set_progress(uid, lesson_id, 80).progress_pct == 80
            assert ProgressService(stale).set_progress(uid, lesson_id, 35).progress_pct == 80
            assert ProgressService(other).complete_lesson(uid, lesson_id).progress_pct == 100
            assert ProgressService(stale).set_progress(uid, lesson_id, 10).progress_pct == 100
            assert cached.status.value == "COMPLETED"
    finally:
        with Session(engine) as db:
            db.execute(delete(Course).where(Course.id == course_id))
            db.execute(delete(School).where(School.id == school_id))
            db.execute(delete(User).where(User.id == uid))
            db.commit()
        journal.write_text(json.dumps({"user": str(uid), "school": school_id, "course": course_id, "lesson": lesson_id, "state": "cleaned-owned-ids-only"}))
