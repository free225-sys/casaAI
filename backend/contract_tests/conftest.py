"""HTTP/unit contracts only: no PostgreSQL, .env, Docker or live accounts.

Kept outside tests/ so the existing integration conftest never opens its DB.
"""
import os
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
if Path(".env").exists():
    raise RuntimeError("Run contracts from a directory without a .env file.")
os.environ["DATABASE_URL"] = "postgresql+psycopg2://unused:unused@127.0.0.1:1/casa_contracts"
os.environ["SECRET_KEY"] = "synthetic-contract-key-not-for-real-accounts"


@pytest.fixture(autouse=True)
def forbid_sql_connections(monkeypatch):
    from sqlalchemy.engine import Engine

    def blocked(*args, **kwargs):
        raise AssertionError("Contract tests must never connect to a database")

    monkeypatch.setattr(Engine, "connect", blocked)
