"""Central server-side scope checks; assignment edits share the mutation lock."""
from fastapi import HTTPException
from sqlalchemy import and_, exists, or_, select, true

from app.db.locks import transaction_lock
from app.models.catalog import Skill
from app.models.content import Course, Lesson, Pathway, pathway_courses
from app.models.enums import UserRole
from app.models.governance import AdminScope
from app.models.quiz import Quiz


class ContentScopeService:
    def __init__(self, db, actor):
        self.db = db
        self.actor = actor

    @property
    def global_access(self):
        return self.actor.role == UserRole.SUPER_ADMIN

    def school_predicate(self, school_id):
        return exists(select(AdminScope.id).where(AdminScope.user_id == self.actor.id,
                                                 AdminScope.school_id == school_id))

    def course_predicate(self, course=Course):
        if self.global_access:
            return true()
        pathway = exists(select(pathway_courses.c.course_id).join(
            AdminScope, AdminScope.pathway_id == pathway_courses.c.pathway_id).where(
            pathway_courses.c.course_id == course.id, AdminScope.user_id == self.actor.id))
        return or_(self.school_predicate(course.school_id), pathway)

    def lesson_predicate(self):
        return exists(select(Course.id).where(Course.id == Lesson.course_id, self.course_predicate()))

    def quiz_predicate(self):
        if self.global_access:
            return true()
        return and_(
            or_(Quiz.course_id.is_(None), exists(select(Course.id).where(Course.id == Quiz.course_id, self.course_predicate()))),
            or_(Quiz.lesson_id.is_(None), exists(select(Lesson.id).where(Lesson.id == Quiz.lesson_id, self.lesson_predicate()))),
            or_(Quiz.skill_id.is_(None), exists(select(Skill.id).where(Skill.id == Quiz.skill_id, or_(self.school_predicate(Skill.school_id),
                exists(select(Course.id).where(Course.id == Quiz.course_id, Course.school_id == Skill.school_id, self.course_predicate())),
                exists(select(Lesson.id).join(Course, Course.id == Lesson.course_id).where(Lesson.id == Quiz.lesson_id, Course.school_id == Skill.school_id, self.course_predicate())))))),
            or_(Quiz.course_id.is_not(None), Quiz.lesson_id.is_not(None), Quiz.skill_id.is_not(None)),
        )

    def lock_mutation(self):
        transaction_lock(self.db, "casa:content-scope-mutations")

    def school(self, school_id):
        if not self.global_access and not self.db.scalar(select(self.school_predicate(school_id))):
            raise HTTPException(404, "École inaccessible.")

    def pathway(self, pathway_id):
        if self.db.get(Pathway, pathway_id) is None:
            raise HTTPException(422, "Parcours introuvable.")
        if not self.global_access and not self.db.scalar(select(exists(select(AdminScope.id).where(
                AdminScope.user_id == self.actor.id, AdminScope.pathway_id == pathway_id)))):
            raise HTTPException(404, "Parcours inaccessible.")

    def course(self, course_id, *, write=False):
        if write:
            self.lock_mutation()
        course = self.db.scalar(select(Course).where(Course.id == course_id, self.course_predicate()))
        if course is None:
            raise HTTPException(404, "Cours introuvable.")
        if write and not self.global_access and not self.db.scalar(select(self.school_predicate(course.school_id))):
            paths = list(self.db.scalars(select(pathway_courses.c.pathway_id).where(pathway_courses.c.course_id == course.id)))
            if len(paths) > 1:
                granted = set(self.db.scalars(select(AdminScope.pathway_id).where(AdminScope.user_id == self.actor.id)))
                if not set(paths).issubset(granted):
                    raise HTTPException(409, "Cours partagé : tous les parcours ou l’école doivent être attribués.")
        return course

    def lesson(self, lesson_id, *, write=False):
        if write:
            self.lock_mutation()
        lesson = self.db.get(Lesson, lesson_id)
        if lesson is None:
            raise HTTPException(404, "Leçon introuvable.")
        self.course(lesson.course_id, write=write)
        return lesson

    def quiz_target(self, target, *, write=False):
        if write:
            self.lock_mutation()
        if self.global_access:
            return
        if not any((target.course_id, target.lesson_id, target.skill_id)):
            raise HTTPException(404, "Quiz sans rattachement accessible.")
        schools = set()
        if target.course_id:
            schools.add(self.course(target.course_id, write=write).school_id)
        if target.lesson_id:
            lesson = self.lesson(target.lesson_id, write=write)
            schools.add(self.db.get(Course, lesson.course_id).school_id)
        if target.skill_id:
            skill = self.db.get(Skill, target.skill_id)
            if skill is None:
                raise HTTPException(404, "Compétence introuvable.")
            if skill.school_id not in schools:
                self.school(skill.school_id)

    def quiz(self, quiz_id, *, write=False):
        if write:
            self.lock_mutation()
        quiz = self.db.get(Quiz, quiz_id)
        if quiz is None:
            raise HTTPException(404, "Quiz introuvable.")
        self.quiz_target(quiz, write=write)
        return quiz
