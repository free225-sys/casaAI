"""Provision only missing discovery references, without links or republication."""
from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text("""INSERT INTO knowledge_nodes (id, title, status)
        VALUES ('tokenization', 'Tokenisation', 'PUBLISHED'),
               ('generation', 'Génération de texte', 'PUBLISHED'),
               ('kv-cache', 'Cache clé-valeur', 'PUBLISHED')
        ON CONFLICT (id) DO NOTHING"""))


def downgrade():
    # Data-only, deliberately non-destructive: there is no provenance flag
    # distinguishing preexisting/editorially adopted nodes from our inserts.
    # Keep all three references and their later links, titles and statuses.
    pass
