import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api.deps import require_content_admin, require_super_admin
from app.db.session import get_db
from app.models.catalog import School
from app.models.content import Pathway
from app.models.enums import UserRole
from app.models.governance import AdminScope
from app.models.user import User
from app.schemas.governance import ScopeReplacement, ScopesOut, AdminPathwayReferenceListOut
from app.services.content_scope_service import ContentScopeService

router = APIRouter(prefix="/api/admin", tags=["admin-scopes"])


@router.get("/pathways", response_model=AdminPathwayReferenceListOut)
def pathway_references(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0),
                       db: Session = Depends(get_db), actor: User = Depends(require_content_admin)):
    query = select(Pathway)
    if actor.role != UserRole.SUPER_ADMIN:
        query = query.where(Pathway.id.in_(select(AdminScope.pathway_id).where(
            AdminScope.user_id == actor.id, AdminScope.pathway_id.is_not(None))))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = list(db.scalars(query.order_by(Pathway.title, Pathway.id).limit(limit).offset(offset)))
    return AdminPathwayReferenceListOut(items=items, total=total, limit=limit, offset=offset)


def output(db, target):
    grants = db.scalars(select(AdminScope).where(AdminScope.user_id == target.id).order_by(AdminScope.assigned_at, AdminScope.id)).all()
    return ScopesOut(school_ids=sorted(g.school_id for g in grants if g.school_id),
                     pathway_ids=sorted(g.pathway_id for g in grants if g.pathway_id),
                     grants=grants, global_access=target.role == UserRole.SUPER_ADMIN)


def find_admin(db, user_id):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "Utilisateur introuvable.")
    if target.role != UserRole.ADMIN:
        raise HTTPException(409, "Les affectations concernent uniquement les comptes ADMIN.")
    return target


@router.get("/me/scopes", response_model=ScopesOut)
def my_scopes(db: Session = Depends(get_db), actor: User = Depends(require_content_admin)):
    return output(db, actor)


@router.get("/users/{user_id}/scopes", response_model=ScopesOut)
def user_scopes(user_id: uuid.UUID, db: Session = Depends(get_db), actor: User = Depends(require_super_admin)):
    return output(db, find_admin(db, user_id))


@router.put("/users/{user_id}/scopes", response_model=ScopesOut)
def assign_scopes(user_id: uuid.UUID, payload: ScopeReplacement, db: Session = Depends(get_db), actor: User = Depends(require_super_admin)):
    ContentScopeService(db, actor).lock_mutation()
    target = find_admin(db, user_id)
    school_ids, pathway_ids = set(payload.school_ids), set(payload.pathway_ids)
    if any(db.get(School, sid) is None for sid in school_ids) or any(db.get(Pathway, pid) is None for pid in pathway_ids):
        raise HTTPException(422, "École ou parcours introuvable.")
    current = output(db, target)
    if set(current.school_ids) == school_ids and set(current.pathway_ids) == pathway_ids:
        return current
    db.execute(delete(AdminScope).where(AdminScope.user_id == target.id))
    db.add_all([AdminScope(user_id=target.id, school_id=sid, assigned_by=actor.id) for sid in sorted(school_ids)])
    db.add_all([AdminScope(user_id=target.id, pathway_id=pid, assigned_by=actor.id) for pid in sorted(pathway_ids)])
    db.commit()
    return output(db, target)
