"""Apply the actual data revision on PostgreSQL, within a rollback fixture."""
import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import delete, select

from app.models.enums import ContentStatus
from app.models.knowledge import KnowledgeNode, knowledge_node_used_in_lessons as links


def test_upgrade_preserves_existing_and_downgrade_preserves_adopted_nodes(db_session):
    path = Path(__file__).parents[1] / "migrations/versions/0015_discovery_notions.py"
    spec = importlib.util.spec_from_file_location("discovery_migration", path)
    revision = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(revision)
    revision.op = Operations(MigrationContext.configure(db_session.connection()))
    ids = ("tokenization", "generation", "kv-cache")
    db_session.execute(delete(KnowledgeNode).where(KnowledgeNode.id.in_(ids)))
    existing = KnowledgeNode(id="generation", title="Editorial", status=ContentStatus.ARCHIVED,
                             formula="Preserve")
    db_session.add(existing)
    db_session.flush()
    for _ in range(2):
        revision.upgrade()
    db_session.expire_all()
    rows = {row.id: row for row in db_session.scalars(select(KnowledgeNode).where(KnowledgeNode.id.in_(ids)))}
    assert len(rows) == 3
    assert (rows["generation"].title, rows["generation"].status, rows["generation"].formula) == (
        "Editorial", ContentStatus.ARCHIVED, "Preserve")
    assert rows["tokenization"].title == "Tokenisation" and rows["kv-cache"].title == "Cache clé-valeur"
    assert rows["tokenization"].status == rows["kv-cache"].status == ContentStatus.PUBLISHED
    assert list(db_session.execute(select(links).where(links.c.node_id.in_(ids)))) == []
    rows["tokenization"].title = "Adopted editorial title"
    db_session.flush()
    revision.downgrade()
    db_session.expire_all()
    assert db_session.get(KnowledgeNode, "tokenization").title == "Adopted editorial title"
    assert db_session.get(KnowledgeNode, "generation").status == ContentStatus.ARCHIVED
