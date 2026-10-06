"""Export the four discovery paths and their reachable schemas, without SQL."""
import json
from pathlib import Path

from sqlalchemy.engine import Engine

PATHS = (
    "/api/discoveries/{discovery_key}/links",
    "/api/admin/knowledge-nodes",
    "/api/admin/lessons/{lesson_id}/knowledge-nodes",
)


def export():
    original = Engine.connect
    def no_sql(*args, **kwargs):
        raise AssertionError("OpenAPI export must not connect to PostgreSQL")
    Engine.connect = no_sql
    try:
        from app.main import app
        spec = app.openapi()
    finally:
        Engine.connect = original
    paths = {path: spec["paths"][path] for path in PATHS}
    refs = set()
    def visit(value):
        if isinstance(value, dict):
            ref = value.get("$ref", "")
            if ref.startswith("#/components/schemas/"):
                name = ref.rsplit("/", 1)[-1]
                if name not in refs:
                    refs.add(name)
                    visit(spec["components"]["schemas"][name])
            for item in value.values():
                visit(item)
        elif isinstance(value, list):
            for item in value:
                visit(item)
    visit(paths)
    return {"openapi": spec["openapi"], "info": {"title": "CASA discovery V1 contracts", "version": "1"},
            "paths": paths, "components": {
                "schemas": {name: spec["components"]["schemas"][name] for name in sorted(refs)},
                "securitySchemes": spec["components"]["securitySchemes"],
            }}


if __name__ == "__main__":
    target = Path(__file__).resolve().parents[2] / "docs/DISCOVERY_API_CONTRACTS.openapi.json"
    target.write_text(json.dumps(export(), indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    print("Discovery OpenAPI exported; SQL connections=0")
