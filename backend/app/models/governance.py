"""Additive attribution and official CASA decision records; no legacy rewrites."""
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, uuid_pk


class AdminScope(Base):
    __tablename__ = "admin_scopes"
    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    school_id: Mapped[str | None] = mapped_column(String, ForeignKey("schools.id", ondelete="CASCADE"))
    pathway_id: Mapped[str | None] = mapped_column(String, ForeignKey("pathways.id", ondelete="CASCADE"))
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        CheckConstraint("(school_id IS NOT NULL) <> (pathway_id IS NOT NULL)", name="ck_admin_scope_one_target"),
        UniqueConstraint("user_id", "school_id", name="uq_admin_scope_school"),
        UniqueConstraint("user_id", "pathway_id", name="uq_admin_scope_pathway"),
    )


class CertificationRequest(Base):
    __tablename__ = "certification_requests"
    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    certification_id: Mapped[str] = mapped_column(String, ForeignKey("certifications.id", ondelete="RESTRICT"))
    previous_request_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey(
        "certification_requests.id", ondelete="NO ACTION", deferrable=True, initially="DEFERRED"))
    statement: Mapped[str] = mapped_column(String)
    evidence_ids: Mapped[list] = mapped_column(JSONB)
    evidence_snapshot: Mapped[list] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String, default="SUBMITTED", index=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decided_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(String)
    __table_args__ = (
        UniqueConstraint("previous_request_id", name="uq_certification_request_previous"),
        Index("uq_certification_request_open_subject", "user_id", "certification_id", unique=True,
              postgresql_where=text("status <> 'REJECTED'")),
        CheckConstraint("status IN ('SUBMITTED','APPROVED','REJECTED')", name="ck_certification_request_status"),
        CheckConstraint("(status = 'SUBMITTED' AND decided_at IS NULL AND reason IS NULL) OR "
                        "(status <> 'SUBMITTED' AND decided_at IS NOT NULL AND length(trim(reason)) > 0)",
                        name="ck_certification_request_decision"),
    )


class OfficialCertificate(Base):
    __tablename__ = "official_certificates"
    id: Mapped[uuid.UUID] = uuid_pk()
    request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("certification_requests.id", ondelete="CASCADE"), unique=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ScopedMedia(Base):
    __tablename__ = "scoped_media"
    id: Mapped[uuid.UUID] = uuid_pk()
    url: Mapped[str] = mapped_column(String, unique=True)
    school_id: Mapped[str] = mapped_column(String, ForeignKey("schools.id", ondelete="RESTRICT"), index=True)
    course_id: Mapped[str | None] = mapped_column(String, ForeignKey("courses.id", ondelete="SET NULL"), index=True)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
