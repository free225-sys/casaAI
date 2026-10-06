"""Versioned public metadata and scoped, serialized lesson notion writes."""
from hashlib import sha256
import json

from fastapi import HTTPException
from sqlalchemy import delete, func, select

from app.models.content import Course, Lesson
from app.models.enums import AccountStatus, ContentStatus, UserRole
from app.models.knowledge import KnowledgeNode, knowledge_node_used_in_lessons as links
from app.models.user import User
from app.schemas.discovery import (
    AdminKnowledgeNodeOut, AdminKnowledgeNodePage, DiscoveryCourseOut,
    DiscoveryLinksOut, DiscoveryNotionOut, DiscoverySceneOut, LessonKnowledgeNodesOut,
)
from app.services.content_scope_service import ContentScopeService


DISCOVERY_KEY = "llm-answer"
REGISTRY_VERSION = 1
SCENES = (
    ("message", ("llm",)),
    ("tokens", ("tokenization",)),
    ("representations", ("data-representation", "embeddings")),
    ("model", ("attention", "transformer")),
    ("generation", ("generation", "kv-cache")),
    ("response", ("llm", "generation")),
)
NOTION_IDS = tuple(dict.fromkeys(node for _, nodes in SCENES for node in nodes))


def public_links(db, discovery_key):
    if discovery_key != DISCOVERY_KEY:
        raise HTTPException(404, "Découverte introuvable.", headers={"Cache-Control": "no-store"})
    # A single statement/snapshot: unpublished paths are filtered *before*
    # the outer join, so a published notion without eligible links survives.
    eligible = select(
        links.c.node_id, Course.id.label("course_id"), Course.title.label("course_title"),
        Course.school_id, Course.level, Course.duration_min,
    ).select_from(links).join(Lesson, Lesson.id == links.c.lesson_id).join(
        Course, Course.id == Lesson.course_id
    ).where(Lesson.status == ContentStatus.PUBLISHED, Course.status == ContentStatus.PUBLISHED,
            links.c.node_id.in_(NOTION_IDS)).distinct().subquery()
    rows = db.execute(select(
        KnowledgeNode.id, KnowledgeNode.title, eligible.c.course_id, eligible.c.course_title,
        eligible.c.school_id, eligible.c.level, eligible.c.duration_min,
    ).outerjoin(eligible, eligible.c.node_id == KnowledgeNode.id).where(
        KnowledgeNode.id.in_(NOTION_IDS), KnowledgeNode.status == ContentStatus.PUBLISHED,
    ).order_by(eligible.c.course_title, eligible.c.course_id, KnowledgeNode.id)).all()
    notions, courses, node_courses = {}, {}, {}
    for nid, title, cid, ctitle, sid, level, duration in rows:
        notions[nid] = DiscoveryNotionOut(id=nid, title=title)
        if cid is not None:
            courses[cid] = DiscoveryCourseOut(id=cid, title=ctitle, school_id=sid,
                                               level=level, duration_min=duration)
            node_courses.setdefault(nid, set()).add(cid)
    course_order = tuple(courses)
    scenes = []
    for key, ids in SCENES:
        found = [nid for nid in ids if nid in notions]
        candidates = set().union(*(node_courses.get(nid, set()) for nid in found))
        scenes.append(DiscoverySceneOut(scene_key=key, notion_ids=found,
                                       course_ids=[cid for cid in course_order if cid in candidates]))
    return DiscoveryLinksOut(discovery_key=DISCOVERY_KEY, registry_version=REGISTRY_VERSION,
                             scenes=scenes, notions=[notions[nid] for nid in NOTION_IDS if nid in notions],
                             courses=list(courses.values()))


def reference_page(db, limit, offset):
    total = db.scalar(select(func.count()).select_from(KnowledgeNode))
    rows = db.execute(select(KnowledgeNode.id, KnowledgeNode.title, KnowledgeNode.status).order_by(
        KnowledgeNode.title, KnowledgeNode.id).limit(limit).offset(offset)).all()
    return AdminKnowledgeNodePage(items=[AdminKnowledgeNodeOut(id=nid, title=title, status=status)
                                         for nid, title, status in rows],
                                  total=total, limit=limit, offset=offset)


def association_state(db, lesson):
    ids = sorted(db.scalars(select(links.c.node_id).where(links.c.lesson_id == lesson.id)))
    encoded = json.dumps({"lesson_id": lesson.id, "course_id": lesson.course_id, "node_ids": ids},
                         sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return LessonKnowledgeNodesOut(lesson_id=lesson.id, node_ids=ids, revision=sha256(encoded).hexdigest())


def replace_associations(db, actor, lesson_id, payload):
    scope = ContentScopeService(db, actor)
    scope.lock_mutation()
    # populate_existing is essential: auth has already loaded this identity
    # before potentially waiting for the advisory lock or this row lock.
    actor = db.scalar(select(User).where(User.id == actor.id).with_for_update().execution_options(
        populate_existing=True))
    if actor is None or actor.status != AccountStatus.ACTIVE:
        raise HTTPException(401, "Identifiants invalides ou expirés.", headers={"WWW-Authenticate": "Bearer"})
    if actor.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(403, "Accès refusé : rôle insuffisant.")
    scope = ContentScopeService(db, actor)
    scope.lesson(lesson_id, write=True)
    lesson = db.scalar(select(Lesson).where(Lesson.id == lesson_id).with_for_update().execution_options(
        populate_existing=True))
    if lesson is None:
        raise HTTPException(404, "Leçon introuvable.")
    scope.lesson(lesson_id, write=True)
    desired = sorted(payload.node_ids)
    # Ordered row locks protect all references through commit, including
    # an identical retry. Validate before removing a single association.
    found = list(db.scalars(select(KnowledgeNode.id).where(KnowledgeNode.id.in_(desired)).order_by(
        KnowledgeNode.id).with_for_update())) if desired else []
    if set(found) != set(desired):
        raise HTTPException(422, "Notion introuvable.")
    current = association_state(db, lesson)
    if desired == current.node_ids:
        db.commit()
        return current
    if payload.expected_revision != current.revision:
        raise HTTPException(409, "Les notions de cette leçon ont changé. Rechargez puis réessayez.")
    removed = set(current.node_ids) - set(desired)
    added = set(desired) - set(current.node_ids)
    if removed:
        db.execute(delete(links).where(links.c.lesson_id == lesson.id, links.c.node_id.in_(removed)))
    if added:
        db.execute(links.insert(), [{"lesson_id": lesson.id, "node_id": nid} for nid in sorted(added)])
    result = association_state(db, lesson)
    db.commit()
    return result
