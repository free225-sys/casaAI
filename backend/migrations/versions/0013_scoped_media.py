"""Persist the authorized school/course target of new uploads; retain old files."""
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE scoped_media (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(), url VARCHAR NOT NULL UNIQUE,
          school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
          course_id VARCHAR REFERENCES courses(id) ON DELETE SET NULL,
          uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
          uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_scoped_media_school_id ON scoped_media(school_id)")
    op.execute("CREATE INDEX ix_scoped_media_course_id ON scoped_media(course_id)")


def downgrade():
    # Only new attachment metadata; does not delete old or new physical images.
    op.drop_table("scoped_media")
