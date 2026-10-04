import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.enums import ContentStatus


class ScopeReplacement(BaseModel):
    school_ids: list[str] = Field(default_factory=list, max_length=100)
    pathway_ids: list[str] = Field(default_factory=list, max_length=100)


class ScopeGrantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    school_id: str | None
    pathway_id: str | None
    assigned_by: uuid.UUID | None
    assigned_at: datetime


class ScopesOut(ScopeReplacement):
    grants: list[ScopeGrantOut]
    global_access: bool


class CertificationRequestIn(BaseModel):
    certification_id: str = Field(min_length=1)
    evidence_ids: list[uuid.UUID] = Field(default_factory=list, max_length=100)
    statement: str = Field(min_length=1, max_length=10000)
    previous_request_id: uuid.UUID | None = None

    @field_validator("statement")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Motivation requise.")
        return value


class DecisionIn(BaseModel):
    decision: Literal["APPROVED", "REJECTED"]
    reason: str = Field(min_length=1, max_length=10000)

    @field_validator("reason")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Motif requis.")
        return value


class CertificationRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    certification_id: str
    previous_request_id: uuid.UUID | None = None
    statement: str
    evidence_ids: list[uuid.UUID]
    status: Literal["SUBMITTED", "APPROVED", "REJECTED"]
    evidence_snapshot: list[dict]
    submitted_at: datetime
    decided_by: uuid.UUID | None
    decided_at: datetime | None
    reason: str | None
    official_certificate_id: uuid.UUID | None = None


class RequestListOut(BaseModel):
    items: list[CertificationRequestOut]
    total: int
    limit: int
    offset: int


class AdminCertificationRequestOut(CertificationRequestOut):
    applicant_display_name: str | None = None


class AdminRequestListOut(RequestListOut):
    items: list[AdminCertificationRequestOut]


class AdminPathwayReferenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    status: ContentStatus


class AdminPathwayReferenceListOut(BaseModel):
    items: list[AdminPathwayReferenceOut]
    total: int
    limit: int
    offset: int
