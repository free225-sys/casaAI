"""badge notifications

Revision ID: 0010
Revises: 0009
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0010"
down_revision: Union[str, Sequence[str], None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'BADGE_EARNED';")
    op.execute(
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notify_badges BOOLEAN NOT NULL DEFAULT TRUE;"
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS user_badges (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            badge_id VARCHAR NOT NULL,
            earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            notified BOOLEAN NOT NULL DEFAULT FALSE,
            CONSTRAINT uq_user_badges_user_badge UNIQUE (user_id, badge_id)
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS user_badges;")
    op.execute("ALTER TABLE user_profiles DROP COLUMN IF EXISTS notify_badges;")
