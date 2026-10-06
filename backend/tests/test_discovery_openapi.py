"""Contract checks without database access."""
import io
import json
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy.engine import Engine

from scripts.export_discovery_openapi import export


def test_committed_openapi_matches_application_and_protects_admin_metadata():
    actual = export()
    committed = json.loads((Path(__file__).parents[2] / "docs/DISCOVERY_API_CONTRACTS.openapi.json").read_text(encoding="utf-8"))
    assert committed == actual
    public = actual["paths"]["/api/discoveries/{discovery_key}/links"]["get"]
    assert not public.get("security")
    assert public["responses"]["200"]["headers"]["Cache-Control"]["schema"]["const"] == "no-store"
    assert public["responses"]["500"]["headers"]["Cache-Control"]["schema"]["const"] == "no-store"
    admin = actual["paths"]["/api/admin/lessons/{lesson_id}/knowledge-nodes"]
    assert all(admin[method]["security"] for method in ("get", "put"))
    schemas = actual["components"]["schemas"]
    assert set(schemas["AdminKnowledgeNodeOut"]["properties"]) == {"id", "title", "status"}
    replacement = schemas["LessonKnowledgeNodesReplacement"]
    assert set(replacement["required"]) == {"node_ids", "expected_revision"}
    assert replacement["additionalProperties"] is False
    assert replacement["properties"]["node_ids"]["maxItems"] == 100
    assert schemas["DiscoveryLinksOut"]["properties"]["registry_version"]["const"] == 1
    assert set(admin["put"]["responses"]) >= {"200", "401", "403", "404", "409", "422"}


def test_migration_offline_is_insert_only_and_downgrade_has_no_data_deletes(monkeypatch):
    def refuse(*args, **kwargs):
        raise AssertionError("Offline migration may not connect to PostgreSQL")
    monkeypatch.setattr(Engine, "connect", refuse)
    root = Path(__file__).parents[1]
    sql = {}
    for direction, revisions in (("upgrade", "0014:0015"), ("downgrade", "0015:0014")):
        buffer = io.StringIO()
        config = Config(str(root / "alembic.ini"), output_buffer=buffer)
        config.set_main_option("script_location", str(root / "migrations"))
        getattr(command, direction)(config, revisions, sql=True)
        sql[direction] = buffer.getvalue().upper()
    assert "ON CONFLICT (ID) DO NOTHING" in sql["upgrade"]
    assert "KNOWLEDGE_NODE_USED_IN_LESSONS" not in sql["upgrade"]
    assert "DELETE FROM KNOWLEDGE" not in sql["downgrade"] and "DROP TABLE" not in sql["downgrade"]
