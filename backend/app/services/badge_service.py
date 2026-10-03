from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import LessonProgressStatus
from app.repositories.certification_repository import CertificationRepository
from app.repositories.progress_repository import ProgressRepository
from app.schemas.badge import AchievementBadgeOut


CATALOG: list[dict] = [
    {"id": "first_step", "title": "Premier pas", "description": "Terminer une première leçon.", "category": "apprentissage", "kind": "lessons", "threshold": 1},
    {"id": "curious", "title": "Curieux", "description": "Terminer 3 leçons.", "category": "apprentissage", "kind": "lessons", "threshold": 3},
    {"id": "regular", "title": "Régulier", "description": "Terminer 10 leçons.", "category": "apprentissage", "kind": "lessons", "threshold": 10},
    {"id": "quiz_start", "title": "Première réussite", "description": "Réussir un quiz.", "category": "quiz", "kind": "quiz_pass", "threshold": 1},
    {"id": "quiz_solid", "title": "Solide", "description": "Réussir 5 quiz.", "category": "quiz", "kind": "quiz_pass", "threshold": 5},
    {"id": "quiz_perfect", "title": "Sans faute", "description": "Obtenir 100 à un quiz.", "category": "quiz", "kind": "quiz_score", "threshold": 100},
    {"id": "lab_start", "title": "Mains dans le cambouis", "description": "Soumettre un lab.", "category": "labs", "kind": "labs", "threshold": 1},
    {"id": "skill_one", "title": "Compétence", "description": "Atteindre le niveau 2 sur une compétence.", "category": "compétences", "kind": "skill", "threshold": 2},
    {"id": "skill_master", "title": "Maîtrise", "description": "Atteindre le niveau 4 sur une compétence.", "category": "compétences", "kind": "skill", "threshold": 4},
    {"id": "certified", "title": "Certifié", "description": "Obtenir un certificat de cours.", "category": "certification", "kind": "certificate", "threshold": 1},
]


class BadgeService:
    def __init__(self, db: Session):
        self.db = db
        self.progress = ProgressRepository(db)
        self.certs = CertificationRepository(db)

    def list_for_user(self, user_id: uuid.UUID) -> list[AchievementBadgeOut]:
        lessons = self.progress.list_user_progress(user_id)
        completed = [p for p, _ in lessons if p.status == LessonProgressStatus.COMPLETED]
        completed.sort(key=lambda p: p.completed_at or p.updated_at)
        quizzes = self.progress.list_quiz_history(user_id)
        passed = [(a, q) for a, q in quizzes if a.passed]
        best_score = max((a.score for a, _ in quizzes), default=0)
        labs = self.progress.list_lab_results(user_id)
        skills = self.progress.list_user_skills(user_id)
        max_mastery = max((us.mastery_level for us, _ in skills), default=0)
        certificates = self.certs.list_my_course_certificates(user_id)

        def nth_date(items, n, getter):
            if len(items) < n:
                return None
            return getter(items[n - 1])

        out: list[AchievementBadgeOut] = []
        for spec in CATALOG:
            earned = False
            earned_at = None
            kind = spec["kind"]
            threshold = spec["threshold"]
            if kind == "lessons":
                earned = len(completed) >= threshold
                earned_at = nth_date(completed, threshold, lambda p: p.completed_at)
            elif kind == "quiz_pass":
                earned = len(passed) >= threshold
                ordered = sorted(passed, key=lambda row: row[0].completed_at or row[0].started_at)
                earned_at = nth_date(ordered, threshold, lambda row: row[0].completed_at)
            elif kind == "quiz_score":
                earned = best_score >= threshold
                match = next((a for a, _ in quizzes if a.score >= threshold), None)
                earned_at = match.completed_at if match else None
            elif kind == "labs":
                earned = len(labs) >= threshold
                ordered = sorted(labs, key=lambda r: r.submitted_at)
                earned_at = nth_date(ordered, threshold, lambda r: r.submitted_at)
            elif kind == "skill":
                earned = max_mastery >= threshold
                match = next((us for us, _ in skills if us.mastery_level >= threshold), None)
                earned_at = match.updated_at if match else None
            elif kind == "certificate":
                earned = len(certificates) >= threshold
                ordered = sorted(certificates, key=lambda c: c.issued_at)
                earned_at = nth_date(ordered, threshold, lambda c: c.issued_at)
            out.append(AchievementBadgeOut(
                id=spec["id"], title=spec["title"], description=spec["description"],
                category=spec["category"], earned=earned, earned_at=earned_at,
            ))
        return self._persist_and_notify(user_id, out)

    def _notify_enabled(self, user_id: uuid.UUID) -> bool:
        from app.models.user import UserProfile
        profile = self.db.get(UserProfile, user_id)
        if profile is None:
            return True
        return bool(getattr(profile, "notify_badges", True))

    def _persist_and_notify(self, user_id, badges):
        from app.models.badge import UserBadge
        from app.models.enums import NotificationType
        from app.models.notification import Notification

        existing = {
            row.badge_id: row
            for row in self.db.execute(select(UserBadge).where(UserBadge.user_id == user_id)).scalars()
        }
        notify = self._notify_enabled(user_id)
        for badge in badges:
            if not badge.earned:
                continue
            row = existing.get(badge.id)
            if row is None:
                row = UserBadge(
                    user_id=user_id,
                    badge_id=badge.id,
                    earned_at=badge.earned_at or datetime.now(timezone.utc),
                    notified=not notify,
                )
                self.db.add(row)
                existing[badge.id] = row
                if notify:
                    self.db.add(Notification(
                        user_id=user_id,
                        type=NotificationType.BADGE_EARNED,
                        title=f"Badge débloqué : {badge.title}",
                        body=badge.description,
                        read=False,
                    ))
                badge.new = notify
            else:
                badge.new = notify and not row.notified
        self.db.commit()
        return badges

    def acknowledge(self, user_id: uuid.UUID) -> None:
        from app.models.badge import UserBadge
        from app.models.enums import NotificationType
        from app.models.notification import Notification

        for row in self.db.execute(
            select(UserBadge).where(UserBadge.user_id == user_id, UserBadge.notified.is_(False))
        ).scalars():
            row.notified = True
        for note in self.db.execute(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.type == NotificationType.BADGE_EARNED,
                Notification.read.is_(False),
            )
        ).scalars():
            note.read = True
        self.db.commit()

    def get_settings(self, user_id: uuid.UUID) -> bool:
        return self._notify_enabled(user_id)

    def set_settings(self, user_id: uuid.UUID, notify_badges: bool) -> bool:
        from app.models.user import UserProfile
        profile = self.db.get(UserProfile, user_id)
        if profile is None:
            profile = UserProfile(user_id=user_id, notify_badges=notify_badges)
            self.db.add(profile)
        else:
            profile.notify_badges = notify_badges
        self.db.commit()
        return notify_badges
