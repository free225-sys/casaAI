import uuid

import pytest
from sqlalchemy import func, select

from app.core.security import create_access_token
from app.models.catalog import School, Skill
from app.models.content import Course, Lesson, Pathway, pathway_courses
from app.models.enums import AccountStatus, ContentStatus, QuizKind, UserRole
from app.models.governance import AdminScope
from app.models.quiz import Quiz, Question, QuestionOption, quiz_questions
from app.models.progress import UserLessonProgress, QuizAttempt, LabResult, PortfolioEvidence
from app.models.badge import UserBadge
from app.models.notification import Notification
from app.models.user import User


def headers(user):
    return {"Authorization": "Bearer " + create_access_token(user.id, user.role.value)}


@pytest.fixture
def scoped(db_session):
    users = {}
    for name, role in (("admin", UserRole.ADMIN), ("super", UserRole.SUPER_ADMIN), ("learner", UserRole.LEARNER)):
        user = User(first_name=name, last_name="Synthetic", email=f"{uuid.uuid4()}@example.com",
                    password_hash="unused-fixture", role=role, status=AccountStatus.ACTIVE)
        db_session.add(user)
        users[name] = user
    for sid in ("scope-a", "scope-b"):
        db_session.add(School(id=sid, name=sid, short_name=sid, color="#000000"))
    db_session.add_all([Pathway(id="scope-p1", title="First"), Pathway(id="scope-p2", title="Second")])
    db_session.flush()
    for sid in ("scope-a", "scope-b"):
        db_session.add(Skill(id=sid+"-skill", school_id=sid, name=sid))
    for cid, sid in (("scope-c1", "scope-a"), ("scope-c2", "scope-a"), ("scope-other", "scope-b"), ("scope-shared", "scope-b")):
        db_session.add(Course(id=cid, school_id=sid, title=cid, status=ContentStatus.PUBLISHED))
    db_session.flush()
    for cid in ("scope-c1", "scope-c2", "scope-other", "scope-shared"):
        db_session.add(Lesson(id=cid+"-lesson", course_id=cid, title=cid, status=ContentStatus.PUBLISHED))
    db_session.execute(pathway_courses.insert(), [
        {"pathway_id": "scope-p1", "course_id": "scope-c1", "position": 1},
        {"pathway_id": "scope-p1", "course_id": "scope-shared", "position": 2},
        {"pathway_id": "scope-p2", "course_id": "scope-shared", "position": 1},
    ])
    db_session.flush()
    quizzes = {}
    for name, kwargs in (("course", {"course_id": "scope-c1"}),
                         ("lesson", {"lesson_id": "scope-c1-lesson"}),
                         ("other", {"course_id": "scope-other"}),
                         ("practice", {"skill_id": "scope-a-skill"}),
                         ("mixed", {"course_id": "scope-c1", "lesson_id": "scope-other-lesson"}),
                         ("unattached", {})):
        quiz = Quiz(title=name, kind=QuizKind.PRACTICE, status=ContentStatus.PUBLISHED, **kwargs)
        db_session.add(quiz)
        quizzes[name] = quiz
    db_session.commit()
    return users, quizzes


def grant(client, scoped, schools=(), pathways=()):
    return client.put(f"/api/admin/users/{scoped[0]['admin'].id}/scopes", headers=headers(scoped[0]["super"]),
                      json={"school_ids": list(schools), "pathway_ids": list(pathways)})


def test_no_implicit_global_access_and_assignments_are_super_only(client, scoped):
    admin = headers(scoped[0]["admin"])
    for path in ("courses", "lessons", "quizzes"):
        body = client.get("/api/admin/" + path, headers=admin).json()
        assert body["total"] == 0 and body["items"] == []
    assert client.get("/api/admin/courses/scope-c1", headers=admin).status_code == 404
    assert client.put(f"/api/admin/users/{scoped[0]['admin'].id}/scopes", headers=admin,
                      json={"school_ids": ["scope-a"]}).status_code == 403
    assert client.get("/api/admin/me/scopes", headers=admin).json()["global_access"] is False
    assert client.get("/api/admin/me/scopes", headers=headers(scoped[0]["super"])).json()["global_access"] is True


def test_school_scope_filters_counts_before_pagination_and_all_quiz_parents(client, scoped):
    response = grant(client, scoped, schools=["scope-a"])
    assert response.status_code == 200, response.text
    assert response.json()["grants"][0]["assigned_by"] == str(scoped[0]["super"].id)
    auth = headers(scoped[0]["admin"])
    page1 = client.get("/api/admin/courses?limit=1", headers=auth).json()
    page2 = client.get("/api/admin/courses?limit=1&offset=1", headers=auth).json()
    assert page1["total"] == page2["total"] == 2
    assert page1["items"][0]["id"] != page2["items"][0]["id"]
    assert client.get("/api/admin/courses?school_id=scope-b", headers=auth).json()["total"] == 0
    lesson_ids = {item["id"] for item in client.get("/api/admin/lessons", headers=auth).json()["items"]}
    assert lesson_ids == {"scope-c1-lesson", "scope-c2-lesson"}
    quiz_names = {item["title"] for item in client.get("/api/admin/quizzes", headers=auth).json()["items"]}
    assert quiz_names == {"course", "lesson", "practice"}
    for name in ("other", "mixed", "unattached"):
        assert client.get(f"/api/admin/quizzes/{scoped[1][name].id}", headers=auth).status_code == 404


def test_pathway_inheritance_and_partial_shared_mutation_refused(client, scoped):
    assert grant(client, scoped, pathways=["scope-p1"]).status_code == 200
    auth = headers(scoped[0]["admin"])
    assert {item["id"] for item in client.get("/api/admin/courses", headers=auth).json()["items"]} == {"scope-c1", "scope-shared"}
    assert client.get("/api/admin/preview/lessons/scope-shared-lesson", headers=auth).status_code == 200
    assert client.put("/api/admin/courses/scope-c1", headers=auth,
                      json={"school_id": "scope-a", "title": "Updated"}).status_code == 200
    assert client.put("/api/admin/courses/scope-shared", headers=auth,
                      json={"school_id": "scope-b", "title": "Unsafe shared edit"}).status_code == 409
    assert client.get(f"/api/admin/quizzes/{scoped[1]['practice'].id}", headers=auth).status_code == 404


@pytest.mark.parametrize("schools,pathways", [([], ["scope-p1", "scope-p2"]), (["scope-b"], [])])
def test_shared_course_mutation_requires_all_paths_or_actual_school(client, scoped, schools, pathways):
    assert grant(client, scoped, schools=schools, pathways=pathways).status_code == 200
    auth = headers(scoped[0]["admin"])
    assert client.put("/api/admin/courses/scope-shared", headers=auth,
                      json={"school_id": "scope-b", "title": "Authorized shared edit"}).status_code == 200
    assert client.put("/api/admin/lessons/scope-shared-lesson", headers=auth,
                      json={"course_id": "scope-shared", "title": "Authorized child edit"}).status_code == 200


def test_unrelated_school_does_not_cover_shared_course(client, scoped):
    grant(client, scoped, schools=["scope-a"], pathways=["scope-p1"])
    assert client.put("/api/admin/courses/scope-shared", headers=headers(scoped[0]["admin"]),
                      json={"school_id": "scope-b", "title": "Out of scope"}).status_code == 409


def test_pathway_admin_can_create_only_in_explicit_assigned_pathway(client, scoped):
    grant(client, scoped, pathways=["scope-p1"])
    auth = headers(scoped[0]["admin"])
    body = {"school_id": "scope-a", "title": "New assigned course", "pathway_id": "scope-p1"}
    response = client.post("/api/admin/courses", headers=auth, json=body)
    assert response.status_code == 201, response.text
    cid = response.json()["id"]
    assert client.get("/api/admin/courses/" + cid, headers=auth).status_code == 200
    body["pathway_id"] = "scope-p2"
    assert client.post("/api/admin/courses", headers=auth, json=body).status_code == 404
    assert client.put("/api/admin/courses/scope-c1", headers=auth, json=body).status_code == 422


@pytest.mark.parametrize("method,name", [("PUT", "other"), ("DELETE", "other"), ("PUT", "course")])
def test_quiz_mutations_check_existing_and_new_parents(client, scoped, method, name):
    grant(client, scoped, schools=["scope-a"])
    payload = {"title": "Move across scope", "course_id": "scope-other", "kind": "FINAL"}
    response = client.request(method, f"/api/admin/quizzes/{scoped[1][name].id}",
                              headers=headers(scoped[0]["admin"]), json=payload)
    assert response.status_code == 404


@pytest.mark.parametrize("method,path,payload", [
    ("GET", "/api/admin/courses/scope-other", None),
    ("PUT", "/api/admin/courses/scope-other", {"school_id": "scope-a", "title": "Hijacked"}),
    ("DELETE", "/api/admin/courses/scope-other", None),
    ("POST", "/api/admin/courses", {"school_id": "scope-b", "title": "Unauthorized"}),
    ("GET", "/api/admin/lessons/scope-other-lesson", None),
    ("PUT", "/api/admin/lessons/scope-other-lesson", {"course_id": "scope-c1", "title": "Hijacked"}),
    ("PUT", "/api/admin/lessons/scope-c1-lesson", {"course_id": "scope-other", "title": "Moved out"}),
    ("DELETE", "/api/admin/lessons/scope-other-lesson", None),
    ("POST", "/api/admin/lessons", {"course_id": "scope-other", "title": "Unauthorized"}),
])
def test_objects_and_both_sides_of_reassignment_are_enforced(client, db_session, scoped, method, path, payload):
    grant(client, scoped, schools=["scope-a"])
    before = [(c.id, c.title, c.school_id) for c in db_session.scalars(select(Course)).all()]
    assert client.request(method, path, headers=headers(scoped[0]["admin"]), json=payload).status_code == 404
    db_session.expire_all()
    assert [(c.id, c.title, c.school_id) for c in db_session.scalars(select(Course)).all()] == before
    assert db_session.get(Lesson, "scope-c1-lesson").course_id == "scope-c1"


def test_scope_replacement_takes_effect_for_existing_token_and_is_idempotent(client, scoped):
    token = headers(scoped[0]["admin"])
    first = grant(client, scoped, schools=["scope-a"])
    assert grant(client, scoped, schools=["scope-a"]).json() == first.json()
    assert client.get("/api/admin/courses/scope-c1", headers=token).status_code == 200
    assert grant(client, scoped, schools=["missing"]).status_code == 422
    assert client.get("/api/admin/courses/scope-c1", headers=token).status_code == 200
    assert grant(client, scoped, schools=["scope-b"]).status_code == 200
    assert client.get("/api/admin/courses/scope-c1", headers=token).status_code == 404
    assert client.get("/api/admin/courses/scope-other", headers=token).status_code == 200


def test_preview_is_read_only_and_drafts_remain_previewable(client, db_session, scoped):
    grant(client, scoped, schools=["scope-a"])
    db_session.get(Course, "scope-c1").status = ContentStatus.DRAFT
    db_session.get(Lesson, "scope-c1-lesson").status = ContentStatus.DRAFT
    db_session.commit()
    models = (UserLessonProgress, QuizAttempt, LabResult, PortfolioEvidence, UserBadge, Notification)
    before = [db_session.scalar(select(func.count()).select_from(m)) for m in models]
    for _ in range(2):
        assert client.get("/api/admin/preview/lessons/scope-c1-lesson", headers=headers(scoped[0]["admin"])).status_code == 200
        assert client.get(f"/api/admin/preview/quizzes/{scoped[1]['course'].id}", headers=headers(scoped[0]["admin"])).status_code == 200
    assert [db_session.scalar(select(func.count()).select_from(m)) for m in models] == before
    assert client.get("/api/admin/preview/lessons/scope-other-lesson", headers=headers(scoped[0]["admin"])).status_code == 404
    assert client.get("/api/admin/preview/lessons/scope-c1-lesson", headers=headers(scoped[0]["learner"])).status_code == 403


def test_parent_publication_applies_to_lesson_and_quiz_direct_urls(client, db_session, scoped):
    auth = headers(scoped[0]["learner"])
    assert client.get("/api/lessons/scope-c1-lesson", headers=auth).status_code == 200
    db_session.get(Course, "scope-c1").status = ContentStatus.DRAFT
    db_session.commit()
    for method, suffix in (("GET", ""), ("POST", "/start"), ("POST", "/complete")):
        assert client.request(method, "/api/lessons/scope-c1-lesson"+suffix, headers=auth).status_code == 404
    for name in ("course", "lesson"):
        assert client.get(f"/api/quizzes/{scoped[1][name].id}", headers=auth).status_code == 404
    assert {q["title"] for q in client.get("/api/quizzes", headers=auth).json()}.isdisjoint({"course", "lesson", "mixed"})


def test_shared_questions_survive_other_quiz_replacement(client, db_session, scoped):
    grant(client, scoped, schools=["scope-a"])
    question = Question(id="scope-shared-question", question_text="Shared", difficulty=1)
    db_session.add(question)
    db_session.flush()
    db_session.add(QuestionOption(question_id=question.id, position=0, option_text="Original", is_correct=True))
    for name in ("course", "other"):
        db_session.execute(quiz_questions.insert().values(quiz_id=scoped[1][name].id, question_id=question.id, position=0))
    db_session.commit()
    response = client.put(f"/api/admin/quizzes/{scoped[1]['course'].id}", headers=headers(scoped[0]["admin"]),
                          json={"title": "Replace owned quiz", "course_id": "scope-c1", "kind": "FINAL", "questions": []})
    assert response.status_code == 200, response.text
    db_session.expire_all()
    assert db_session.get(Question, question.id) is not None
    assert db_session.scalar(select(func.count()).select_from(quiz_questions).where(
        quiz_questions.c.quiz_id == scoped[1]["other"].id, quiz_questions.c.question_id == question.id)) == 1


def test_unbound_upload_and_corpus_import_refused_before_processing(client, scoped):
    grant(client, scoped, schools=["scope-a"])
    auth = headers(scoped[0]["admin"])
    image = {"file": ("synthetic.png", b"not-an-image", "image/png")}
    assert client.post("/api/admin/media/images", headers=auth, files=image).status_code == 422
    assert client.post("/api/admin/media/images", headers=auth, files=image, data={"course_id": "scope-other"}).status_code == 404
    pdf = {"file": ("synthetic.pdf", b"not-a-pdf", "application/pdf")}
    assert client.post("/api/admin/courses/import-pdf", headers=auth, files=pdf,
                       data={"school_id": "scope-a", "create_course": "false"}).status_code == 403
    assert client.post("/api/admin/courses/import-pdf", headers=auth, files=pdf,
                       data={"school_id": "scope-b"}).status_code == 404


def test_quiz_skill_inherits_authorized_parent_but_not_unrelated_school(client, db_session, scoped):
    grant(client, scoped, pathways=["scope-p1"])
    quiz = scoped[1]["course"]
    quiz.skill_id = "scope-a-skill"
    db_session.commit()
    auth = headers(scoped[0]["admin"])
    assert client.get(f"/api/admin/quizzes/{quiz.id}", headers=auth).status_code == 200
    assert "course" in {q["title"] for q in client.get("/api/admin/quizzes", headers=auth).json()["items"]}
    quiz.skill_id = "scope-b-skill"
    db_session.commit()
    assert client.get(f"/api/admin/quizzes/{quiz.id}", headers=auth).status_code == 404
    assert "course" not in {q["title"] for q in client.get("/api/admin/quizzes", headers=auth).json()["items"]}


def test_media_upload_persists_real_authorized_target(client, db_session, scoped):
    from io import BytesIO
    from PIL import Image
    from app.models.governance import ScopedMedia
    grant(client, scoped, schools=["scope-a"])
    buffer = BytesIO()
    Image.new("RGB", (2, 2)).save(buffer, format="PNG")
    auth = headers(scoped[0]["admin"])
    response = client.post("/api/admin/media/images", headers=auth,
                           files={"file": ("synthetic.png", buffer.getvalue(), "image/png")},
                           data={"course_id": "scope-c1"})
    assert response.status_code == 201, response.text
    record = db_session.scalar(select(ScopedMedia).where(ScopedMedia.url == response.json()["url"]))
    assert record.school_id == "scope-a" and record.course_id == "scope-c1"
    assert record.uploaded_by == scoped[0]["admin"].id
    # The fixture's SQL transaction rolls back; remove this exact synthetic file too.
    from app.services.storage_service import get_storage_service
    get_storage_service().delete_image(record.url)
    assert client.post("/api/admin/media/images", headers=headers(scoped[0]["super"]),
                       files={"file": ("synthetic.png", buffer.getvalue(), "image/png")}).status_code == 422


def test_parent_unpublication_and_role_promotion_preserve_learning_history(client, db_session, scoped):
    learner = scoped[0]["learner"]
    token = headers(learner)
    assert client.post("/api/lessons/scope-c1-lesson/complete", headers=token).status_code == 200
    db_session.get(Course, "scope-c1").status = ContentStatus.ARCHIVED
    db_session.commit()
    history = client.get("/api/me/progress", headers=token).json()
    assert history[0]["status"] == "COMPLETED" and history[0]["progress_pct"] == 100
    assert history[0]["is_available"] is False
    learner.role = UserRole.ADMIN
    db_session.commit()
    assert client.get("/api/me/progress", headers=token).status_code == 403
    learner.role = UserRole.LEARNER
    db_session.commit()
    assert client.get("/api/me/progress", headers=token).json() == history


def test_labs_are_training_ignore_client_grade_and_require_public_parent(client, db_session, scoped):
    from app.models.lab import Lab
    learner = scoped[0]["learner"]
    lab = Lab(id="scope-training", title="Training", school_id="scope-a", lesson_id="scope-c1-lesson",
              status=ContentStatus.PUBLISHED)
    db_session.add(lab)
    db_session.flush()
    historical = LabResult(user_id=learner.id, lab_id=lab.id, completed=True, score=88)
    db_session.add(historical)
    db_session.commit()
    response = client.post(f"/api/labs/{lab.id}/submit", headers=headers(learner),
                           json={"score": 100, "submission": {"exercise": "synthetic"}})
    assert response.status_code == 200, response.text
    assert response.json()["score"] is None
    db_session.refresh(historical)
    assert historical.score == 88
    db_session.get(Course, "scope-c1").status = ContentStatus.DRAFT
    db_session.commit()
    assert client.get(f"/api/labs/{lab.id}").status_code == 404
    assert client.post(f"/api/labs/{lab.id}/submit", headers=headers(learner), json={}).status_code == 404


def test_pdf_import_can_attach_atomically_to_an_assigned_pathway(client, db_session, scoped):
    from tests.pdf_fixtures import ALL_FIXTURES
    grant(client, scoped, pathways=["scope-p1"])
    auth = headers(scoped[0]["admin"])
    upload = {"file": ("synthetic.pdf", ALL_FIXTURES["simple_course"](), "application/pdf")}
    target = {"school_id": "scope-a", "pathway_id": "scope-p1", "create_course": "true"}
    before = db_session.scalar(select(func.count()).select_from(Course))
    preview = client.post("/api/admin/courses/preview-pdf", headers=auth, files=upload, data=target)
    assert preview.status_code == 200, preview.text
    assert db_session.scalar(select(func.count()).select_from(Course)) == before
    imported = client.post("/api/admin/courses/import-pdf", headers=auth, files=upload, data=target)
    assert imported.status_code == 201, imported.text
    cid = imported.json()["course_id"]
    assert db_session.scalar(select(func.count()).select_from(pathway_courses).where(
        pathway_courses.c.course_id == cid, pathway_courses.c.pathway_id == "scope-p1")) == 1
    assert client.get("/api/admin/courses/" + cid, headers=auth).status_code == 200
    target["pathway_id"] = "scope-p2"
    assert client.post("/api/admin/courses/import-pdf", headers=auth, files=upload, data=target).status_code == 404
    assert db_session.scalar(select(func.count()).select_from(Course)) == before + 1
