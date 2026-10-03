"""API simulée pour le rendu isolé du frontend CASA AI (aucun backend, aucune base).

Toutes les réponses sont synthétiques ; les titres pédagogiques proviennent du
seed versionné public backend/data/casa_data.json. Chaque requête est journalisée.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs

REPO = Path(os.environ.get("CASA_REPO", Path(__file__).resolve().parents[5]))
SEED = json.loads((REPO / "backend/data/casa_data.json").read_text(encoding="utf-8"))
NOW = "2026-10-03T09:00:00Z"

USERS = {
    "mock-learner": {"id": "u-learner", "first_name": "Awa", "last_name": "Exemple", "email": "apprenant@example.test",
                     "role": "LEARNER", "status": "ACTIVE", "created_at": NOW, "last_login_at": NOW},
    "mock-admin": {"id": "u-admin", "first_name": "Sam", "last_name": "Contenu", "email": "admin@example.test",
                   "role": "ADMIN", "status": "ACTIVE", "created_at": NOW, "last_login_at": NOW},
}

SCHOOLS = [{"id": s["id"], "name": s["name"], "short_name": s.get("short", s["name"]), "color": s.get("color", "#2f63e0"),
            "description": s.get("description")} for s in SEED["schools"]]

COURSES = [{"id": c["id"], "school_id": c["schoolId"], "title": c["title"], "level": c.get("level"),
            "duration_min": c.get("duration"), "color": c.get("color"), "description": c.get("description")}
           for c in SEED["courses"]]
PATHWAYS = [{"id": p["id"], "title": p["title"], "profile_label": p.get("profile"), "level": p.get("level"),
             "duration_label": p.get("duration"), "color": p.get("color"), "description": p.get("description")}
            for p in SEED["pathways"]]
LABS = [{"id": l["id"], "title": l["title"], "school_id": l.get("schoolId"), "level": l.get("level"),
         "duration_min": l.get("duration"), "color": l.get("color"), "description": l.get("description")}
        for l in SEED["labs"]]
LESSONS = {l["id"]: l for l in SEED["lessons"]}
DEPTH_KEYS = {"essential": "ESSENTIAL", "technical": "TECHNICAL", "mathematics": "MATHEMATICS",
              "implementation": "IMPLEMENTATION", "architecture": "ARCHITECTURE", "governance": "GOVERNANCE"}
DEPTH_LABELS = {"essential": "Essentiel", "technical": "Technique", "mathematics": "Mathématiques",
                "implementation": "Implémentation", "architecture": "Architecture", "governance": "Gouvernance & risques"}


def course_lessons(course_id):
    course = next(c for c in SEED["courses"] if c["id"] == course_id)
    return [LESSONS[lid] for lid in course.get("lessons", []) if lid in LESSONS]


def course_detail(course_id):
    base = next((c for c in COURSES if c["id"] == course_id), None)
    if base is None:
        return None
    lessons = [{"id": l["id"], "title": l["title"], "level": l.get("level"), "duration_min": l.get("duration"),
                "position": i} for i, l in enumerate(course_lessons(course_id))]
    return {**base, "lessons": lessons, "final_quiz_id": None, "resources": []}


def lesson_detail(lesson_id):
    l = LESSONS.get(lesson_id)
    if l is None:
        return None
    position = [x["id"] for x in course_lessons(l["courseId"])].index(lesson_id)
    depth = l.get("depth") or {}
    return {
        "id": l["id"], "course_id": l["courseId"], "title": l["title"], "level": l.get("level"),
        "duration_min": l.get("duration"), "summary": l.get("summary"), "example": l.get("example"),
        "position": position, "skill_id": l.get("skillId"), "demo_id": None,
        "objectives": l.get("objectives", []),
        "sections": [{"position": i, "title": s["title"], "body": s["body"], "image_url": None, "image_alt": None,
                      "diagram": None} for i, s in enumerate(l.get("sections", []))],
        "depth_levels": [{"depth_key": DEPTH_KEYS[k], "label": DEPTH_LABELS[k], "title": v.get("title", DEPTH_LABELS[k]),
                          "body": v.get("body", "")} for k, v in depth.items() if v],
        "validation_quiz_id": "quiz-validation-demo",
        "has_document": False,
    }


def progress_rows():
    rows = []
    def add(lid, status, pct, completed):
        l = LESSONS[lid]
        rows.append({"lesson_id": lid, "lesson_title": l["title"], "course_id": l["courseId"], "status": status,
                     "progress_pct": pct, "started_at": NOW, "completed_at": NOW if completed else None})
    add("probability-bayes", "IN_PROGRESS", 45, False)
    add("vectors-tensors", "COMPLETED", 100, True)
    add("ai-limits", "IN_PROGRESS", 20, False)
    add("ai-value", "COMPLETED", 100, True)
    add("ai-map", "COMPLETED", 100, True)
    return rows


SKILLS = [
    {"skill_id": "ai-literacy", "skill_name": "Culture IA", "school_id": "culture", "mastery_level": 2, "updated_at": NOW},
    {"skill_id": "linear-algebra", "skill_name": "Algèbre linéaire", "school_id": "math", "mastery_level": 1, "updated_at": NOW},
    {"skill_id": "probability", "skill_name": "Probabilités & statistiques", "school_id": "math", "mastery_level": 0, "updated_at": NOW},
    {"skill_id": "responsible-use", "skill_name": "Usage responsable", "school_id": "culture", "mastery_level": 3, "updated_at": NOW},
]

BADGE_CATALOG = [
    ("first_step", "Premier pas", "Terminer une première leçon.", "apprentissage", True, False),
    ("curious", "Curieux", "Terminer 3 leçons.", "apprentissage", True, True),
    ("regular", "Régulier", "Terminer 10 leçons.", "apprentissage", False, False),
    ("assidu", "Assidu", "Terminer 25 leçons.", "apprentissage", False, False),
    ("quiz_start", "Première réussite", "Réussir un quiz.", "quiz", True, False),
    ("quiz_solid", "Solide", "Réussir 5 quiz.", "quiz", False, False),
    ("quiz_perfect", "Sans faute", "Obtenir 100 à un quiz.", "quiz", False, False),
    ("lab_start", "Mains dans le cambouis", "Soumettre un lab.", "labs", False, False),
    ("skill_one", "Compétence", "Atteindre le niveau 2 sur une compétence.", "compétences", True, False),
    ("skill_master", "Maîtrise", "Atteindre le niveau 4 sur une compétence.", "compétences", False, False),
    ("certified", "Certifié", "Obtenir un certificat de cours.", "certification", False, False),
]


def badges():
    return [{"id": i, "title": t, "description": d, "category": c, "earned": e, "earned_at": NOW if e else None, "new": n}
            for i, t, d, c, e, n in BADGE_CATALOG]


NOTIFICATIONS = [
    {"id": "n1", "type": "BADGE_EARNED", "title": "Badge débloqué : Curieux", "body": "Terminer 3 leçons.", "read": False, "created_at": NOW},
    {"id": "n2", "type": "BADGE_EARNED", "title": "Badge débloqué : Premier pas", "body": "Terminer une première leçon.", "read": True, "created_at": NOW},
]

DRAFT_IDS = {"genai", "rag-engineering", "agent-engineering", "llm-systems", "cyber-ai", "global-governance"}


def admin_courses():
    out = []
    for c in COURSES:
        status = "DRAFT" if c["id"] in DRAFT_IDS else "PUBLISHED"
        out.append({**c, "status": status, "created_at": NOW, "updated_at": NOW})
    # quelques brouillons issus d'import PDF, en tête de liste
    out.insert(0, {"id": "import-guide-rag", "school_id": "genai", "title": "Guide interne RAG (import PDF)", "level": None,
                   "duration_min": None, "color": None, "description": None, "status": "DRAFT", "created_at": NOW, "updated_at": NOW})
    return out


PDF_PREVIEW = {
    "title": "Support synthétique — Introduction au RAG",
    "pages": 12,
    "report": {"pages": 12, "sections": 5, "subsections": 2, "headings": 7, "paragraphs": 5, "blocks": 8, "lists": 1,
               "code_blocks": 1, "tables": 1, "formulas": 1, "captions": 0, "boilerplate_removed": 24,
               "multi_column_pages": 2, "average_confidence": 0.81, "document_type": "DIGITAL",
               "text_extraction_confidence": 0.93,
               "anomalies": [
                   {"kind": "UNCERTAIN_HEADING", "message": "Titre de section détecté avec une confiance faible.", "page": 3, "confidence": 0.48},
                   {"kind": "TABLE_SPLIT", "message": "Tableau réparti sur deux pages, fusion à vérifier.", "page": 7, "confidence": 0.55},
                   {"kind": "TWO_COLUMNS", "message": "Mise en page sur deux colonnes : ordre de lecture reconstruit.", "page": 9, "confidence": 0.62},
               ]},
    "sections": [
        {"title": "1. Pourquoi la génération augmentée", "level": 1, "confidence": 0.94, "page_start": 0, "page_end": 1,
         "blocks": [{"kind": "TEXT", "confidence": 0.95, "preview": "Un modèle de langage ne connaît que ses données d'entraînement. La génération augmentée par récupération ajoute des documents au moment de la question.", "items": None},
                    {"kind": "LIST", "confidence": 0.9, "preview": "Limites d'un LLM seul", "items": ["connaissances figées", "absence de sources", "hallucinations"]}],
         "children": []},
        {"title": "2. Chaîne d'indexation", "level": 1, "confidence": 0.9, "page_start": 2, "page_end": 4,
         "blocks": [{"kind": "TEXT", "confidence": 0.9, "preview": "Découpage, vectorisation et stockage des fragments.", "items": None}],
         "children": [
             {"title": "2.1 Découpage des documents", "level": 2, "confidence": 0.48, "page_start": 3, "page_end": 3,
              "blocks": [{"kind": "CODE", "confidence": 0.8, "preview": "chunks = splitter.split(document, size=800, overlap=100)", "items": None}], "children": []},
             {"title": "2.2 Vectorisation", "level": 2, "confidence": 0.88, "page_start": 4, "page_end": 4,
              "blocks": [{"kind": "FORMULA", "confidence": 0.7, "preview": "sim(q, d) = q · d / (‖q‖ ‖d‖)", "items": None}], "children": []}]},
        {"title": "3. Recherche et classement", "level": 1, "confidence": 0.86, "page_start": 5, "page_end": 7,
         "blocks": [{"kind": "TABLE", "confidence": 0.55, "preview": "Comparatif des stratégies de recherche", "items": None}], "children": []},
        {"title": "4. Évaluation", "level": 1, "confidence": 0.83, "page_start": 8, "page_end": 10,
         "blocks": [{"kind": "TEXT", "confidence": 0.8, "preview": "Mesurer fidélité, pertinence et couverture des réponses.", "items": None}], "children": []},
        {"title": "5. Sécurité et gouvernance", "level": 1, "confidence": 0.91, "page_start": 11, "page_end": 11,
         "blocks": [{"kind": "TEXT", "confidence": 0.9, "preview": "Contrôle d'accès aux documents, journalisation, injection de prompt.", "items": None}], "children": []},
    ],
}

PDF_RESULT = {"document_id": "doc-synth-1", "course_id": "import-guide-rag", "lesson_id": "import-guide-rag-l1",
              "title": PDF_PREVIEW["title"], "pages_extracted": 12, "warning": None, "report": PDF_PREVIEW["report"]}


def page(items, qs):
    limit = int(qs.get("limit", ["20"])[0]); offset = int(qs.get("offset", ["0"])[0])
    return {"items": items[offset:offset + limit], "total": len(items), "limit": limit, "offset": offset}


class MockApi:
    """failures: dict path-regex -> status code (forcer une erreur)."""

    def __init__(self, failures=None, complete_ok=True):
        self.failures = failures or {}
        self.complete_ok = complete_ok
        self.log: list[dict] = []

    def respond(self, method, url, headers):
        u = urlparse(url); path = u.path; qs = parse_qs(u.query)
        token = (headers.get("authorization") or "").replace("Bearer ", "")
        user = USERS.get(token)
        for rx, code in self.failures.items():
            if re.fullmatch(rx, path):
                self.log.append({"method": method, "path": path, "status": code, "note": "erreur forcée"})
                return code, {"detail": "Erreur simulée"}
        status, body = self._route(method, path, qs, user)
        self.log.append({"method": method, "path": path, "status": status})
        return status, body

    def _route(self, method, path, qs, user):
        if path == "/api/auth/me":
            return (200, user) if user else (401, {"detail": "Non authentifié"})
        if method == "GET":
            if path == "/api/schools": return 200, SCHOOLS
            if path == "/api/courses": return 200, page(COURSES, qs)
            if path == "/api/pathways": return 200, page(PATHWAYS, qs)
            if path == "/api/labs": return 200, page(LABS, qs)
            m = re.fullmatch(r"/api/courses/([^/]+)", path)
            if m:
                d = course_detail(m.group(1)); return (200, d) if d else (404, {"detail": "Cours introuvable."})
            if not user:
                return 401, {"detail": "Non authentifié"}
            m = re.fullmatch(r"/api/lessons/([^/]+)", path)
            if m:
                d = lesson_detail(m.group(1)); return (200, d) if d else (404, {"detail": "Leçon introuvable."})
            if path == "/api/me/progress": return 200, progress_rows()
            if path == "/api/me/skills": return 200, SKILLS
            if path == "/api/me/badges": return 200, badges()
            if path == "/api/me/notifications": return 200, NOTIFICATIONS
            if path in ("/api/me/lab-results", "/api/me/course-certificates"): return 200, []
            if re.fullmatch(r"/api/courses/[^/]+/certificate/eligibility", path):
                return 200, {"course_id": "x", "threshold": 80, "quizzes": [], "all_attempted": False,
                             "average_score": None, "eligible": False, "already_issued": False, "issued_at": None}
            if path == "/api/admin/courses":
                items = admin_courses(); st = qs.get("status", [None])[0]
                if st: items = [c for c in items if c["status"] == st]
                return 200, page(items, qs)
            if path == "/api/admin/quizzes": return 200, {"items": [], "total": 0, "limit": 50, "offset": 0}
            return 404, {"detail": "Non simulé"}
        if not user:
            return 401, {"detail": "Non authentifié"}
        m = re.fullmatch(r"/api/lessons/([^/]+)/(start|progress|complete)", path)
        if m:
            lid, action = m.groups()
            if action == "complete":
                if not self.complete_ok:
                    return 500, {"detail": "Erreur simulée"}
                ids = [x["id"] for x in course_lessons(LESSONS[lid]["courseId"])]
                i = ids.index(lid)
                return 200, {"lesson_id": lid, "status": "COMPLETED", "progress_pct": 100,
                             "next_lesson_id": ids[i + 1] if i + 1 < len(ids) else None}
            return 200, {"lesson_id": lid, "status": "IN_PROGRESS", "progress_pct": 0}
        if path == "/api/me/badges/ack": return 200, {"ok": True}
        if path == "/api/admin/courses/preview-pdf": return 200, PDF_PREVIEW
        if path == "/api/admin/courses/import-pdf": return 201, PDF_RESULT
        return 404, {"detail": "Non simulé"}
