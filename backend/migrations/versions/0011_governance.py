"""Add scope grants and explicit CASA decisions without rewriting legacy awards.

Upgrade is additive. Downgrade removes NEW grants/requests/official receipts only;
export those records before downgrade. Existing progress and certificates survive.
"""
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    # Explicit DDL rather than metadata.create_all: immutable migration definition.
    op.execute("""
        CREATE TABLE admin_scopes (
          id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          school_id VARCHAR REFERENCES schools(id) ON DELETE CASCADE,
          pathway_id VARCHAR REFERENCES pathways(id) ON DELETE CASCADE,
          assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
          assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT ck_admin_scope_one_target CHECK ((school_id IS NOT NULL) <> (pathway_id IS NOT NULL)),
          CONSTRAINT uq_admin_scope_school UNIQUE(user_id,school_id),
          CONSTRAINT uq_admin_scope_pathway UNIQUE(user_id,pathway_id)
        )
    """)
    op.execute("CREATE INDEX ix_admin_scopes_user_id ON admin_scopes(user_id)")
    op.execute("""
        CREATE TABLE certification_requests (
          id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          certification_id VARCHAR NOT NULL REFERENCES certifications(id) ON DELETE RESTRICT,
          statement VARCHAR NOT NULL, evidence_ids JSONB NOT NULL, evidence_snapshot JSONB NOT NULL,
          status VARCHAR NOT NULL DEFAULT 'SUBMITTED', submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
          decided_at TIMESTAMPTZ, reason VARCHAR,
          CONSTRAINT uq_certification_request_subject UNIQUE(user_id,certification_id),
          CONSTRAINT ck_certification_request_status CHECK(status IN ('SUBMITTED','APPROVED','REJECTED')),
          CONSTRAINT ck_certification_request_decision CHECK(
            (status='SUBMITTED' AND decided_at IS NULL AND reason IS NULL) OR
            (status<>'SUBMITTED' AND decided_at IS NOT NULL AND length(trim(reason))>0))
        )
    """)
    op.execute("CREATE INDEX ix_certification_requests_user_id ON certification_requests(user_id)")
    op.execute("CREATE INDEX ix_certification_requests_status ON certification_requests(status)")
    op.execute("""
        CREATE TABLE official_certificates (
          id UUID PRIMARY KEY,
          request_id UUID NOT NULL UNIQUE REFERENCES certification_requests(id) ON DELETE CASCADE,
          issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)


def downgrade():
    op.drop_table("official_certificates")
    op.drop_table("certification_requests")
    op.drop_table("admin_scopes")
