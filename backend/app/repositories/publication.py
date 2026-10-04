"""Published child resources require all their explicit parents to be public."""
from sqlalchemy import and_, exists, or_, select

from app.models.content import Course, Lesson
from app.models.enums import ContentStatus
from app.models.quiz import Quiz
from app.models.lab import Lab


def published_quiz():
    published_course = exists(select(Course.id).where(
        Course.id == Quiz.course_id, Course.status == ContentStatus.PUBLISHED))
    published_lesson = exists(select(Lesson.id).join(Course, Course.id == Lesson.course_id).where(
        Lesson.id == Quiz.lesson_id, Lesson.status == ContentStatus.PUBLISHED, Course.status == ContentStatus.PUBLISHED))
    return and_(Quiz.status == ContentStatus.PUBLISHED,
                or_(Quiz.course_id.is_(None), published_course),
                or_(Quiz.lesson_id.is_(None), published_lesson))


def published_lab():
    parent = exists(select(Lesson.id).join(Course, Course.id == Lesson.course_id).where(
        Lesson.id == Lab.lesson_id, Lesson.status == ContentStatus.PUBLISHED, Course.status == ContentStatus.PUBLISHED))
    return and_(Lab.status == ContentStatus.PUBLISHED, or_(Lab.lesson_id.is_(None), parent))
