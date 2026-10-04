"""Match the database-generated UUID contract of uuid_pk()."""
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    for table in ("admin_scopes", "certification_requests", "official_certificates"):
        op.execute(f"ALTER TABLE {table} ALTER COLUMN id SET DEFAULT gen_random_uuid()")


def downgrade():
    for table in ("admin_scopes", "certification_requests", "official_certificates"):
        op.execute(f"ALTER TABLE {table} ALTER COLUMN id DROP DEFAULT")
