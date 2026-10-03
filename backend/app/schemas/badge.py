from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AchievementBadgeOut(BaseModel):
    id: str
    title: str
    description: str
    category: str
    earned: bool
    earned_at: datetime | None = None
    new: bool = False


class NotificationSettingsOut(BaseModel):
    notify_badges: bool


class NotificationSettingsUpdate(BaseModel):
    notify_badges: bool
