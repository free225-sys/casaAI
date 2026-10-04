"""Quiz writes preserve shared questions and historical answer references.
Detached historical questions/options are retained unchanged; only unused,
unanswered records can be physically deleted. API deletion also refuses quizzes
with attempts, independently of the learner's current role.
"""
from __future__ import annotations

import re
import unicodedata
import uuid

from sqlalchemy import delete, exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.quiz import Question, QuestionOption, Quiz, quiz_questions
from app.models.progress import QuizAttemptAnswer
from app.schemas.admin import AdminQuizIn


def _slugify(text: str) -> str:
    """Identifiant lisible à partir d'un titre — même approche que
    admin_content_repository._slugify, dupliquée ici pour ne pas créer de
    couplage entre deux repositories indépendants."""
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return slug or str(uuid.uuid4())[:8]


class AdminQuizRepository:
    def __init__(self, db: Session):
        self.db = db

    # --- Lecture -----------------------------------------------------------

    def get_quiz_any_status(self, quiz_id: uuid.UUID) -> Quiz | None:
        return self.db.get(Quiz, quiz_id)

    def list_quizzes(
        self, *, course_id: str | None = None, lesson_id: str | None = None,
        skill_id: str | None = None, limit: int = 20, offset: int = 0, scope_predicate=None,
    ) -> tuple[list[tuple[Quiz, int]], int]:
        """Renvoie (quiz, nombre de questions) — le nombre de questions
        évite à l'admin d'ouvrir chaque quiz juste pour voir s'il est vide."""
        stmt = select(Quiz)
        if scope_predicate is not None:
            stmt = stmt.where(scope_predicate)
        if course_id:
            stmt = stmt.where(Quiz.course_id == course_id)
        if lesson_id:
            stmt = stmt.where(Quiz.lesson_id == lesson_id)
        if skill_id:
            stmt = stmt.where(Quiz.skill_id == skill_id)

        total = self.db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
        quizzes = list(self.db.execute(stmt.order_by(Quiz.title).limit(limit).offset(offset)).scalars())

        counts = dict(
            self.db.execute(
                select(quiz_questions.c.quiz_id, func.count())
                .where(quiz_questions.c.quiz_id.in_([q.id for q in quizzes]))
                .group_by(quiz_questions.c.quiz_id)
            ).all()
        )
        return [(q, counts.get(q.id, 0)) for q in quizzes], total

    def get_quiz_questions(self, quiz_id: uuid.UUID) -> list[Question]:
        """Questions du quiz dans l'ordre défini par quiz_questions.position."""
        question_ids = list(
            self.db.execute(
                select(quiz_questions.c.question_id)
                .where(quiz_questions.c.quiz_id == quiz_id)
                .order_by(quiz_questions.c.position)
            ).scalars()
        )
        if not question_ids:
            return []
        by_id = {
            q.id: q
            for q in self.db.execute(
                select(Question).options(selectinload(Question.options)).where(Question.id.in_(question_ids))
            ).scalars()
        }
        return [by_id[qid] for qid in question_ids if qid in by_id]

    # --- Écriture -----------------------------------------------------------

    def create_quiz(self, data: AdminQuizIn) -> Quiz:
        quiz = Quiz(
            title=data.title, kind=data.kind, lesson_id=data.lesson_id, course_id=data.course_id,
            skill_id=data.skill_id, pass_threshold=data.pass_threshold, status=data.status,
        )
        self.db.add(quiz)
        self.db.flush()
        self._replace_questions(quiz, data)
        self.db.flush()
        return quiz

    def update_quiz(self, quiz: Quiz, data: AdminQuizIn) -> Quiz:
        quiz.title = data.title
        quiz.kind = data.kind
        quiz.lesson_id = data.lesson_id
        quiz.course_id = data.course_id
        quiz.skill_id = data.skill_id
        quiz.pass_threshold = data.pass_threshold
        quiz.status = data.status
        self.db.flush()
        self._replace_questions(quiz, data)
        self.db.flush()
        return quiz

    def _replace_questions(self, quiz: Quiz, data: AdminQuizIn) -> None:
        old_question_ids = list(
            self.db.execute(
                select(quiz_questions.c.question_id).where(quiz_questions.c.quiz_id == quiz.id)
            ).scalars()
        )
        if old_question_ids:
            # Historical questions/options remain immutable and detached.
            self.db.execute(delete(quiz_questions).where(quiz_questions.c.quiz_id == quiz.id))
            self._delete_unused_questions(old_question_ids)
            self.db.flush()

        for pos, q in enumerate(data.questions):
            qid = self._unique_question_id(_slugify(q.question_text))
            question = Question(id=qid, question_text=q.question_text, explanation=q.explanation, difficulty=q.difficulty)
            self.db.add(question)
            self.db.flush()
            for opt_pos, opt in enumerate(q.options):
                self.db.add(QuestionOption(
                    question_id=qid, position=opt_pos, option_text=opt.option_text, is_correct=opt.is_correct,
                ))
            self.db.execute(quiz_questions.insert().values(quiz_id=quiz.id, question_id=qid, position=pos))

    def _unique_question_id(self, base: str) -> str:
        candidate = base
        i = 2
        while self.db.get(Question, candidate) is not None:
            candidate = f"{base}-{i}"
            i += 1
        return candidate

    def _delete_unused_questions(self, question_ids):
        # Block concurrent FK inserts while deciding whether physical deletion
        # is safe. A selected option can reference a different question in old
        # records, so protect both question and option references.
        list(self.db.scalars(select(Question).where(Question.id.in_(question_ids)).with_for_update()))
        list(self.db.scalars(select(QuestionOption.id).where(
            QuestionOption.question_id.in_(question_ids)).with_for_update()))
        still_used = select(quiz_questions.c.question_id)
        history = exists(select(QuizAttemptAnswer.id).where(or_(
            QuizAttemptAnswer.question_id == Question.id,
            QuizAttemptAnswer.selected_option_id.in_(select(QuestionOption.id).where(
                QuestionOption.question_id == Question.id).correlate(Question)),
        )))
        self.db.execute(delete(Question).where(Question.id.in_(question_ids),
                                             Question.id.not_in(still_used), ~history))

    def delete_quiz(self, quiz: Quiz) -> None:
        old_question_ids = list(
            self.db.execute(
                select(quiz_questions.c.question_id).where(quiz_questions.c.quiz_id == quiz.id)
            ).scalars()
        )
        self.db.delete(quiz)  # cascade DB vers quiz_questions
        self.db.flush()
        if old_question_ids:
            # Questions désormais orphelines (propres à ce quiz — voir
            # docstring de module) : purgées pour ne pas laisser de résidu.
            self._delete_unused_questions(old_question_ids)
        self.db.flush()
