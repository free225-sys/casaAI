"""Real badge service, synthetic rows; no DB constraints/concurrency claims."""
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock
import uuid

import pytest
from sqlalchemy.orm import Session

from app.models.badge import UserBadge
from app.models.enums import LessonProgressStatus
from app.models.notification import Notification
from app.models.user import UserProfile
from app.services.badge_service import BadgeService


@pytest.fixture
def badges(monkeypatch):
    db = Mock(spec=Session)
    rows = []
    profiles = {}
    now = datetime.now(timezone.utc)
    service = BadgeService(db)
    completed = SimpleNamespace(status=LessonProgressStatus.COMPLETED, completed_at=now, updated_at=now)
    monkeypatch.setattr(service.progress, "list_user_progress", lambda id: [(completed, None)])
    monkeypatch.setattr(service.progress, "list_quiz_history", lambda id: [])
    monkeypatch.setattr(service.progress, "list_lab_results", lambda id: [])
    monkeypatch.setattr(service.progress, "list_user_skills", lambda id: [])
    monkeypatch.setattr(service.certs, "list_my_course_certificates", lambda id: [])
    db.get.side_effect = lambda model, key: profiles.get(key)

    def add(row):
        if isinstance(row, UserProfile):
            profiles[row.user_id] = row
        else:
            rows.append(row)

    def execute(query):
        # Simulated result for the actual service-generated SQL, scoped by user.
        entity = query.column_descriptions[0]["entity"]
        user_id = next(value for value in query.compile().params.values() if isinstance(value, uuid.UUID))
        selected = [row for row in rows if isinstance(row, entity) and row.user_id == user_id]
        if "notified IS false" in str(query):
            selected = [row for row in selected if not row.notified]
        if "read IS false" in str(query):
            selected = [row for row in selected if not row.read]
        result = Mock()
        result.scalars.return_value = selected
        return result

    db.add.side_effect = add
    db.execute.side_effect = execute
    return service, rows


def test_badges_created_on_read_once_then_acknowledged_for_only_one_user(badges):
    service, rows = badges
    first, other = uuid.uuid4(), uuid.uuid4()
    assert rows == []  # completion by itself has not invoked badge persistence
    first_badges = service.list_for_user(first)
    assert [badge.id for badge in first_badges if badge.new] == ["first_step"]
    for _ in range(2):
        service.list_for_user(first)
    assert len([row for row in rows if isinstance(row, UserBadge)]) == 1
    assert len([row for row in rows if isinstance(row, Notification)]) == 1
    service.list_for_user(other)
    service.acknowledge(first)
    assert not any(badge.new for badge in service.list_for_user(first))
    assert any(badge.new for badge in service.list_for_user(other))
    assert all(row.read for row in rows if isinstance(row, Notification) and row.user_id == first)
    assert all(not row.read for row in rows if isinstance(row, Notification) and row.user_id == other)


def test_notification_opt_out_still_earns_badge_without_notification(badges):
    service, rows = badges
    user_id = uuid.uuid4()
    assert service.get_settings(user_id) is True
    assert service.set_settings(user_id, False) is False
    assert service.get_settings(user_id) is False
    result = service.list_for_user(user_id)
    assert any(badge.id == "first_step" and badge.earned for badge in result)
    assert not any(badge.new for badge in result)
    assert len([row for row in rows if isinstance(row, UserBadge)]) == 1
    assert not any(isinstance(row, Notification) for row in rows)
    service.set_settings(user_id, True)
    assert not any(badge.new for badge in service.list_for_user(user_id))
    assert not any(isinstance(row, Notification) for row in rows)
