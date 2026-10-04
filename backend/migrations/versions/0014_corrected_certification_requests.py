"""Allow new corrected dossiers after rejection without rewriting old records."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("certification_requests", sa.Column("previous_request_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_certification_request_previous", "certification_requests", "certification_requests",
                          ["previous_request_id"], ["id"], ondelete="NO ACTION", deferrable=True, initially="DEFERRED")
    op.create_unique_constraint("uq_certification_request_previous", "certification_requests", ["previous_request_id"])
    op.create_index("uq_certification_request_open_subject", "certification_requests",
                    ["user_id", "certification_id"], unique=True, postgresql_where=sa.text("status <> 'REJECTED'"))
    op.drop_constraint("uq_certification_request_subject", "certification_requests", type_="unique")


def downgrade():
    # Never delete history to fit the previous uniqueness constraint.
    op.execute("""DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM certification_requests GROUP BY user_id, certification_id HAVING count(*) > 1)
      THEN RAISE EXCEPTION 'Cannot downgrade: corrected request history exists; retain/export it first';
      END IF;
    END $$""")
    op.create_unique_constraint("uq_certification_request_subject", "certification_requests", ["user_id", "certification_id"])
    op.drop_index("uq_certification_request_open_subject", table_name="certification_requests")
    op.drop_constraint("uq_certification_request_previous", "certification_requests", type_="unique")
    op.drop_constraint("fk_certification_request_previous", "certification_requests", type_="foreignkey")
    op.drop_column("certification_requests", "previous_request_id")
