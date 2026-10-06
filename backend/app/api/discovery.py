"""Public discovery metadata and scoped administration of lesson notions."""
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import require_content_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.discovery import (
    AdminKnowledgeNodePage, DiscoveryErrorOut, DiscoveryLinksOut, LessonKnowledgeNodesOut, LessonKnowledgeNodesReplacement,
)
from app.services import discovery_service
from app.services.content_scope_service import ContentScopeService


router = APIRouter(prefix="/api", tags=["discovery"])
AUTH_ERRORS = {code: {"model": DiscoveryErrorOut} for code in (401, 403)}
LESSON_ERRORS = {**AUTH_ERRORS, 404: {"model": DiscoveryErrorOut}}


@router.get("/discoveries/{discovery_key}/links", response_model=DiscoveryLinksOut,
            responses={404: {"model": DiscoveryErrorOut}, 200: {"headers": {
                "Cache-Control": {"schema": {"type": "string", "const": "no-store"}}}}})
def discovery_links(discovery_key: str, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return discovery_service.public_links(db, discovery_key)


@router.get("/admin/knowledge-nodes", response_model=AdminKnowledgeNodePage, responses=AUTH_ERRORS)
def admin_knowledge_nodes(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0),
                          db: Session = Depends(get_db), _admin: User = Depends(require_content_admin)):
    return discovery_service.reference_page(db, limit, offset)


@router.get("/admin/lessons/{lesson_id}/knowledge-nodes", response_model=LessonKnowledgeNodesOut, responses=LESSON_ERRORS)
def lesson_knowledge_nodes(lesson_id: str, db: Session = Depends(get_db),
                           admin: User = Depends(require_content_admin)):
    lesson = ContentScopeService(db, admin).lesson(lesson_id)
    return discovery_service.association_state(db, lesson)


@router.put("/admin/lessons/{lesson_id}/knowledge-nodes", response_model=LessonKnowledgeNodesOut,
            responses={**LESSON_ERRORS, 409: {"model": DiscoveryErrorOut}, 422: {
                "description": "Validation du corps ou notion inexistante, sans mutation",
                "content": {"application/json": {"schema": {"type": "object", "required": ["detail"],
                    "properties": {"detail": {"oneOf": [{"type": "string"}, {"type": "array", "items": {"type": "object"}}]}}}}}}})
def replace_lesson_knowledge_nodes(lesson_id: str, payload: LessonKnowledgeNodesReplacement,
                                   db: Session = Depends(get_db), admin: User = Depends(require_content_admin)):
    return discovery_service.replace_associations(db, admin, lesson_id, payload)
