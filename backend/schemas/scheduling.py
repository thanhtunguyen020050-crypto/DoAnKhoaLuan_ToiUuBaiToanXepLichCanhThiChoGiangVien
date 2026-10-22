"""Pydantic models cho API xếp lịch CP-SAT."""
from pydantic import BaseModel, Field
from typing import Any


class ScheduleRequest(BaseModel):
    lecturers: list[dict[str, Any]] = Field(default_factory=list)
    exams: list[dict[str, Any]] = Field(default_factory=list)
    soft: dict[str, Any] = Field(default_factory=dict)
    time_limit_seconds: float = Field(default=20, ge=1, le=120)


class AssignmentOut(BaseModel):
    exam_id: str | int
    lecturer_id: str | int
    locked: bool = False


class ScheduleResponse(BaseModel):
    status: str
    assignments: list[AssignmentOut] = Field(default_factory=list)
    missing: int = 0
    objective_value: float | None = None
    wall_time_seconds: float = 0
    message: str
