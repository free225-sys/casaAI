"""CASA decision workflow. Scores never issue an official certificate."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_learner, require_super_admin
from app.db.locks import transaction_lock
from app.db.session import get_db
from app.models.certification import Certification
from app.models.enums import AccountStatus, ContentStatus, UserRole
from app.models.governance import CertificationRequest, OfficialCertificate
from app.models.progress import PortfolioEvidence
from app.models.user import User
from app.schemas.governance import (CertificationRequestIn, CertificationRequestOut, DecisionIn, RequestListOut,
                                    AdminCertificationRequestOut, AdminRequestListOut)

router = APIRouter(prefix="/api", tags=["certification-requests"])


def display_name(first, last):
    return " ".join(part.strip() for part in (first, last) if part and part.strip()) or None


def request_out(db, item, *, admin=False):
    result = (AdminCertificationRequestOut if admin else CertificationRequestOut).model_validate(item)
    result.official_certificate_id = db.scalar(select(OfficialCertificate.id).where(OfficialCertificate.request_id == item.id))
    if admin:
        names = db.execute(select(User.first_name, User.last_name).where(User.id == item.user_id)).one_or_none()
        result.applicant_display_name = display_name(*names) if names else None
    return result


def find_request(db, request_id, user_id=None):
    query = select(CertificationRequest).where(CertificationRequest.id == request_id)
    if user_id is not None:
        query = query.where(CertificationRequest.user_id == user_id)
    item = db.scalar(query.execution_options(populate_existing=True))
    if item is None:
        raise HTTPException(404, "Demande introuvable.")
    return item


def list_requests(db, user_id, state, limit, offset, *, admin=False):
    query = select(CertificationRequest)
    if user_id is not None:
        query = query.where(CertificationRequest.user_id == user_id)
    if state is not None:
        query = query.where(CertificationRequest.status == state)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    query = query.add_columns(OfficialCertificate.id).outerjoin(
        OfficialCertificate, OfficialCertificate.request_id == CertificationRequest.id)
    if admin:
        query = query.add_columns(User.first_name, User.last_name).join(User, User.id == CertificationRequest.user_id)
    rows = db.execute(query.order_by(CertificationRequest.submitted_at.desc(), CertificationRequest.id).limit(limit).offset(offset)).all()
    items = []
    for row in rows:
        item, receipt_id = row[:2]
        out = (AdminCertificationRequestOut if admin else CertificationRequestOut).model_validate(item)
        out.official_certificate_id = receipt_id
        if admin:
            out.applicant_display_name = display_name(*row[2:])
        items.append(out)
    return (AdminRequestListOut if admin else RequestListOut)(items=items, total=total, limit=limit, offset=offset)


@router.post("/me/certification-requests", response_model=CertificationRequestOut)
def submit_request(payload: CertificationRequestIn, db: Session = Depends(get_db), user: User = Depends(require_learner)):
    transaction_lock(db, f"casa:certification-request:{user.id}:{payload.certification_id}")
    current = db.scalar(select(User).where(User.id == user.id).with_for_update().execution_options(populate_existing=True))
    if current is None or current.status != AccountStatus.ACTIVE:
        raise HTTPException(401, "Compte inactif ou introuvable.")
    if current.role != UserRole.LEARNER:
        raise HTTPException(403, "Les demandes personnelles sont réservées aux apprenants.")
    subject = select(CertificationRequest).where(CertificationRequest.user_id == user.id,
                                               CertificationRequest.certification_id == payload.certification_id)
    previous = None
    if payload.previous_request_id is not None:
        previous = find_request(db, payload.previous_request_id, user.id)
        if previous.certification_id != payload.certification_id:
            raise HTTPException(404, "Demande précédente introuvable pour cette certification.")
    existing = db.scalar(subject.where(CertificationRequest.previous_request_id == payload.previous_request_id))
    ids = sorted({str(eid) for eid in payload.evidence_ids})
    if existing is not None:
        if existing.statement != payload.statement or existing.evidence_ids != ids:
            raise HTTPException(409, "Une demande existe déjà pour cette certification.")
        return request_out(db, existing)
    if previous is not None:
        if previous.status != "REJECTED":
            raise HTTPException(409, "Une nouvelle demande nécessite un dossier précédent refusé.")
        if db.scalar(subject.where(CertificationRequest.status != "REJECTED")) is not None:
            raise HTTPException(409, "Une demande active ou approuvée existe déjà pour cette certification.")
    cert = db.scalar(select(Certification).where(Certification.id == payload.certification_id).with_for_update().execution_options(populate_existing=True))
    if cert is None or cert.status != ContentStatus.PUBLISHED:
        raise HTTPException(404, "Certification introuvable.")
    evidence = db.scalars(select(PortfolioEvidence).where(
        PortfolioEvidence.id.in_([uuid.UUID(eid) for eid in ids]), PortfolioEvidence.user_id == user.id).with_for_update()).all()
    if len(evidence) != len(ids):
        raise HTTPException(404, "Preuve introuvable.")
    snapshots = [{key: getattr(item, key) for key in (
        "title", "context", "problem", "role", "deliverable", "result", "metrics", "feedback")}
        | {"id": str(item.id)} for item in sorted(evidence, key=lambda item: str(item.id))]
    if previous is not None and previous.statement == payload.statement and previous.evidence_ids == ids:
        old_snapshot = sorted(previous.evidence_snapshot, key=lambda item: str(item.get("id", "")))
        if old_snapshot == snapshots:
            raise HTTPException(409, "Corrigez la déclaration ou les preuves avant de créer un nouveau dossier.")
    item = CertificationRequest(user_id=user.id, certification_id=cert.id, statement=payload.statement,
                                evidence_ids=ids, evidence_snapshot=snapshots, previous_request_id=payload.previous_request_id,
                                submitted_at=datetime.now(timezone.utc))
    db.add(item)
    db.commit()
    db.refresh(item)
    return request_out(db, item)


@router.get("/me/certification-requests", response_model=RequestListOut)
def my_requests(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0),
                db: Session = Depends(get_db), user: User = Depends(require_learner)):
    return list_requests(db, user.id, None, limit, offset)


@router.get("/me/certification-requests/{request_id}", response_model=CertificationRequestOut)
def my_request(request_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_learner)):
    return request_out(db, find_request(db, request_id, user.id))


@router.get("/admin/certification-requests", response_model=AdminRequestListOut)
def admin_requests(state: str | None = Query(None, pattern="^(SUBMITTED|APPROVED|REJECTED)$"),
                   limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0),
                   db: Session = Depends(get_db), user: User = Depends(require_super_admin)):
    return list_requests(db, None, state, limit, offset, admin=True)


@router.get("/admin/certification-requests/{request_id}", response_model=AdminCertificationRequestOut)
def admin_request(request_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_super_admin)):
    return request_out(db, find_request(db, request_id), admin=True)


@router.post("/admin/certification-requests/{request_id}/decision", response_model=AdminCertificationRequestOut)
def decide(request_id: uuid.UUID, payload: DecisionIn, db: Session = Depends(get_db), user: User = Depends(require_super_admin)):
    # Submission and decision share the subject lock; old decisions stay immutable.
    item = find_request(db, request_id)
    transaction_lock(db, f"casa:certification-request:{item.user_id}:{item.certification_id}")
    transaction_lock(db, f"casa:certification-decision:{request_id}")
    item = find_request(db, request_id)
    if item.user_id == user.id:
        raise HTTPException(403, "Vous ne pouvez pas examiner votre propre demande.")
    if item.status != "SUBMITTED":
        if item.status != payload.decision or item.reason != payload.reason:
            raise HTTPException(409, "Cette demande a déjà fait l'objet d'une décision définitive.")
        return request_out(db, item, admin=True)
    if payload.decision == "APPROVED":
        # Role changes/suspensions apply at the moment of official issuance too.
        applicant = db.scalar(select(User).where(User.id == item.user_id).with_for_update().execution_options(populate_existing=True))
        cert = db.scalar(select(Certification).where(Certification.id == item.certification_id).with_for_update().execution_options(populate_existing=True))
        if applicant.role != UserRole.LEARNER or applicant.status != AccountStatus.ACTIVE:
            raise HTTPException(409, "Le demandeur doit être un apprenant actif.")
        if cert.status != ContentStatus.PUBLISHED:
            raise HTTPException(409, "La certification doit être publiée.")
        db.add(OfficialCertificate(request_id=item.id))
    item.status = payload.decision
    item.reason = payload.reason
    item.decided_by = user.id
    item.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return request_out(db, item, admin=True)
