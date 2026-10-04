"""Staff preview reads authorized draft content without learning side effects."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.admin_content import _lesson_to_out
from app.api.admin_quiz import _quiz_to_out
from app.api.deps import require_content_admin
from app.api.progress import _document_section
from app.db.session import get_db
from app.models.user import User
from app.repositories.admin_content_repository import AdminContentRepository
from app.repositories.admin_quiz_repository import AdminQuizRepository
from app.repositories.document_structure_repository import DocumentStructureRepository
from app.schemas.admin import AdminLessonOut, AdminQuizOut
from app.schemas.progress import LessonDocumentOut
from app.services.content_scope_service import ContentScopeService

router = APIRouter(prefix="/api/admin/preview", tags=["admin-preview"])


@router.get("/lessons/{lesson_id}", response_model=AdminLessonOut)
def preview_lesson(lesson_id: str, db: Session = Depends(get_db), actor: User = Depends(require_content_admin)):
    ContentScopeService(db, actor).lesson(lesson_id)
    return _lesson_to_out(AdminContentRepository(db).get_lesson_any_status(lesson_id))


@router.get("/lessons/{lesson_id}/document", response_model=LessonDocumentOut)
def preview_document(lesson_id: str, db: Session = Depends(get_db), actor: User = Depends(require_content_admin)):
    ContentScopeService(db, actor).lesson(lesson_id)
    repo = DocumentStructureRepository(db)
    doc = repo.get_document_for_lesson(lesson_id)
    if doc is None:
        raise HTTPException(404, "Structure documentaire introuvable.")
    return LessonDocumentOut(source_file=doc.source_file, page_count=doc.page_count,
                             sections=[_document_section(root) for root in repo.get_tree(doc.id)])


@router.get("/quizzes/{quiz_id}", response_model=AdminQuizOut)
def preview_quiz(quiz_id: uuid.UUID, db: Session = Depends(get_db), actor: User = Depends(require_content_admin)):
    scope = ContentScopeService(db, actor)
    quiz = scope.quiz(quiz_id)
    return _quiz_to_out(quiz, AdminQuizRepository(db).get_quiz_questions(quiz_id))
