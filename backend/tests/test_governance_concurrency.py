"""Independent committed connections, synthetic records, exact-ID cleanup only."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import uuid

from fastapi import Depends, FastAPI
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api import admin_content, admin_scopes, certification_requests
from app.api.deps import _bearer_scheme, get_current_user
from app.core.security import create_access_token
from app.db.session import engine, get_db
from app.models.catalog import School
from app.models.certification import Certification
from app.models.content import Course
from app.models.enums import AccountStatus, ContentStatus, UserRole
from app.models.governance import AdminScope, CertificationRequest, OfficialCertificate
from app.models.user import User


@pytest.fixture
def committed_governance():
    url = engine.url
    if not (url.host == "127.0.0.1" and url.port == 55432 and
            url.database == "casa_recipe_20261003_a51b626_tests" and url.username == "casa_test"):
        pytest.skip("Requires the explicitly isolated additional governance test database")
    tag = uuid.uuid4().hex
    ids = [uuid.uuid4() for _ in range(4)]
    sid, cid, certid = "scope-race-"+tag, "course-race-"+tag, "cert-race-"+tag
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(User)) == 0
        for uid, role in zip(ids, (UserRole.LEARNER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN)):
            db.add(User(id=uid, first_name="Race", last_name="Synthetic", email=f"{uid}@example.com",
                        password_hash="unused-fixture", role=role, status=AccountStatus.ACTIVE))
        db.add(School(id=sid, name="Synthetic", short_name="RACE", color="#000000"))
        db.add(Certification(id=certid, title="Synthetic", status=ContentStatus.PUBLISHED))
        db.flush()
        db.add(Course(id=cid, school_id=sid, title="Original", status=ContentStatus.PUBLISHED))
        db.add(AdminScope(user_id=ids[1], school_id=sid, assigned_by=ids[2]))
        db.commit()
    try:
        yield ids, sid, cid, certid
    finally:
        with Session(engine) as db:
            db.execute(delete(User).where(User.id.in_(ids)))
            db.execute(delete(Course).where(Course.id == cid))
            db.execute(delete(Certification).where(Certification.id == certid))
            db.execute(delete(School).where(School.id == sid))
            db.commit()
            assert db.scalar(select(func.count()).select_from(User)) == 0


def simultaneous(requests):
    app = FastAPI()
    for router in (admin_content.router, admin_scopes.router, certification_requests.router):
        app.include_router(router)
    barrier = Barrier(2)
    connections = set()

    def authenticated(credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme), db: Session = Depends(get_db)):
        user = get_current_user(credentials, db)
        connections.add(db.scalar(select(func.pg_backend_pid())))
        barrier.wait(timeout=15)
        return user

    app.dependency_overrides[get_current_user] = authenticated

    def run(request):
        method, path, uid, role, payload = request
        with TestClient(app) as client:
            response = client.request(method, path, headers={"Authorization": "Bearer " + create_access_token(uid, role.value)}, json=payload)
            return response.status_code, response.json()

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(run, requests))
    assert len(connections) == 2
    return responses


def test_concurrent_submissions_create_one_request_without_award(committed_governance):
    ids, _, _, certid = committed_governance
    payload = {"certification_id": certid, "statement": "Synthetic examination"}
    responses = simultaneous([("POST", "/api/me/certification-requests", ids[0], UserRole.LEARNER, payload)] * 2)
    assert [code for code, _ in responses] == [200, 200]
    assert responses[0][1]["id"] == responses[1][1]["id"]
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(CertificationRequest).where(CertificationRequest.user_id == ids[0])) == 1
        assert db.scalar(select(func.count()).select_from(OfficialCertificate)) == 0


@pytest.mark.parametrize("conflict", [False, True])
def test_concurrent_decisions_emit_at_most_one_official_record(committed_governance, conflict):
    ids, _, _, certid = committed_governance
    with Session(engine) as db:
        item = CertificationRequest(user_id=ids[0], certification_id=certid, statement="Synthetic",
                                    evidence_ids=[], evidence_snapshot=[])
        db.add(item)
        db.commit()
        request_id = item.id
    path = f"/api/admin/certification-requests/{request_id}/decision"
    responses = simultaneous([
        ("POST", path, ids[2], UserRole.SUPER_ADMIN, {"decision": "APPROVED", "reason": "CASA review"}),
        ("POST", path, ids[3], UserRole.SUPER_ADMIN, {"decision": "REJECTED" if conflict else "APPROVED", "reason": "CASA review"}),
    ])
    assert sorted(code for code, _ in responses) == ([200, 409] if conflict else [200, 200])
    with Session(engine) as db:
        item = db.get(CertificationRequest, request_id)
        assert item.decided_by in ids[2:] and item.decided_at is not None
        receipts = db.scalars(select(OfficialCertificate).where(OfficialCertificate.request_id == request_id)).all()
        assert len(receipts) == (item.status == "APPROVED")
    if not conflict:
        assert responses[0][1]["official_certificate_id"] == responses[1][1]["official_certificate_id"]


def test_scope_revocation_serializes_with_content_mutation(committed_governance):
    ids, sid, cid, _ = committed_governance
    responses = simultaneous([
        ("PUT", f"/api/admin/users/{ids[1]}/scopes", ids[2], UserRole.SUPER_ADMIN, {"school_ids": [], "pathway_ids": []}),
        ("PUT", f"/api/admin/courses/{cid}", ids[1], UserRole.ADMIN, {"school_id": sid, "title": "Synthetic edit"}),
    ])
    assert responses[0][0] == 200
    assert responses[1][0] in (200, 404)
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(AdminScope).where(AdminScope.user_id == ids[1])) == 0
        course = db.get(Course, cid)
        assert course.title == ("Synthetic edit" if responses[1][0] == 200 else "Original")
