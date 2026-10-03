"""Real PostgreSQL checks for the user-approved non-learning staff policy."""
import uuid

import pytest
from sqlalchemy import func, select

from app.core.security import create_access_token
from app.models.enums import AccountStatus, UserRole
from app.models.user import User
from app.models.progress import UserLessonProgress, QuizAttempt, LabResult, PortfolioEvidence
from app.models.badge import UserBadge
from app.models.notification import Notification


@pytest.fixture
def role_user(db_session, request):
    role = request.param
    user = User(first_name="Synthetic", last_name="Roles", email=f"{uuid.uuid4()}@example.com",
                password_hash="unused-fixture", role=role, status=AccountStatus.ACTIVE)
    db_session.add(user)
    db_session.commit()
    return user


def auth(user):
    return {"Authorization": "Bearer " + create_access_token(user.id, user.role.value)}


PERSONAL_ACTIONS = [
    ("GET", "/api/lessons/absent", None),
    ("GET", "/api/lessons/absent/document", None),
    ("POST", "/api/lessons/absent/start", None),
    ("PATCH", "/api/lessons/absent/progress", {"progress_pct": 50}),
    ("POST", "/api/lessons/absent/complete", None),
    *[("GET", f"/api/me/{path}", None) for path in (
        "progress", "skills", "badges", "quiz-history", "lab-results", "portfolio",
        "course-certificates", "onboarding-profile")],
    ("POST", "/api/me/badges/ack", None),
    ("POST", "/api/portfolio/evidence", {"title": "Synthetic evidence"}),
    ("PUT", "/api/me/onboarding-profile", {}),
    ("GET", "/api/quizzes", None),
    ("GET", "/api/quizzes/00000000-0000-0000-0000-000000000001", None),
    ("GET", "/api/skills/absent/quiz", None),
    ("POST", "/api/quizzes/00000000-0000-0000-0000-000000000001/attempt", {"answers": []}),
    ("POST", "/api/labs/absent/submit", {}),
    ("GET", "/api/portfolio/evidence/00000000-0000-0000-0000-000000000001", None),
    ("GET", "/api/me/certifications/absent/eligibility", None),
    ("GET", "/api/courses/absent/certificate/eligibility", None),
    ("POST", "/api/courses/absent/certificate", None),
]


@pytest.mark.parametrize("role_user", [UserRole.ADMIN, UserRole.SUPER_ADMIN], indirect=True)
@pytest.mark.parametrize("method,path,payload", PERSONAL_ACTIONS)
def test_staff_cannot_use_learning_api(client, db_session, role_user, method, path, payload):
    models = (UserLessonProgress, QuizAttempt, LabResult, PortfolioEvidence, UserBadge, Notification)
    before = [db_session.scalar(select(func.count()).select_from(m)) for m in models]
    response = client.request(method, path, headers=auth(role_user), json=payload)
    assert response.status_code == 403, response.text
    assert [db_session.scalar(select(func.count()).select_from(m)) for m in models] == before


@pytest.mark.parametrize("role_user", list(UserRole), indirect=True)
def test_common_account_notifications_and_preferences_remain_accessible(client, role_user):
    for path in ("/api/auth/me", "/api/me/notifications", "/api/me/notification-settings"):
        assert client.get(path, headers=auth(role_user)).status_code == 200
    assert client.patch("/api/me/notification-settings", headers=auth(role_user),
                        json={"notify_badges": False}).status_code == 200


@pytest.mark.parametrize("role_user", list(UserRole), indirect=True)
@pytest.mark.parametrize("account_status", [AccountStatus.SUSPENDED, AccountStatus.PENDING])
def test_inactive_accounts_rejected_before_role_check(client, db_session, role_user, account_status):
    headers = auth(role_user)
    role_user.status = account_status
    db_session.commit()
    for path in ("/api/auth/me", "/api/me/progress", "/api/me/notifications"):
        assert client.get(path, headers=headers).status_code == 401


@pytest.mark.parametrize("role_user", [UserRole.LEARNER], indirect=True)
def test_learner_can_read_own_learning_sections(client, role_user):
    for path in ("progress", "skills", "badges", "quiz-history", "lab-results", "portfolio",
                 "course-certificates", "onboarding-profile"):
        assert client.get("/api/me/" + path, headers=auth(role_user)).status_code == 200


@pytest.mark.parametrize("role_user", [UserRole.LEARNER], indirect=True)
def test_role_changes_effective_with_existing_token(client, db_session, role_user):
    headers = auth(role_user)
    assert client.get("/api/me/progress", headers=headers).status_code == 200
    role_user.role = UserRole.ADMIN
    db_session.commit()
    assert client.get("/api/me/progress", headers=headers).status_code == 403
    role_user.role = UserRole.LEARNER
    db_session.commit()
    assert client.get("/api/me/progress", headers=headers).status_code == 200
