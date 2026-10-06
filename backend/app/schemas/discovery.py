"""Metadata-only discovery and explicit lesson association contracts."""
from typing import Annotated, Literal
import unicodedata

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.models.enums import ContentStatus


class DiscoveryNotionOut(BaseModel):
    id: str
    title: str


class DiscoveryCourseOut(BaseModel):
    id: str
    title: str
    school_id: str
    level: str | None
    duration_min: int | None


class DiscoverySceneOut(BaseModel):
    scene_key: str
    notion_ids: list[str]
    course_ids: list[str]


class DiscoveryLinksOut(BaseModel):
    discovery_key: Literal["llm-answer"]
    registry_version: Literal[1]
    scenes: list[DiscoverySceneOut] = Field(min_length=6, max_length=6)
    notions: list[DiscoveryNotionOut]
    courses: list[DiscoveryCourseOut]


class AdminKnowledgeNodeOut(DiscoveryNotionOut):
    status: ContentStatus


class AdminKnowledgeNodePage(BaseModel):
    items: list[AdminKnowledgeNodeOut]
    total: int
    limit: int
    offset: int


class DiscoveryErrorOut(BaseModel):
    detail: str


Revision = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$", min_length=64, max_length=64)]
NodeId = Annotated[str, StringConstraints(strict=True, min_length=1, max_length=200)]


class LessonKnowledgeNodesOut(BaseModel):
    lesson_id: str
    node_ids: list[str]
    revision: Revision


class LessonKnowledgeNodesReplacement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    node_ids: list[NodeId] = Field(max_length=100)
    expected_revision: Revision

    @field_validator("node_ids")
    @classmethod
    def valid_ids(cls, values: list[str]) -> list[str]:
        if len(set(values)) != len(values):
            raise ValueError("Les identifiants de notions doivent être uniques.")
        if any(value != value.strip() or any(unicodedata.category(c) == "Cc" for c in value)
               for value in values):
            raise ValueError("Identifiant de notion invalide.")
        return values
