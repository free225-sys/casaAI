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


def test_question_cleanup_serializes_option_only_history_insert(committed_governance):
    """Independent connections: option-only FK writes cannot cross cleanup's check."""
    from threading import Event
    from time import monotonic
    from sqlalchemy import event, text
    from sqlalchemy.exc import IntegrityError
    from app.models.quiz import Question, QuestionOption, Quiz
    from app.models.progress import QuizAttempt, QuizAttemptAnswer
    from app.repositories.admin_quiz_repository import AdminQuizRepository
    ids, _, cid, _ = committed_governance
    tag = uuid.uuid4().hex
    old_q, other_q = 'cleanup-old-'+tag, 'cleanup-other-'+tag
    with Session(engine) as db:
        db.add_all([Question(id=old_q, question_text='Old'), Question(id=other_q, question_text='Other')])
        quiz = Quiz(title='Synthetic concurrent history', course_id=cid)
        db.add(quiz)
        db.flush()
        option = QuestionOption(question_id=old_q, position=0, option_text='Historical selection', is_correct=False)
        attempt = QuizAttempt(user_id=ids[0], quiz_id=quiz.id, score=0, passed=False)
        db.add_all([option, attempt])
        db.commit()
        option_id, attempt_id, quiz_id = option.id, attempt.id, quiz.id
    ready, release, insert_started = Event(), Event(), Event()
    pids = {}
    answer_id = uuid.uuid4()

    def cleanup():
        with Session(engine) as db:
            connection = db.connection()
            pids['cleanup'] = db.scalar(select(func.pg_backend_pid()))
            def pause_before_delete(conn, cursor, statement, parameters, context, executemany):
                if statement.lstrip().startswith('DELETE FROM questions'):
                    ready.set()
                    assert release.wait(10)
            event.listen(connection, 'before_cursor_execute', pause_before_delete)
            try:
                AdminQuizRepository(db)._delete_unused_questions([old_q])
                db.commit()
            finally:
                event.remove(connection, 'before_cursor_execute', pause_before_delete)

    def insert_answer():
        with Session(engine) as db:
            pids['answer'] = db.scalar(select(func.pg_backend_pid()))
            insert_started.set()
            db.add(QuizAttemptAnswer(id=answer_id, attempt_id=attempt_id, question_id=other_q,
                                     selected_option_id=option_id, is_correct=False))
            try:
                db.commit()
                return 'committed'
            except IntegrityError:
                db.rollback()
                return 'rejected'

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(cleanup)
            try:
                assert ready.wait(10)
                second = pool.submit(insert_answer)
                assert insert_started.wait(10)
                blocked = False
                deadline = monotonic() + 5
                with engine.connect() as observer:
                    while monotonic() < deadline:
                        blocked = observer.scalar(text('SELECT wait_event_type FROM pg_stat_activity WHERE pid=:pid'),
                                                  {'pid': pids['answer']}) == 'Lock'
                        observer.commit()  # fresh pg_stat_activity snapshot
                        if blocked:
                            break
                assert blocked, 'Option-only history insertion did not wait for cleanup row locks'
            finally:
                release.set()
            first.result(timeout=10)
            assert second.result(timeout=10) == 'rejected'
        assert len(set(pids.values())) == 2
        with Session(engine) as db:
            assert db.get(QuizAttemptAnswer, answer_id) is None
            assert db.get(Question, old_q) is None
            assert db.get(QuestionOption, option_id) is None
    finally:
        release.set()
        with Session(engine) as db:
            db.execute(delete(Quiz).where(Quiz.id == quiz_id))
            db.execute(delete(Question).where(Question.id.in_([old_q, other_q])))
            db.commit()


@pytest.mark.parametrize('conflict', [False, True])
def test_concurrent_corrected_submissions_create_one_successor(committed_governance, conflict):
    from datetime import datetime, timezone
    ids, _, _, certid = committed_governance
    with Session(engine) as db:
        previous = CertificationRequest(user_id=ids[0], certification_id=certid, statement='Original',
                    evidence_ids=[], evidence_snapshot=[], status='REJECTED', reason='Correct the dossier',
                    decided_by=ids[2], decided_at=datetime.now(timezone.utc))
        db.add(previous)
        db.commit()
        previous_id = previous.id
    payload = {'certification_id': certid, 'previous_request_id': str(previous_id), 'statement': 'Corrected dossier'}
    responses = simultaneous([
        ('POST', '/api/me/certification-requests', ids[0], UserRole.LEARNER, payload),
        ('POST', '/api/me/certification-requests', ids[0], UserRole.LEARNER,
         {**payload, 'statement': 'Different corrected dossier' if conflict else 'Corrected dossier'}),
    ])
    assert sorted(code for code, _ in responses) == ([200, 409] if conflict else [200, 200])
    with Session(engine) as db:
        old = db.get(CertificationRequest, previous_id)
        assert old.status == 'REJECTED' and old.statement == 'Original' and old.reason == 'Correct the dossier'
        rows = db.scalars(select(CertificationRequest).where(CertificationRequest.user_id == ids[0])).all()
        assert len(rows) == 2
        new = next(row for row in rows if row.id != previous_id)
        assert new.previous_request_id == previous_id and new.status == 'SUBMITTED'
        assert db.scalar(select(func.count()).select_from(OfficialCertificate)) == 0
    if not conflict:
        assert responses[0][1]['id'] == responses[1][1]['id']


def test_corrected_retry_racing_approval_never_creates_another_dossier(committed_governance):
    from datetime import datetime, timezone
    ids, _, _, certid = committed_governance
    with Session(engine) as db:
        old = CertificationRequest(user_id=ids[0], certification_id=certid, statement='Original',
                    evidence_ids=[], evidence_snapshot=[], status='REJECTED', reason='Correct',
                    decided_by=ids[2], decided_at=datetime.now(timezone.utc))
        db.add(old)
        db.flush()
        current = CertificationRequest(user_id=ids[0], certification_id=certid, statement='Corrected dossier',
                    evidence_ids=[], evidence_snapshot=[], previous_request_id=old.id)
        db.add(current)
        db.commit()
        old_id, current_id = old.id, current.id
    responses = simultaneous([
        ('POST', '/api/me/certification-requests', ids[0], UserRole.LEARNER,
         {'certification_id': certid, 'previous_request_id': str(old_id), 'statement': 'Corrected dossier'}),
        ('POST', f'/api/admin/certification-requests/{current_id}/decision', ids[2], UserRole.SUPER_ADMIN,
         {'decision': 'APPROVED', 'reason': 'CASA reviewed'}),
    ])
    assert [code for code, _ in responses] == [200, 200]
    assert responses[0][1]['id'] == str(current_id)
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(CertificationRequest)) == 2
        assert db.get(CertificationRequest, old_id).status == 'REJECTED'
        assert db.get(CertificationRequest, current_id).status == 'APPROVED'
        assert db.scalar(select(func.count()).select_from(OfficialCertificate)) == 1


def test_concurrent_new_dossiers_after_approval_are_both_refused(committed_governance):
    from datetime import datetime, timezone
    ids, _, _, certid = committed_governance
    with Session(engine) as db:
        approved = CertificationRequest(user_id=ids[0], certification_id=certid, statement='Approved',
                    evidence_ids=[], evidence_snapshot=[], status='APPROVED', reason='CASA approved',
                    decided_by=ids[2], decided_at=datetime.now(timezone.utc))
        db.add(approved)
        db.flush()
        db.add(OfficialCertificate(request_id=approved.id))
        db.commit()
        approved_id = approved.id
    payload = {'certification_id': certid, 'previous_request_id': str(approved_id), 'statement': 'Forbidden new dossier'}
    responses = simultaneous([('POST', '/api/me/certification-requests', ids[0], UserRole.LEARNER, payload)] * 2)
    assert [code for code, _ in responses] == [409, 409]
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(CertificationRequest)) == 1
        assert db.scalar(select(func.count()).select_from(OfficialCertificate)) == 1


@pytest.mark.parametrize('change', ['suspend', 'promote'])
def test_approval_waits_for_applicant_change_and_rechecks_committed_state(committed_governance, change):
    from threading import Event
    from time import monotonic
    from sqlalchemy import update, text
    ids, _, _, certid = committed_governance
    with Session(engine) as db:
        request = CertificationRequest(user_id=ids[0], certification_id=certid, statement='Synthetic',
                                       evidence_ids=[], evidence_snapshot=[])
        db.add(request)
        db.commit()
        request_id = request.id
    authenticated = Event()
    pids = {}
    app = FastAPI()
    app.include_router(certification_requests.router)
    def caller(credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme), db: Session = Depends(get_db)):
        user = get_current_user(credentials, db)
        pids['approval'] = db.scalar(select(func.pg_backend_pid()))
        authenticated.set()
        return user
    app.dependency_overrides[get_current_user] = caller
    def approve():
        with TestClient(app) as client:
            return client.post(f'/api/admin/certification-requests/{request_id}/decision',
                headers={'Authorization': 'Bearer ' + create_access_token(ids[2], UserRole.SUPER_ADMIN.value)},
                json={'decision': 'APPROVED', 'reason': 'CASA review'})
    with Session(engine) as changer:
        pids['change'] = changer.scalar(select(func.pg_backend_pid()))
        value = {'status': AccountStatus.SUSPENDED} if change == 'suspend' else {'role': UserRole.ADMIN}
        changer.execute(update(User).where(User.id == ids[0]).values(**value))
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(approve)
            try:
                assert authenticated.wait(10)
                blocked = False
                deadline = monotonic() + 5
                with engine.connect() as observer:
                    while monotonic() < deadline and not future.done():
                        blocked = observer.scalar(text('SELECT wait_event_type FROM pg_stat_activity WHERE pid=:pid'),
                                                  {'pid': pids['approval']}) == 'Lock'
                        observer.commit()
                        if blocked:
                            break
                assert blocked, 'Approval did not serialize with applicant mutation'
            finally:
                changer.commit()
            response = future.result(timeout=10)
        assert response.status_code == 409, response.text
    assert len(set(pids.values())) == 2
    with Session(engine) as db:
        assert db.get(CertificationRequest, request_id).status == 'SUBMITTED'
        assert db.scalar(select(func.count()).select_from(OfficialCertificate)) == 0


@pytest.mark.parametrize('change', ['suspend', 'demote', 'delete'])
@pytest.mark.parametrize('decision', ['APPROVED', 'REJECTED'])
@pytest.mark.parametrize('terminal', [False, True])
@pytest.mark.parametrize('wait_lock', ['subject', 'reviewer_row'])
def test_reviewer_revocation_while_decision_waits_rejects_stale_authorization(committed_governance, change, decision, terminal, wait_lock):
    from datetime import datetime, timezone
    from threading import Event
    from time import monotonic
    from sqlalchemy import text, update
    from app.db.locks import transaction_lock
    from app.schemas.admin import AdminUserUpdateRequest
    from app.services.admin_user_service import AdminUserService
    ids, _, _, certid = committed_governance
    with Session(engine) as db:
        item = CertificationRequest(user_id=ids[0], certification_id=certid, statement='Synthetic',
                                    evidence_ids=[], evidence_snapshot=[])
        if terminal:
            item.status, item.reason = decision, 'Synthetic CASA review'
            item.decided_by, item.decided_at = ids[3], datetime.now(timezone.utc)
        db.add(item)
        db.flush()
        if terminal and decision == 'APPROVED':
            db.add(OfficialCertificate(request_id=item.id))
        db.commit()
        request_id = item.id
    authenticated = Event()
    pids = {}
    app = FastAPI()
    app.include_router(certification_requests.router)
    def caller(credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme), db: Session = Depends(get_db)):
        user = get_current_user(credentials, db)
        pids['decision'] = db.scalar(select(func.pg_backend_pid()))
        authenticated.set()
        return user
    app.dependency_overrides[get_current_user] = caller
    def decide():
        with TestClient(app) as client:
            return client.post(f'/api/admin/certification-requests/{request_id}/decision',
                headers={'Authorization': 'Bearer ' + create_access_token(ids[2], UserRole.SUPER_ADMIN.value)},
                json={'decision': decision, 'reason': 'Synthetic CASA review'})
    with Session(engine) as changer:
        pids['change'] = changer.scalar(select(func.pg_backend_pid()))
        value = {'status': AccountStatus.SUSPENDED} if change == 'suspend' else {'role': UserRole.ADMIN}
        if wait_lock == 'subject':
            transaction_lock(changer, f'casa:certification-request:{ids[0]}:{certid}')
        elif change == 'delete':
            changer.execute(delete(User).where(User.id == ids[2]))
        else:
            changer.execute(update(User).where(User.id == ids[2]).values(**value))
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(decide)
            try:
                assert authenticated.wait(10)
                blocked = False
                deadline = monotonic() + 5
                with engine.connect() as observer:
                    while monotonic() < deadline and not future.done():
                        blocked = observer.scalar(text('SELECT wait_event_type FROM pg_stat_activity WHERE pid=:pid'),
                                                  {'pid': pids['decision']}) == 'Lock'
                        observer.commit()
                        if blocked:
                            break
                assert blocked, 'Decision did not wait after authenticating the reviewer'
                if wait_lock == 'reviewer_row':
                    changer.commit()
                else:
                    service = AdminUserService(changer)
                    actor = changer.get(User, ids[3])
                    if change == 'delete':
                        service.delete_user(actor=actor, target_id=ids[2])
                    else:
                        service.update_user(actor=actor, target_id=ids[2], payload=AdminUserUpdateRequest(**value))
            finally:
                changer.rollback()  # release the wait even if a setup assertion fails
            response = future.result(timeout=10)
        assert response.status_code == (403 if change == 'demote' else 401), response.text
    assert len(set(pids.values())) == 2
    with Session(engine) as db:
        item = db.get(CertificationRequest, request_id)
        assert item.status == (decision if terminal else 'SUBMITTED')
        assert item.decided_by == (ids[3] if terminal else None)
        assert (item.decided_at is not None) == terminal
        assert db.scalar(select(func.count()).select_from(OfficialCertificate)) == int(terminal and decision == 'APPROVED')


def test_reciprocal_reviewers_on_promoted_applicant_dossiers_do_not_deadlock(committed_governance):
    ids, _, _, certid = committed_governance
    with Session(engine) as db:
        requests = [CertificationRequest(user_id=uid, certification_id=certid, statement='Before promotion',
                                         evidence_ids=[], evidence_snapshot=[]) for uid in ids[2:]]
        db.add_all(requests)
        db.commit()
        request_ids = [item.id for item in requests]
    responses = simultaneous([
        ('POST', f'/api/admin/certification-requests/{request_ids[0]}/decision', ids[3], UserRole.SUPER_ADMIN,
         {'decision': 'APPROVED', 'reason': 'Synthetic review'}),
        ('POST', f'/api/admin/certification-requests/{request_ids[1]}/decision', ids[2], UserRole.SUPER_ADMIN,
         {'decision': 'APPROVED', 'reason': 'Synthetic review'}),
    ])
    assert [code for code, _ in responses] == [409, 409]
    with Session(engine) as db:
        assert all(db.get(CertificationRequest, rid).status == 'SUBMITTED' for rid in request_ids)
        assert db.scalar(select(func.count()).select_from(OfficialCertificate)) == 0


@pytest.mark.parametrize('change', ['suspend', 'demote', 'delete'])
def test_reviewer_revocation_waits_until_in_flight_approval_commits(committed_governance, change):
    from threading import Event
    from time import monotonic
    from sqlalchemy import event, text
    from app.schemas.admin import AdminUserUpdateRequest
    from app.schemas.governance import DecisionIn
    from app.services.admin_user_service import AdminUserService
    ids, _, _, certid = committed_governance
    with Session(engine) as db:
        item = CertificationRequest(user_id=ids[0], certification_id=certid, statement='Synthetic',
                                    evidence_ids=[], evidence_snapshot=[])
        db.add(item)
        db.commit()
        request_id = item.id
    ready, release, mutation_started = Event(), Event(), Event()
    pids = {}
    def approve():
        with Session(engine) as db:
            connection = db.connection()
            pids['approval'] = db.scalar(select(func.pg_backend_pid()))
            def pause(conn, cursor, statement, parameters, context, executemany):
                if statement.lstrip().startswith('INSERT INTO official_certificates'):
                    ready.set()
                    assert release.wait(10)
            event.listen(connection, 'before_cursor_execute', pause)
            try:
                result = certification_requests.decide(request_id,
                    DecisionIn(decision='APPROVED', reason='Synthetic CASA review'), db, db.get(User, ids[2]))
                return result.status
            finally:
                event.remove(connection, 'before_cursor_execute', pause)
    def revoke():
        with Session(engine) as db:
            pids['mutation'] = db.scalar(select(func.pg_backend_pid()))
            mutation_started.set()
            service, actor = AdminUserService(db), db.get(User, ids[3])
            if change == 'delete':
                service.delete_user(actor=actor, target_id=ids[2])
            else:
                value = {'status': AccountStatus.SUSPENDED} if change == 'suspend' else {'role': UserRole.ADMIN}
                service.update_user(actor=actor, target_id=ids[2], payload=AdminUserUpdateRequest(**value))
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(approve)
        try:
            assert ready.wait(10)
            second = pool.submit(revoke)
            assert mutation_started.wait(10)
            blocked = False
            deadline = monotonic() + 5
            with engine.connect() as observer:
                while monotonic() < deadline and not second.done():
                    blocked = observer.scalar(text('SELECT wait_event_type FROM pg_stat_activity WHERE pid=:pid'),
                                              {'pid': pids['mutation']}) == 'Lock'
                    observer.commit()
                    if blocked:
                        break
            assert blocked, 'Revocation crossed the reviewer lock before approval committed'
        finally:
            release.set()
        assert first.result(timeout=10) == 'APPROVED'
        second.result(timeout=10)
    assert len(set(pids.values())) == 2
    with Session(engine) as db:
        item = db.get(CertificationRequest, request_id)
        assert item.status == 'APPROVED' and item.decided_by == (None if change == 'delete' else ids[2])
        assert db.scalar(select(func.count()).select_from(OfficialCertificate)) == 1
        reviewer = db.get(User, ids[2])
        assert reviewer is None if change == 'delete' else (
            reviewer.status == AccountStatus.SUSPENDED if change == 'suspend' else reviewer.role == UserRole.ADMIN)
