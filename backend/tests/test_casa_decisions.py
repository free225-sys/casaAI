import uuid

import pytest
from sqlalchemy import func, select

from app.core.security import create_access_token
from app.models.certification import Certification, CourseCertificate
from app.models.content import Course
from app.models.catalog import School
from app.models.enums import AccountStatus, ContentStatus, UserRole
from app.models.governance import CertificationRequest, OfficialCertificate
from app.models.progress import PortfolioEvidence
from app.models.user import User


@pytest.fixture
def dossier(db_session):
    users = {}
    for name, role in (("learner", UserRole.LEARNER), ("other", UserRole.LEARNER),
                       ("admin", UserRole.ADMIN), ("super", UserRole.SUPER_ADMIN)):
        user = User(first_name=name, last_name="Synthetic", email=f"{uuid.uuid4()}@example.com",
                    password_hash="unused-fixture", role=role, status=AccountStatus.ACTIVE)
        db_session.add(user)
        users[name] = user
    cert = Certification(id="decision-cert", title="Synthetic official certification", status=ContentStatus.PUBLISHED)
    db_session.add(cert)
    db_session.flush()
    evidence = PortfolioEvidence(user_id=users["learner"].id, title="Original evidence")
    foreign = PortfolioEvidence(user_id=users["other"].id, title="Private evidence")
    db_session.add_all([evidence, foreign])
    db_session.commit()
    return users, cert, evidence, foreign


def headers(user):
    return {"Authorization": "Bearer " + create_access_token(user.id, user.role.value)}


def submit(client, dossier):
    users, cert, evidence, _ = dossier
    return client.post("/api/me/certification-requests", headers=headers(users["learner"]),
                       json={"certification_id": cert.id, "evidence_ids": [str(evidence.id)], "statement": "Please examine"})


def decide(client, dossier, request_id, decision="APPROVED", reason="CASA reviewed this dossier"):
    return client.post(f"/api/admin/certification-requests/{request_id}/decision",
                       headers=headers(dossier[0]["super"]), json={"decision": decision, "reason": reason})


def test_submission_is_owned_idempotent_and_never_issues(client, db_session, dossier):
    first = submit(client, dossier)
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["status"] == "SUBMITTED"
    assert body["official_certificate_id"] is None
    assert submit(client, dossier).json()["id"] == body["id"]
    assert db_session.scalar(select(func.count()).select_from(OfficialCertificate)) == 0
    assert client.get(f"/api/me/certification-requests/{body['id']}", headers=headers(dossier[0]["other"])).status_code == 404
    assert client.get("/api/me/certification-requests", headers=headers(dossier[0]["other"])).json()["total"] == 0
    changed = client.post("/api/me/certification-requests", headers=headers(dossier[0]["learner"]),
                          json={"certification_id": dossier[1].id, "statement": "Changed"})
    assert changed.status_code == 409


def test_foreign_evidence_rejected_and_snapshot_is_stable(client, db_session, dossier):
    users, cert, evidence, foreign = dossier
    bad = client.post("/api/me/certification-requests", headers=headers(users["learner"]),
                      json={"certification_id": cert.id, "statement": "Examine", "evidence_ids": [str(foreign.id)]})
    assert bad.status_code == 404
    assert db_session.scalar(select(func.count()).select_from(CertificationRequest)) == 0
    request_id = submit(client, dossier).json()["id"]
    evidence.title = "Later edit"
    db_session.commit()
    response = client.get(f"/api/admin/certification-requests/{request_id}", headers=headers(users["super"]))
    assert response.json()["evidence_snapshot"][0]["title"] == "Original evidence"


@pytest.mark.parametrize("name", ["learner", "other", "admin"])
def test_only_super_admin_can_review_and_decide(client, dossier, name):
    request_id = submit(client, dossier).json()["id"]
    auth = headers(dossier[0][name])
    assert client.get("/api/admin/certification-requests", headers=auth).status_code == 403
    assert client.get(f"/api/admin/certification-requests/{request_id}", headers=auth).status_code == 403
    assert client.post(f"/api/admin/certification-requests/{request_id}/decision", headers=auth,
                       json={"decision": "APPROVED", "reason": "Unauthorized"}).status_code == 403


@pytest.mark.parametrize("decision", ["APPROVED", "REJECTED"])
def test_explicit_terminal_decisions_and_idempotence(client, db_session, dossier, decision):
    request_id = submit(client, dossier).json()["id"]
    response = decide(client, dossier, request_id, decision)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == decision
    assert body["decided_by"] == str(dossier[0]["super"].id)
    assert body["decided_at"] and body["reason"]
    assert bool(body["official_certificate_id"]) == (decision == "APPROVED")
    assert decide(client, dossier, request_id, decision).json() == body
    opposite = "REJECTED" if decision == "APPROVED" else "APPROVED"
    assert decide(client, dossier, request_id, opposite).status_code == 409
    assert db_session.scalar(select(func.count()).select_from(OfficialCertificate)) == (decision == "APPROVED")


@pytest.mark.parametrize("change", ["inactive", "promoted", "unpublished"])
def test_approval_checks_current_applicant_and_certification(client, db_session, dossier, change):
    request_id = submit(client, dossier).json()["id"]
    if change == "inactive":
        dossier[0]["learner"].status = AccountStatus.SUSPENDED
    elif change == "promoted":
        dossier[0]["learner"].role = UserRole.ADMIN
    else:
        dossier[1].status = ContentStatus.DRAFT
    db_session.commit()
    assert decide(client, dossier, request_id).status_code == 409
    assert db_session.scalar(select(func.count()).select_from(OfficialCertificate)) == 0
    assert decide(client, dossier, request_id, "REJECTED").status_code == 200


def test_motive_required_and_self_review_forbidden(client, db_session, dossier):
    request_id = submit(client, dossier).json()["id"]
    assert decide(client, dossier, request_id, reason=" ").status_code == 422
    dossier[0]["learner"].role = UserRole.SUPER_ADMIN
    db_session.commit()
    response = client.post(f"/api/admin/certification-requests/{request_id}/decision",
                           headers=headers(dossier[0]["learner"]), json={"decision": "APPROVED", "reason": "Self"})
    assert response.status_code == 403


def test_legacy_certificate_preserved_without_new_automatic_issuance(client, db_session, dossier):
    user = dossier[0]["learner"]
    db_session.add(School(id="historical-school", name="Synthetic", short_name="HIS", color="#000000"))
    db_session.flush()
    for cid in ("historical-course", "new-course"):
        db_session.add(Course(id=cid, school_id="historical-school", title=cid, status=ContentStatus.PUBLISHED))
    db_session.flush()
    old = CourseCertificate(user_id=user.id, course_id="historical-course", average_score=90)
    db_session.add(old)
    db_session.commit()
    assert client.post("/api/courses/new-course/certificate", headers=headers(user)).status_code == 409
    result = client.post("/api/courses/historical-course/certificate", headers=headers(user))
    assert result.status_code == 200
    assert result.json()["id"] == str(old.id)
    assert result.json()["provenance"] == "LEGACY_AUTOMATIC"
    assert db_session.scalar(select(func.count()).select_from(CourseCertificate)) == 1


@pytest.mark.parametrize("name", ["admin", "super"])
def test_staff_cannot_submit_personal_certification_request(client, dossier, name):
    response = client.post("/api/me/certification-requests", headers=headers(dossier[0][name]),
                           json={"certification_id": dossier[1].id, "statement": "Not an applicant"})
    assert response.status_code == 403


def test_inactive_reviewer_and_forged_decision_fields_do_not_issue(client, db_session, dossier):
    response = client.post("/api/me/certification-requests", headers=headers(dossier[0]["learner"]),
                           json={"certification_id": dossier[1].id, "statement": "Synthetic", "status": "APPROVED",
                                 "decided_by": str(dossier[0]["super"].id)})
    assert response.status_code == 200
    assert response.json()["status"] == "SUBMITTED" and response.json()["decided_by"] is None
    reviewer = dossier[0]["super"]
    token = headers(reviewer)
    reviewer.status = AccountStatus.SUSPENDED
    db_session.commit()
    result = client.post(f"/api/admin/certification-requests/{response.json()['id']}/decision", headers=token,
                         json={"decision": "APPROVED", "reason": "Inactive"})
    assert result.status_code == 401
    assert db_session.scalar(select(func.count()).select_from(OfficialCertificate)) == 0


def test_review_queue_pagination_state_filter_and_issued_record(client, dossier):
    request_id = submit(client, dossier).json()["id"]
    token = headers(dossier[0]["super"])
    initial = client.get("/api/admin/certification-requests?state=SUBMITTED&limit=1", headers=token).json()
    assert initial["total"] == 1 and initial["items"][0]["id"] == request_id
    assert client.get("/api/admin/certification-requests?limit=1&offset=1", headers=token).json()["items"] == []
    approval = decide(client, dossier, request_id).json()
    assert client.get("/api/admin/certification-requests?state=SUBMITTED", headers=token).json()["total"] == 0
    issued = client.get("/api/me/certification-requests", headers=headers(dossier[0]["learner"])).json()["items"][0]
    assert issued["official_certificate_id"] == approval["official_certificate_id"]
    assert client.get("/api/admin/certification-requests?state=UNKNOWN", headers=token).status_code == 422


def corrected(client, dossier, previous_id, statement='Corrected dossier', evidence_ids=None):
    return client.post('/api/me/certification-requests', headers=headers(dossier[0]['learner']), json={
        'certification_id': dossier[1].id, 'statement': statement,
        'evidence_ids': evidence_ids if evidence_ids is not None else [str(dossier[2].id)],
        'previous_request_id': previous_id})


def test_rejected_request_allows_new_corrected_record_with_immutable_history(client, db_session, dossier):
    first = submit(client, dossier).json()
    rejected = decide(client, dossier, first['id'], 'REJECTED', 'Need corrected proof').json()
    old = client.get(f"/api/me/certification-requests/{first['id']}", headers=headers(dossier[0]['learner'])).json()
    # Lost-response retry of the original payload retrieves the original dossier.
    assert submit(client, dossier).json()['id'] == first['id']
    assert corrected(client, dossier, first['id'], statement='Please examine').status_code == 409
    second = corrected(client, dossier, first['id'])
    assert second.status_code == 200, second.text
    new = second.json()
    assert new['id'] != first['id'] and new['previous_request_id'] == first['id']
    assert new['status'] == 'SUBMITTED' and new['official_certificate_id'] is None
    assert corrected(client, dossier, first['id']).json() == new
    assert corrected(client, dossier, first['id'], statement='Different retry').status_code == 409
    assert client.get(f"/api/me/certification-requests/{first['id']}", headers=headers(dossier[0]['learner'])).json() == old
    assert decide(client, dossier, first['id'], 'REJECTED', 'Need corrected proof').json() == rejected
    assert decide(client, dossier, first['id'], 'APPROVED').status_code == 409
    approved = decide(client, dossier, new['id']).json()
    assert approved['official_certificate_id']
    assert corrected(client, dossier, first['id']).json()['id'] == new['id']
    assert corrected(client, dossier, new['id'], statement='Unauthorized third').status_code == 409
    assert db_session.scalar(select(func.count()).select_from(CertificationRequest)) == 2
    assert db_session.scalar(select(func.count()).select_from(OfficialCertificate)) == 1
    history = client.get('/api/me/certification-requests', headers=headers(dossier[0]['learner'])).json()
    assert history['total'] == 2 and [item['id'] for item in history['items']] == [new['id'], first['id']]


@pytest.mark.parametrize('state', ['SUBMITTED', 'APPROVED'])
def test_new_request_requires_previous_rejection(client, db_session, dossier, state):
    first = submit(client, dossier).json()
    if state == 'APPROVED':
        assert decide(client, dossier, first['id']).status_code == 200
    assert corrected(client, dossier, first['id']).status_code == 409
    assert db_session.scalar(select(func.count()).select_from(CertificationRequest)) == 1


def test_correction_can_use_updated_same_owned_evidence_without_rewriting_old_snapshot(client, dossier):
    old = submit(client, dossier).json()
    assert decide(client, dossier, old['id'], 'REJECTED').status_code == 200
    # Portfolio mutation changes the actual evidence but not its identity.
    from sqlalchemy.orm import object_session
    dossier[2].title = 'Corrected proof content'
    object_session(dossier[2]).commit()
    new = corrected(client, dossier, old['id'], statement='Please examine')
    assert new.status_code == 200, new.text
    assert new.json()['evidence_snapshot'][0]['title'] == 'Corrected proof content'
    previous = client.get(f"/api/me/certification-requests/{old['id']}", headers=headers(dossier[0]['learner'])).json()
    assert previous['evidence_snapshot'][0]['title'] == 'Original evidence'


@pytest.mark.parametrize('kind', ['foreign_previous', 'wrong_certification', 'foreign_evidence', 'missing_previous'])
def test_corrected_requests_enforce_owner_and_certification(client, db_session, dossier, kind):
    old = submit(client, dossier).json()
    assert decide(client, dossier, old['id'], 'REJECTED').status_code == 200
    payload = {'certification_id': dossier[1].id, 'statement': 'Corrected',
               'evidence_ids': [str(dossier[2].id)], 'previous_request_id': old['id']}
    auth = headers(dossier[0]['learner'])
    if kind == 'foreign_previous':
        auth = headers(dossier[0]['other'])
    elif kind == 'wrong_certification':
        payload['certification_id'] = 'another-certification'
    elif kind == 'foreign_evidence':
        payload['evidence_ids'] = [str(dossier[3].id)]
    else:
        payload['previous_request_id'] = str(uuid.uuid4())
    assert client.post('/api/me/certification-requests', headers=auth, json=payload).status_code == 404
    assert db_session.scalar(select(func.count()).select_from(CertificationRequest)) == 1


def test_second_rejection_links_only_the_latest_corrected_dossier(client, db_session, dossier):
    first = submit(client, dossier).json()
    decide(client, dossier, first['id'], 'REJECTED')
    second = corrected(client, dossier, first['id']).json()
    decide(client, dossier, second['id'], 'REJECTED')
    assert corrected(client, dossier, first['id'], statement='Cannot fork old rejection').status_code == 409
    third = corrected(client, dossier, second['id'], statement='Third corrected dossier')
    assert third.status_code == 200 and third.json()['previous_request_id'] == second['id']
    assert db_session.scalar(select(func.count()).select_from(CertificationRequest)) == 3


def test_casa_name_is_admin_only_without_email_and_no_n_plus_one(client, db_session, dossier):
    from sqlalchemy import event
    first = submit(client, dossier).json()
    personal = client.get('/api/me/certification-requests', headers=headers(dossier[0]['learner'])).json()
    assert 'applicant_display_name' not in personal['items'][0]
    auth = headers(dossier[0]['super'])
    count = []
    def record(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith('SELECT'):
            count.append(statement)
    connection = db_session.connection()
    db_session.expire_all()  # Equal cold authentication cache for both measurements.
    event.listen(connection, 'before_cursor_execute', record)
    try:
        one = client.get('/api/admin/certification-requests', headers=auth).json()
        one_count = len(count)
        assert one['items'][0]['applicant_display_name'] == 'learner Synthetic'
        assert 'email' not in one['items'][0]
        for index in range(3):
            cert = Certification(id=f'name-cert-{index}', title='Synthetic', status=ContentStatus.PUBLISHED)
            db_session.add(cert)
            db_session.flush()
            db_session.add(CertificationRequest(user_id=dossier[0]['learner'].id, certification_id=cert.id,
                            statement='Synthetic', evidence_ids=[], evidence_snapshot=[]))
        db_session.commit()
        count.clear()
        many = client.get('/api/admin/certification-requests', headers=auth).json()
        assert len(many['items']) == 4 and len(count) == one_count
    finally:
        event.remove(connection, 'before_cursor_execute', record)
    detail = client.get(f"/api/admin/certification-requests/{first['id']}", headers=auth).json()
    assert detail['applicant_display_name'] == 'learner Synthetic'
    decision = decide(client, dossier, first['id']).json()
    assert decision['applicant_display_name'] == 'learner Synthetic' and 'email' not in decision
    dossier[0]['learner'].first_name = 'Current'
    db_session.commit()
    updated = client.get(f"/api/admin/certification-requests/{first['id']}", headers=auth).json()
    assert updated['applicant_display_name'] == 'Current Synthetic'


@pytest.mark.parametrize('state', ['SUBMITTED', 'APPROVED'])
def test_database_rejects_another_open_subject_without_application_lock(client, db_session, dossier, state):
    from datetime import datetime, timezone
    from sqlalchemy.exc import IntegrityError
    submit(client, dossier)
    with pytest.raises(IntegrityError) as error:
        with db_session.begin_nested():
            duplicate = CertificationRequest(user_id=dossier[0]['learner'].id, certification_id=dossier[1].id,
                statement='Forbidden duplicate', evidence_ids=[], evidence_snapshot=[], status=state)
            if state == 'APPROVED':
                duplicate.reason = 'Synthetic review'
                duplicate.decided_by = dossier[0]['super'].id
                duplicate.decided_at = datetime.now(timezone.utc)
            db_session.add(duplicate)
            db_session.flush()
    assert error.value.orig.diag.constraint_name == 'uq_certification_request_open_subject'
    assert db_session.scalar(select(func.count()).select_from(CertificationRequest)) == 1
