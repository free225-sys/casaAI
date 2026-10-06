"""PostgreSQL transaction-scoped locks for read/check/write invariants."""
from hashlib import blake2b

from sqlalchemy import func, select
from sqlalchemy.orm import Session


def transaction_lock(db: Session, name: str) -> None:
    # Stable across processes; unlike Python's randomized hash(). Different
    # domains/subjects usually proceed independently. PostgreSQL releases the
    # lock on commit/rollback, including when the request fails.
    key = int.from_bytes(blake2b(name.encode("utf-8"), digest_size=8).digest(), "big", signed=True)
    db.execute(select(func.pg_advisory_xact_lock(key)))
