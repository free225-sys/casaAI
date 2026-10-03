"""Synthetic PDF -> HTTP preview/import -> PostgreSQL -> learner document."""
import pytest
from sqlalchemy import func, select

from app.core.security import create_access_token
from app.models.catalog import School
from app.models.content import Course, Lesson
from app.models.document import DocumentSection
from app.models.enums import ContentStatus, UserRole
from app.models.user import User
from tests.pdf_fixtures import ALL_FIXTURES
from tests.test_learning_native import require_disposable_database  # noqa: F401


@pytest.mark.parametrize("fixture_name", sorted(ALL_FIXTURES))
def test_synthetic_preview_import_and_learner_read(client, db_session, fixture_name):
    user = User(first_name="PDF", last_name="Synthetic", email="pdf-roundtrip@example.com",
                password_hash="unused-synthetic-hash", role=UserRole.ADMIN)
    db_session.add(user)
    db_session.add(School(id="pdf-roundtrip-school", name="Synthetic", short_name="PDF", color="#000000"))
    db_session.commit()
    auth = {"Authorization": f"Bearer {create_access_token(user.id, user.role.value)}"}
    data = ALL_FIXTURES[fixture_name]()
    upload = {"file": (f"{fixture_name}.pdf", data, "application/pdf")}
    before = db_session.scalar(select(func.count()).select_from(Course))
    preview = client.post("/api/admin/courses/preview-pdf", headers=auth, files=upload)
    assert preview.status_code == 200
    assert db_session.scalar(select(func.count()).select_from(Course)) == before
    imported = client.post("/api/admin/courses/import-pdf", headers=auth, files=upload,
                           data={"school_id": "pdf-roundtrip-school", "create_course": "true"})
    assert imported.status_code == 201
    result = imported.json()
    assert result["title"] == preview.json()["title"]
    assert result["pages_extracted"] == preview.json()["pages"]
    assert result["report"] == preview.json()["report"]
    assert db_session.scalar(select(func.count()).select_from(Course)) == before + 1
    assert db_session.scalar(select(func.count()).select_from(DocumentSection)) > 0
    # Publish only the synthetic imported content before the learner read.
    db_session.get(Course, result["course_id"]).status = ContentStatus.PUBLISHED
    db_session.get(Lesson, result["lesson_id"]).status = ContentStatus.PUBLISHED
    user.role = UserRole.LEARNER
    db_session.commit()
    auth = {"Authorization": f"Bearer {create_access_token(user.id, user.role.value)}"}
    document = client.get(f"/api/lessons/{result['lesson_id']}/document", headers=auth)
    assert document.status_code == 200
    assert document.json()["source_file"] == f"{fixture_name}.pdf"
    assert document.json()["page_count"] == preview.json()["pages"]
    assert [section["title"] for section in document.json()["sections"]] == [section["title"] for section in preview.json()["sections"]]
