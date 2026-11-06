"""CP-SAT exam invigilation scheduler.

The solver accepts normalized records, but also tolerates the legacy calendar
strings still emitted by older callers. SQL-provided quotas are authoritative
when ``use_authoritative_quotas`` is set.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date as date_type
from datetime import datetime
from itertools import combinations
import logging
import math
import os
import re
from time import monotonic
from typing import Any

try:
    from ..rb7 import is_main_campus_room, normalize_min_travel_slots, rb7_teaching_exam_violation
except ImportError:
    from rb7 import is_main_campus_room, normalize_min_travel_slots, rb7_teaching_exam_violation

try:
    from ortools.sat.python import cp_model
except ImportError:  # pragma: no cover - surfaced to the API caller
    cp_model = None


_RANGE_RE = re.compile(r"(\d+)\s*[→>-]\s*(\d+)")
TOTAL_TIME_SECONDS = 120.0
PHASE1_TIME_SECONDS = 30.0
MAX_SOLVER_WORKERS = 8
SOFT_RULE_WEIGHTS = {
    "RB8": 10_000_000,
    "S1": 1_000_000,
    "S3": 500_000,
    "S2": 200_000,
    "S4": 10_000,
    "S5": 1_000,
    "S6": 100,
    "S7": 10,
}
LOGGER = logging.getLogger(__name__)


def _range_for(exam: dict[str, Any]) -> tuple[int, int]:
    for key in ("period", "ca", "Tiet", "tiet", "time"):
        match = _RANGE_RE.search(str(exam.get(key, "")))
        if match:
            return int(match.group(1)), int(match.group(2))
    start = exam.get("start", exam.get("TuTiet", exam.get("tiet_bat_dau")))
    end = exam.get("end", exam.get("DenTiet", exam.get("tiet_ket_thuc")))
    if start is not None and end is not None:
        try:
            return int(start), int(end)
        except (TypeError, ValueError):
            pass
    session = int(exam.get("ses", 0) or 0)
    return {1: (1, 2), 2: (3, 4), 3: (7, 8), 4: (9, 10)}.get(session, (0, 0))


def _overlap(a: dict[str, Any], b: dict[str, Any]) -> bool:
    a1, a2 = _range_for(a)
    b1, b2 = _range_for(b)
    return a1 <= b2 and b1 <= a2


def _date_key(value: Any) -> str:
    if isinstance(value, (date_type, datetime)):
        return value.isoformat()[:10]
    text = str(value or "").strip()
    return text[:10] if re.match(r"\d{4}-\d{2}-\d{2}", text) else text


def _field(record: dict[str, Any], *names: str) -> Any:
    for name in names:
        if record.get(name) not in (None, ""):
            return record[name]
    return None


def _calendar_entry(raw: Any, *, default_priority: int = 3) -> dict[str, Any] | None:
    """Normalize a teaching/duty/busy calendar object or legacy string."""
    if isinstance(raw, dict):
        record = dict(raw)
        date_value = _field(record, "date", "day", "NgayThi", "ngaythi", "NgayDay", "ngayday",
                            "NgayHoc", "ngayhoc", "NgayBan", "ngayban", "Ngay", "ngay")
        key = str(record.get("key", ""))
        if not date_value and "|" in key:
            date_value = key.split("|", 1)[0]
        start = _field(record, "start", "TuTiet", "tutiet", "TietBD", "tietbd",
                       "TietBatDau", "tiet_bat_dau", "start_period")
        end = _field(record, "end", "DenTiet", "dentiet", "TietKT", "tietkt",
                     "TietKetThuc", "tiet_ket_thuc", "end_period")
        detail = str(_field(record, "period", "range", "ca", "CaTiet", "catiet", "Tiet", "tiet",
                            "KhoangTiet", "khoangtiet", "block") or "")
        if start is None or end is None:
            match = _RANGE_RE.search(detail)
            if not match and "|" in key:
                detail = key.split("|", 1)[1]
                match = _RANGE_RE.search(detail)
            if match:
                start, end = int(match.group(1)), int(match.group(2))
            elif detail.strip().upper() in {"S", "SÁNG", "MORNING"}:
                start, end = 1, 6
            elif detail.strip().upper() in {"C", "CHIỀU", "AFTERNOON"}:
                start, end = 7, 12
            elif detail.strip().upper() in {"T", "TỐI", "EVENING", "NIGHT"}:
                start, end = 13, 18
        try:
            start, end = int(start), int(end)
        except (TypeError, ValueError):
            return None
        priority_raw = _field(record, "priority", "MucDo", "mucdo", "MucDoBan", "mucdoban", "muc_do")
        priority_match = re.search(r"\d+", str(priority_raw or ""))
        priority = int(priority_match.group()) if priority_match else default_priority
        return {
            "date": _date_key(date_value), "start": start, "end": end,
            "room": _field(record, "room", "Phong"),
            "priority": priority,
        }

    text = str(raw or "").strip()
    if not text:
        return None
    parts = text.split("|")
    if len(parts) < 2:
        return None
    day = _date_key(parts[0])
    detail = parts[1].strip()
    match = _RANGE_RE.search(detail)
    if match:
        start, end = int(match.group(1)), int(match.group(2))
    elif detail.upper() in {"S", "SÁNG", "MORNING"}:
        start, end = 1, 6
    elif detail.upper() in {"C", "CHIỀU", "AFTERNOON"}:
        start, end = 7, 12
    elif detail.upper() in {"T", "TỐI", "EVENING", "NIGHT"}:
        start, end = 13, 18
    else:
        return None
    room = parts[2].strip() if len(parts) > 2 else None
    priority_match = re.search(r"\d+", parts[3]) if len(parts) > 3 else None
    priority = int(priority_match.group()) if priority_match else default_priority
    return {"date": day, "start": start, "end": end, "room": room,
            "priority": priority}


def _calendar_entries(values: Any, *, default_priority: int = 3) -> list[dict[str, Any]]:
    if values is None:
        return []
    if isinstance(values, (str, dict)):
        values = [values]
    result = []
    for raw in values:
        entry = _calendar_entry(raw, default_priority=default_priority)
        if entry:
            result.append(entry)
    return result


def _busy_conflicts(lecturer: dict[str, Any], exam: dict[str, Any]) -> list[dict[str, Any]]:
    day = _date_key(exam.get("date", exam.get("NgayThi")))
    start, end = _range_for(exam)
    conflicts = []
    for busy in _calendar_entries(lecturer.get("busy"), default_priority=3):
        if busy["date"] == day and start <= busy["end"] and busy["start"] <= end:
            conflicts.append(busy)
    return conflicts


def _busy_info(lecturer: dict[str, Any], exam: dict[str, Any]) -> dict[str, Any] | None:
    """Backward-compatible single-result helper; level 1 has highest precedence."""
    conflicts = _busy_conflicts(lecturer, exam)
    return min(conflicts, key=lambda entry: entry["priority"]) if conflicts else None


def _type_group(exam: dict[str, Any]) -> str:
    """Theory/multiple-choice and essay are the two allowed scheduling groups."""
    kind = str(exam.get("kind", exam.get("LoaiCa", ""))).strip().casefold()
    if kind in {"lt", "lý thuyết", "ly thuyet", "trắc nghiệm", "trac nghiem", "multiple choice"}:
        return "Lý thuyết"
    if kind in {"tl", "tự luận", "tu luan", "essay"}:
        return "Tự luận"
    return kind


def _session_group(exam: dict[str, Any]) -> int:
    """Resolve morning/afternoon/night; retain SQL-compatible period fallback."""
    label = str(_field(exam, "buoi", "Buoi", "session_label", "time_of_day") or "").casefold()
    if any(word in label for word in ("sáng", "sang", "morning")):
        return 1
    if any(word in label for word in ("chiều", "chieu", "afternoon")):
        return 2
    if any(word in label for word in ("tối", "toi", "night", "evening")):
        return 3
    start, _ = _range_for(exam)
    return 1 if start <= 6 else (2 if start <= 12 else 3)


def _teaching_conflict(lecturer: dict[str, Any], exam: dict[str, Any]) -> bool:
    day = _date_key(exam.get("date", exam.get("NgayThi")))
    start, end = _range_for(exam)
    for event in _calendar_entries(lecturer.get("teach")):
        if event["date"] == day and start <= event["end"] and event["start"] <= end:
            return True
    return False


def _fixed_events(lecturer: dict[str, Any]) -> list[dict[str, Any]]:
    """Teaching and exam-paper duty are both fixed hard-conflict events."""
    teaching = [dict(event, source="teach") for event in _calendar_entries(lecturer.get("teach"))]
    duty = [dict(event, source="duty")
            for event in _calendar_entries(lecturer.get("duty"), default_priority=1)]
    return teaching + duty


def _merge_fixed_event_intervals(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge overlapping or adjacent fixed events before finding exam gaps."""
    merged: list[dict[str, Any]] = []
    ordered = sorted(events, key=lambda event: (event["date"], event["start"], event["end"]))
    for event in ordered:
        current = {"date": event["date"], "start": event["start"], "end": event["end"]}
        if (merged and merged[-1]["date"] == current["date"]
                and current["start"] <= merged[-1]["end"] + 1):
            merged[-1]["end"] = max(merged[-1]["end"], current["end"])
        else:
            merged.append(current)
    return merged


def _rb9_fixed_events(lecturer: dict[str, Any]) -> list[dict[str, Any]]:
    """RB9 baseline events; duty_rb9 carries all rounds, matching the SQL view."""
    teaching = [dict(event, source="teach") for event in _calendar_entries(lecturer.get("teach"))]
    duty_values = lecturer.get("duty_rb9", lecturer.get("duty"))
    duty = [dict(event, source="duty")
            for event in _calendar_entries(duty_values, default_priority=1)]
    return teaching + duty


def _rb9_exam_type(exam: dict[str, Any]) -> str:
    """Match the database's TN rule: two-period exams or theory/multiple choice."""
    start, end = _range_for(exam)
    kind = str(_field(exam, "HinhThucThi", "kind", "LoaiCa", "loai_ca") or "").strip().casefold()
    if end - start + 1 == 2 or kind in {
        "tn", "lt", "trắc nghiệm", "trac nghiem", "lý thuyết", "ly thuyet",
        "multiple choice", "theory",
    }:
        return "TN"
    return "TL"


def _rb9_daily_limits(base_events: list[dict[str, Any]]) -> tuple[int, int]:
    """Return SQL-compatible max TN/TL shifts for a day's fixed baseline."""
    base_periods = sum(max(0, int(event["end"]) - int(event["start"]) + 1)
                       for event in base_events)
    base_blocks = len(base_events)
    if 5 <= base_periods <= 6:
        return 3, 2
    if base_blocks == 1:
        return 4, 3
    if base_blocks == 2:
        return 2, 2
    if base_blocks >= 3:
        return 1, 1
    return 2_147_483_647, 2_147_483_647


def _rb9_events_connected(events: list[dict[str, Any]]) -> bool:
    """Whether SQL's ordered event grouping puts these three events in one run."""
    ordered = sorted(events, key=lambda event: (int(event["start"]), int(event["end"])))
    reach = int(ordered[0]["end"])
    for event in ordered[1:]:
        start, end = int(event["start"]), int(event["end"])
        if start > reach + 1:
            return False
        reach = max(reach, end)
    return True


def _quotas(lecturers: list[dict[str, Any]], exams: list[dict[str, Any]]) -> dict[str, int]:
    """Largest-remainder fallback for standalone callers without SQL quotas."""
    total = sum(max(0, int(exam.get("need", 0) or 0)) for exam in exams)
    active = [lec for lec in lecturers if float(lec.get("pct", 0) or 0) > 0]
    pct_units = {str(lec.get("id")): int(round(float(lec.get("pct", 0) or 0) * 100)) for lec in active}
    pct_sum = sum(pct_units.values())
    result = {str(lec.get("id")): 0 for lec in lecturers}
    if not pct_sum:
        return result
    fractions, used = [], 0
    for lec in active:
        lid = str(lec.get("id"))
        base, remainder = divmod(total * pct_units[lid], pct_sum)
        result[lid] = base
        used += base
        fractions.append((lec, remainder, pct_units[lid]))
    fractions.sort(key=lambda item: (-item[1], -item[2], str(item[0].get("id"))))
    for index in range(total - used):
        result[str(fractions[index % len(fractions)][0].get("id"))] += 1
    return result


def _abs_deviation(model: Any, expression: Any, upper: int, name: str) -> Any:
    deviation = model.NewIntVar(0, max(1, upper), name)
    model.AddAbsEquality(deviation, expression)
    return deviation


def _week_key(value: Any) -> str | None:
    raw = _date_key(value)
    try:
        parsed = datetime.fromisoformat(raw).date()
        iso = parsed.isocalendar()
        return f"{iso.year}-{iso.week:02d}"
    except (TypeError, ValueError):
        return None


def solve_schedule(payload: dict[str, Any], progress_callback=None) -> dict[str, Any]:
    if cp_model is None:
        raise RuntimeError("Chưa cài Google OR-Tools. Hãy chạy: python -m pip install -r requirements.txt")

    started = monotonic()
    try:
        configured_time_limit = float(payload.get("time_limit_seconds", TOTAL_TIME_SECONDS))
    except (TypeError, ValueError):
        configured_time_limit = TOTAL_TIME_SECONDS
    if not math.isfinite(configured_time_limit):
        configured_time_limit = TOTAL_TIME_SECONDS
    total_time_seconds = min(300.0, max(1.0, configured_time_limit))
    feasibility_only = bool(payload.get("feasibility_only", False))
    min_travel_slots = normalize_min_travel_slots(payload.get("min_travel_slots"))
    lecturers = list(payload.get("lecturers") or [])
    exams = [dict(exam) for exam in (payload.get("exams") or [])]
    def is_locked(assignment: Any) -> bool:
        return isinstance(assignment, dict) and bool(assignment.get("lock") or assignment.get("locked"))

    # A new automatic run starts from a clean draft by default. Only explicitly
    # pinned assignments survive; callers may opt in to retaining the full draft.
    preserve_existing_draft = payload.get("preserve_existing_draft") is True
    for exam in exams:
        old_assignments = exam.get("asg") or []
        exam["asg"] = [
            assignment for assignment in old_assignments
            if isinstance(assignment, dict)
            and (preserve_existing_draft or is_locked(assignment))
        ]
    soft = payload.get("soft") if isinstance(payload.get("soft"), dict) else {}
    if not lecturers or not exams:
        return {"status": "INVALID", "assignments": [], "missing": 0,
                "objective_value": None, "wall_time_seconds": monotonic() - started,
                "message": "Cần có ít nhất một giảng viên và một ca thi."}

    lec_by_id = {str(lec.get("id")): lec for lec in lecturers}
    exam_by_id = {str(exam.get("id")): exam for exam in exams}
    if len(lec_by_id) != len(lecturers) or len(exam_by_id) != len(exams):
        return {"status": "INVALID", "assignments": [], "missing": 0,
                "objective_value": None, "wall_time_seconds": monotonic() - started,
                "message": "Dữ liệu có mã giảng viên hoặc mã ca thi bị trùng."}

    if payload.get("use_authoritative_quotas"):
        quota = {str(lec.get("id")): max(0, int(lec.get("quota", 0) or 0)) for lec in lecturers}
    else:
        quota = _quotas(lecturers, exams)
    total_needed = sum(max(0, int(exam.get("need", 0) or 0)) for exam in exams)
    if sum(quota.values()) != total_needed:
        message = (
            "Dữ liệu đầu vào xung đột ràng buộc cứng: "
            f"tổng định mức chính xác ({sum(quota.values())}) "
            f"không bằng tổng nhu cầu ca ({total_needed}). "
            "Hãy điều chỉnh định mức đã lưu trước khi xếp."
        )
        diagnostic = f"Tổng định mức={sum(quota.values())}; tổng nhu cầu={total_needed}"
        return {"status": "INFEASIBLE", "assignments": [], "missing": total_needed,
                "objective_value": None, "wall_time_seconds": monotonic() - started,
                "quotas": quota, "diagnostics": [diagnostic],
                "phase1_status": "INFEASIBLE", "phase2_status": "NOT_RUN",
                "phase1_time_seconds": 0.0, "phase2_time_seconds": 0.0,
                "not_fully_optimized": False, "hint_applied": False,
                "message": message}

    # Fast, actionable feasibility checks before constructing the full model.
    # These identify common causes more precisely than a bare INFEASIBLE result.
    eligible_by_exam: dict[str, list[str]] = defaultdict(list)
    eligible_by_lecturer: dict[str, list[str]] = defaultdict(list)
    blocked_by_lecturer: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for lec in lecturers:
        lid = str(lec.get("id"))
        fixed = _fixed_events(lec)
        for exam in exams:
            eid = str(exam.get("id"))
            if max(0, int(exam.get("need", 0) or 0)) <= 0 or quota[lid] <= 0:
                continue
            day = _date_key(exam.get("date", exam.get("NgayThi")))
            start, end = _range_for(exam)
            reason = None
            if any(event["date"] == day and start <= event["end"] and event["start"] <= end for event in fixed):
                reason = "trùng lịch dạy/trực đề"
            elif any(
                event["source"] == "teach"
                and event["date"] == day
                and rb7_teaching_exam_violation(
                    event.get("room"), event["start"], event["end"], start, end, min_travel_slots
                )
                for event in fixed
            ):
                reason = "không đủ tiết di chuyển khác cơ sở"
            elif any(item.get("priority", 3) == 1 for item in _busy_conflicts(lec, exam)):
                reason = "bận mức 1"
            if reason:
                blocked_by_lecturer[lid].append((eid, reason))
                continue
            eligible_by_exam[eid].append(lid)
            eligible_by_lecturer[lid].append(eid)

    for lec in lecturers:
        lid = str(lec.get("id"))
        required = quota[lid]
        available = len(eligible_by_lecturer[lid])
        if required > available:
            blocked = blocked_by_lecturer[lid]
            detail = "; ".join(f"{eid}: {reason}" for eid, reason in blocked[:6])
            suffix = f" Bị chặn: {detail}." if detail else ""
            return {
                "status": "INFEASIBLE", "assignments": [], "missing": total_needed,
                "objective_value": None, "wall_time_seconds": monotonic() - started,
                "quotas": quota,
                "message": f"Giảng viên {lid} cần đúng {required} ca theo định mức nhưng chỉ còn {available} ca đủ điều kiện.{suffix}",
                "diagnostics": [{"lecturer_id": lid, "required": required,
                                 "available": available, "blocked": blocked[:20]}],
            }

    for exam in exams:
        eid = str(exam.get("id"))
        need = max(0, int(exam.get("need", 0) or 0))
        available = len(eligible_by_exam[eid])
        if available < need:
            return {
                "status": "INFEASIBLE", "assignments": [], "missing": total_needed,
                "objective_value": None, "wall_time_seconds": monotonic() - started,
                "quotas": quota,
                "message": f"Ca thi {eid} cần {need} giám thị nhưng chỉ có {available} giảng viên đủ điều kiện.",
                "diagnostics": [{"exam_id": eid, "required": need,
                                 "available": available}],
            }

    model = cp_model.CpModel()
    assumptions: dict[tuple[Any, ...], Any] = {}
    assumption_labels: dict[int, str] = {}

    def guarded(group: tuple[Any, ...], label: str, constraint: Any) -> None:
        literal = assumptions.get(group)
        if literal is None:
            literal = model.NewBoolVar(f"assumption_{len(assumptions)}")
            assumptions[group] = literal
            assumption_labels[literal.Index()] = label
        constraint.OnlyEnforceIf(literal)

    # Keep only lecturer/exam pairs that survived fixed-calendar eligibility.
    # Pairwise conflicts between decision exams remain explicit constraints.
    x: dict[tuple[str, str], Any] = {}
    for exam in exams:
        eid = str(exam.get("id"))
        for lid in eligible_by_exam[eid]:
            x[(eid, lid)] = model.NewBoolVar(f"assign_{len(x)}")

    # Hard 1: exact SQL quota; zero-quota lecturers receive no exam shifts.
    for lec in lecturers:
        lid = str(lec.get("id"))
        guarded(
            ("quota", lid), f"Giảng viên {lid}: định mức chính xác {quota[lid]} ca",
            model.Add(sum(x.get((str(exam.get("id")), lid), 0) for exam in exams) == quota[lid]),
        )

    # Hard 2: every exam receives exactly its required headcount.
    for exam in exams:
        eid = str(exam.get("id"))
        need = max(0, int(exam.get("need", 0) or 0))
        guarded(
            ("headcount", eid), f"Ca thi {eid}: cần đủ {need} giám thị",
            model.Add(sum(x.get((eid, str(lec.get("id"))), 0) for lec in lecturers) == need),
        )

    # Hard 3/4/6/7: exam clashes, teaching, paper duty, level-1 busy time,
    # and travel from off-campus teaching to a main-campus exam.
    for lec in lecturers:
        lid = str(lec.get("id"))
        fixed = _fixed_events(lec)
        for exam in exams:
            eid = str(exam.get("id"))
            day = _date_key(exam.get("date", exam.get("NgayThi")))
            start, end = _range_for(exam)
            overlap_fixed = any(
                event["date"] == day and start <= event["end"] and event["start"] <= end
                for event in fixed
            )
            travel_blocked = any(
                event["source"] == "teach"
                and event["date"] == day
                and rb7_teaching_exam_violation(
                    event.get("room"), event["start"], event["end"], start, end, min_travel_slots
                )
                for event in fixed
            )
            busy_one = any(item.get("priority", 3) == 1 for item in _busy_conflicts(lec, exam))
            if overlap_fixed or travel_blocked or busy_one:
                reasons = []
                if overlap_fixed:
                    reasons.append("trùng lịch dạy/trực đề")
                if travel_blocked:
                    reasons.append("thiếu tiết di chuyển khác cơ sở")
                if busy_one:
                    reasons.append("bận mức 1")
                label = f"Giảng viên {lid}: lịch cố định chặn ca {eid} ({', '.join(reasons)})"
                # Such pairs are not created; this is retained defensively for
                # payloads where fixed-event normalization changes later.
                if (eid, lid) in x:
                    guarded(("calendar", lid, eid), label, model.Add(x[(eid, lid)] == 0))

        for i, first in enumerate(exams):
            first_day = _date_key(first.get("date", first.get("NgayThi")))
            first_start, first_end = _range_for(first)
            for second in exams[i + 1:]:
                second_day = _date_key(second.get("date", second.get("NgayThi")))
                second_start, second_end = _range_for(second)
                if first_day != second_day:
                    continue
                first_key = (str(first.get("id")), lid)
                second_key = (str(second.get("id")), lid)
                if first_key not in x or second_key not in x:
                    continue
                if first_start <= second_end and second_start <= first_end:
                    guarded(
                        ("time", lid, str(first.get("id")), str(second.get("id"))),
                        f"Giảng viên {lid}: có các ca thi giao thời gian trong cùng ngày",
                        model.Add(x[(str(first.get("id")), lid)] + x[(str(second.get("id")), lid)] <= 1),
                    )

    # Hard 9: mirror the SQL daily exam-count limits and continuous-event rule.
    # The legacy SQL RB9 counts all teaching/duty blocks as baseline, groups exam
    # counts by round and day, and counts continuous events across the whole day.
    for lec in lecturers:
        lid = str(lec.get("id"))
        base_by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for event in _rb9_fixed_events(lec):
            base_by_day[event["date"]].append(event)

        exams_by_dot_day: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
        exams_by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for exam in exams:
            day = _date_key(exam.get("date", exam.get("NgayThi")))
            dot = str(_field(exam, "ma_dot", "MaDot") or "")
            exams_by_dot_day[(dot, day)].append(exam)
            exams_by_day[day].append(exam)

        for (dot, day), day_exams in exams_by_dot_day.items():
            max_tn, max_tl = _rb9_daily_limits(base_by_day.get(day, []))
            for exam_type, limit in (("TN", max_tn), ("TL", max_tl)):
                variables = [
                    x[(str(exam.get("id")), lid)]
                    for exam in day_exams
                    if (str(exam.get("id")), lid) in x and _rb9_exam_type(exam) == exam_type
                ]
                if variables and limit < len(variables):
                    guarded(
                        ("rb9_daily_count", lid, dot, day, exam_type),
                        f"[RB9] Giảng viên {lid}: vượt giới hạn {exam_type} trong ngày {day}",
                        model.Add(sum(variables) <= limit),
                    )

        events_by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for day, events in base_by_day.items():
            events_by_day[day].extend(
                {"start": event["start"], "end": event["end"], "var": None}
                for event in events
            )
        for event in _calendar_entries(lec.get("rb9_other_exams")):
            events_by_day[event["date"]].append({
                "start": event["start"], "end": event["end"], "var": None,
            })
        for day, day_exams in exams_by_day.items():
            for exam in day_exams:
                eid = str(exam.get("id"))
                decision = x.get((eid, lid))
                if decision is None:
                    continue
                start, end = _range_for(exam)
                events_by_day[day].append({
                    "start": start, "end": end, "var": decision,
                    "night": start >= 13, "exam_id": eid,
                })

        for day, day_events in events_by_day.items():
            night_vars = [event["var"] for event in day_events if event.get("night")]
            if not night_vars:
                continue
            has_night_exam = model.NewBoolVar(f"rb9_has_night_exam_{lid}_{day}")
            model.AddMaxEquality(has_night_exam, night_vars)
            for triple in combinations(day_events, 3):
                if not _rb9_events_connected(list(triple)):
                    continue
                variables = [event["var"] for event in triple if event["var"] is not None]
                # SQL RB9 enables the continuity limit if any current-round
                # night exam is assigned that day. The three-event run itself
                # may be earlier in the day and need not contain the night exam.
                # If a night exam is active, at least one variable event in each
                # connected triple must therefore remain unassigned.
                continuity_constraint = model.Add(
                    sum(variables) + has_night_exam <= len(variables)
                )
                guarded(
                    ("rb9_continuity", lid, day),
                    f"[RB9] Giảng viên {lid}: khi có ca tối, không để chuỗi 3 lịch liên tục trong ngày {day}",
                    continuity_constraint,
                )

    # Night-load tolerance is modeled as RB8's optional soft objective below.
    MAX_TIET_TRONG_NGAY_TRUOC_CA_TOI = 12

    # Hard 5: only one exam group per lecturer per day/session.
    for lec in lecturers:
        lid = str(lec.get("id"))
        buckets: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
        for exam in exams:
            buckets[(_date_key(exam.get("date", exam.get("NgayThi"))), _session_group(exam))].append(exam)
        for bucket in buckets.values():
            for index, first in enumerate(bucket):
                for second in bucket[index + 1:]:
                    if _type_group(first) != _type_group(second):
                        first_key = (str(first.get("id")), lid)
                        second_key = (str(second.get("id")), lid)
                        if first_key not in x or second_key not in x:
                            continue
                        guarded(
                            ("form", lid, str(first.get("id")), str(second.get("id"))),
                            f"Giảng viên {lid}: ràng buộc một buổi chỉ một hình thức thi",
                            model.Add(x[(str(first.get("id")), lid)] + x[(str(second.get("id")), lid)] <= 1),
                        )

    # Limit each contiguous same-form cluster within a session. Deployments may
    # configure a per-session maximum; use three shifts when no setting exists.
    cluster_config = payload.get("session_cluster_max", payload.get("cluster_max_by_session", {}))
    def cluster_limit(session: int) -> int:
        if isinstance(cluster_config, dict):
            raw = cluster_config.get(session, cluster_config.get(str(session), 3))
            if raw is None:
                raw = 3
        else:
            raw = cluster_config if cluster_config is not None else 3
        try:
            return max(1, min(3, int(raw)))
        except (TypeError, ValueError):
            return 3

    by_session_type: dict[tuple[str, int, str], list[dict[str, Any]]] = defaultdict(list)
    for exam in exams:
        by_session_type[(
            _date_key(exam.get("date", exam.get("NgayThi"))),
            _session_group(exam),
            _type_group(exam),
        )].append(exam)
    for (day, session, _kind), same_form_exams in by_session_type.items():
        ordered = sorted(same_form_exams, key=lambda item: (_range_for(item)[0], _range_for(item)[1]))
        chain: list[dict[str, Any]] = []
        for exam in ordered:
            if chain and _range_for(chain[-1])[1] + 1 != _range_for(exam)[0]:
                _limit = cluster_limit(session)
                for offset in range(max(0, len(chain) - _limit)):
                    window = chain[offset:offset + _limit + 1]
                    for lec in lecturers:
                        lid = str(lec.get("id"))
                        window_vars = [x[(str(item.get("id")), lid)] for item in window
                                       if (str(item.get("id")), lid) in x]
                        if len(window_vars) <= _limit:
                            continue
                        guarded(
                            ("cluster", lid, tuple(str(item.get("id")) for item in window)),
                            f"Giảng viên {lid}: giới hạn cụm ca liên tiếp trong buổi",
                            model.Add(sum(window_vars) <= _limit),
                        )
                chain = []
            chain.append(exam)
        _limit = cluster_limit(session)
        for offset in range(max(0, len(chain) - _limit)):
            window = chain[offset:offset + _limit + 1]
            for lec in lecturers:
                lid = str(lec.get("id"))
                window_vars = [x[(str(item.get("id")), lid)] for item in window
                               if (str(item.get("id")), lid) in x]
                if len(window_vars) <= _limit:
                    continue
                guarded(
                    ("cluster", lid, tuple(str(item.get("id")) for item in window)),
                    f"Giảng viên {lid}: giới hạn cụm ca liên tiếp trong buổi",
                    model.Add(sum(window_vars) <= _limit),
                )

    # Keep pinned assignments. If explicitly requested, retain the entire prior
    # draft; otherwise all unpinned assignments were discarded above.
    for exam in exams:
        eid = str(exam.get("id"))
        for assignment in exam.get("asg") or []:
            if is_locked(assignment) or preserve_existing_draft:
                lid = str(assignment.get("l"))
                if lid in lec_by_id:
                    if (eid, lid) not in x:
                        return {
                            "status": "INFEASIBLE", "assignments": [], "missing": total_needed,
                            "objective_value": None, "wall_time_seconds": monotonic() - started,
                            "quotas": quota,
                            "diagnostics": [{"exam_id": eid, "lecturer_id": lid,
                                             "reason": "Phân công đã ghim không đủ điều kiện lịch cố định."}],
                            "message": f"Phân công đã ghim của giảng viên {lid} ở ca {eid} vi phạm lịch cố định hoặc định mức 0.",
                        }
                    guarded(
                        ("pinned", eid, lid),
                        f"Ca thi {eid}: phân công đã ghim/giữ cho giảng viên {lid}",
                        model.Add(x[(eid, lid)] == 1),
                    )

    if assumptions:
        model.AddAssumptions(list(assumptions.values()))

    def rule_enabled(rule_id: str) -> bool:
        cfg = soft.get(rule_id, {})
        if isinstance(cfg, bool):
            return cfg
        if not isinstance(cfg, dict):
            return True
        return cfg.get("on", cfg.get("enabled", True)) is not False

    def penalty_weight(rule_id: str) -> int:
        configured = payload.get("soft_weights", {})
        try:
            return max(0, int(configured.get(rule_id, SOFT_RULE_WEIGHTS[rule_id])))
        except (AttributeError, TypeError, ValueError):
            return SOFT_RULE_WEIGHTS[rule_id]

    def create_solver(seconds: float) -> Any:
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = max(0.1, float(seconds))
        worker_count = min(MAX_SOLVER_WORKERS, os.cpu_count() or 1)
        try:
            solver.parameters.num_workers = worker_count
        except (AttributeError, TypeError, ValueError):
            solver.parameters.num_search_workers = worker_count
        solver.parameters.log_search_progress = bool(payload.get("log_search_progress", False))
        return solver

    reported_solutions = [0]

    def report_progress(phase: str, phase_label: str, **details: Any) -> None:
        if not callable(progress_callback):
            return
        update = {
            "phase": phase,
            "phase_label": phase_label,
            "solutions_found": reported_solutions[0],
        }
        update.update(details)
        try:
            progress_callback(update)
        except Exception:
            LOGGER.exception("Could not publish CP-SAT progress update")

    def solution_callback_for(phase: str, phase_label: str):
        class ProgressCallback(cp_model.CpSolverSolutionCallback):
            def on_solution_callback(self) -> None:
                reported_solutions[0] += 1
                details: dict[str, Any] = {}
                if phase == "optimizing_soft":
                    try:
                        details["best_objective"] = float(self.ObjectiveValue()) / objective_scale
                    except (AttributeError, RuntimeError, ValueError):
                        pass
                    try:
                        details["best_bound"] = float(self.BestObjectiveBound()) / objective_scale
                    except (AttributeError, RuntimeError, ValueError):
                        pass
                report_progress(phase, phase_label, **details)

        return ProgressCallback()

    def values_from_solver(solver: Any) -> dict[tuple[str, str], int]:
        return {key: int(solver.Value(var)) for key, var in x.items()}

    def assignments_from_values(values: dict[tuple[str, str], int]) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []
        for exam in exams:
            eid = str(exam.get("id"))
            locked_ids = {
                str(assignment.get("l")) for assignment in (exam.get("asg") or [])
                if is_locked(assignment)
            }
            for lec in lecturers:
                lid = str(lec.get("id"))
                if values.get((eid, lid), 0):
                    result.append({"exam_id": exam.get("id"), "lecturer_id": lec.get("id"),
                                   "locked": lid in locked_ids})
        return result

    def hard_conflict_diagnostics(solver: Any) -> list[str]:
        found: list[str] = []
        try:
            for literal in solver.SufficientAssumptionsForInfeasibility():
                literal_index = int(literal)
                variable_index = literal_index if literal_index >= 0 else -literal_index - 1
                label = assumption_labels.get(variable_index)
                if label and label not in found:
                    found.append(label)
        except (AttributeError, RuntimeError, TypeError, ValueError):
            pass
        return found

    # Shared by objective construction and post-solve diagnostics. Keep these in
    # solve_schedule scope so the diagnostics can use them after P2 completes.
    lecturers_with_quota = [lec for lec in lecturers if quota.get(str(lec.get("id")), 0) > 0]
    total_quota = sum(quota.values())
    # Keep the displayed objective in points while comparing proportional quota
    # deviations exactly as integer CP-SAT terms: raw model objective = points * scale.
    objective_scale = max(1, total_quota)

    def add_soft_objective() -> list[Any]:
        """Add P2-only auxiliaries and objective terms to the already-built model."""
        terms: list[Any] = []
        deviation_bound = max(1, total_needed * max(1, total_quota))

        # RB8: penalize once per lecturer-day if a night assignment makes the
        # total teaching, paper-duty and exam load exceed 12 periods.
        if rule_enabled("RB8"):
            by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for exam in exams:
                by_day[_date_key(exam.get("date", exam.get("NgayThi")))].append(exam)
            for lec in lecturers:
                lid = str(lec.get("id"))
                fixed_by_day: dict[str, int] = defaultdict(int)
                for event in _rb9_fixed_events(lec):
                    fixed_by_day[event["date"]] += max(1, int(event["end"]) - int(event["start"]) + 1)
                for day, day_exams in by_day.items():
                    night_vars = []
                    day_load_terms = []
                    for exam in day_exams:
                        eid = str(exam.get("id"))
                        decision = x.get((eid, lid))
                        if decision is None:
                            continue
                        start, end = _range_for(exam)
                        day_load_terms.append(max(1, end - start + 1) * decision)
                        if start >= 13:
                            night_vars.append(decision)
                    if not night_vars:
                        continue
                    has_night = model.NewBoolVar(f"rb8_has_night_{lid}_{day}")
                    model.AddMaxEquality(has_night, night_vars)
                    fixed_load = fixed_by_day.get(day, 0)
                    total_load = fixed_load + sum(day_load_terms)
                    over_limit = model.NewBoolVar(f"rb8_over_limit_{lid}_{day}")
                    model.Add(total_load >= MAX_TIET_TRONG_NGAY_TRUOC_CA_TOI + 1).OnlyEnforceIf(over_limit)
                    model.Add(total_load <= MAX_TIET_TRONG_NGAY_TRUOC_CA_TOI).OnlyEnforceIf(over_limit.Not())
                    violation = model.NewBoolVar(f"rb8_violation_{lid}_{day}")
                    model.AddBoolAnd([has_night, over_limit]).OnlyEnforceIf(violation)
                    model.AddBoolOr([has_night.Not(), over_limit.Not()]).OnlyEnforceIf(violation.Not())
                    terms.append(penalty_weight("RB8") * objective_scale * violation)

        # S1: minimize lecturer-days and add the same surcharge for a one-event day.
        # Teaching and duty are fixed events, so assigning onto those days can avoid a new trip.
        # A one-event day adds one more S1 penalty unit.
        if rule_enabled("S1"):
            by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for exam in exams:
                by_day[_date_key(exam.get("date", exam.get("NgayThi")))].append(exam)
            for lec in lecturers_with_quota:
                lid = str(lec.get("id"))
                fixed_by_day: dict[str, int] = defaultdict(int)
                for event in _rb9_fixed_events(lec):
                    fixed_by_day[event["date"]] += 1
                for day in set(by_day) | set(fixed_by_day):
                    day_exams = by_day.get(day, [])
                    day_vars = [x[(str(exam.get("id")), lid)] for exam in day_exams
                                if (str(exam.get("id")), lid) in x]
                    fixed_count = fixed_by_day.get(day, 0)
                    if not day_vars and not fixed_count:
                        continue
                    count = fixed_count + sum(day_vars)
                    used_day = model.NewBoolVar(f"s1_day_used_{lid}_{day}")
                    singleton = model.NewBoolVar(f"s1_singleton_{lid}_{day}")
                    model.Add(count >= 1).OnlyEnforceIf(used_day)
                    model.Add(count == 0).OnlyEnforceIf(used_day.Not())
                    if fixed_count:
                        model.Add(singleton == 0)
                    else:
                        exam_count = sum(day_vars)
                        model.Add(exam_count == 1).OnlyEnforceIf(singleton)
                        model.Add(exam_count != 1).OnlyEnforceIf(singleton.Not())
                    terms.append(penalty_weight("S1") * objective_scale * used_day)
                    terms.append(penalty_weight("S1") * objective_scale * singleton)

        # S2: proportional balance in assignment units; night is weighted twice.
        if rule_enabled("S2"):
            for session in (1, 2, 3):
                group_exams = [exam for exam in exams if _session_group(exam) == session]
                group_total = sum(
                    x.get((str(exam.get("id")), str(lec.get("id"))), 0)
                    for exam in group_exams for lec in lecturers
                )
                session_scale = 2 if session == 3 else 1
                for lec in lecturers_with_quota:
                    lid = str(lec.get("id"))
                    count = sum(x.get((str(exam.get("id")), lid), 0) for exam in group_exams)
                    expression = count * total_quota - group_total * quota[lid]
                    terms.append(penalty_weight("S2") * session_scale * _abs_deviation(
                        model, expression, deviation_bound, f"s2_session_{session}_{lid}"))

        # S5: proportional balance by exam format, measured in assignment units.
        if rule_enabled("S5"):
            for group in {_type_group(exam) for exam in exams}:
                group_exams = [exam for exam in exams if _type_group(exam) == group]
                group_total = sum(
                    x.get((str(exam.get("id")), str(lec.get("id"))), 0)
                    for exam in group_exams for lec in lecturers
                )
                for lec in lecturers_with_quota:
                    lid = str(lec.get("id"))
                    count = sum(x.get((str(exam.get("id")), lid), 0) for exam in group_exams)
                    expression = count * total_quota - group_total * quota[lid]
                    terms.append(penalty_weight("S5") * _abs_deviation(
                        model, expression, deviation_bound, f"s5_format_{group}_{lid}"))

        # S6/S7: soft busy periods. Hard level-1 busy was removed at variable build.
        busy_weights = {
            2: penalty_weight("S6") * objective_scale if rule_enabled("S6") else 0,
            3: penalty_weight("S7") * objective_scale if rule_enabled("S7") else 0,
        }
        if any(busy_weights.values()):
            for exam in exams:
                eid = str(exam.get("id"))
                for lec in lecturers:
                    lid = str(lec.get("id"))
                    decision = x.get((eid, lid))
                    if decision is None:
                        continue
                    priorities = {entry["priority"] for entry in _busy_conflicts(lec, exam)}
                    for priority in priorities:
                        weight = busy_weights.get(priority, 0)
                        if weight:
                            terms.append(weight * decision)

        # S3: penalize each idle period in 1-2-slot gaps around fixed events or exams.
        if rule_enabled("S3"):
            for lec in lecturers:
                lid = str(lec.get("id"))
                fixed = _merge_fixed_event_intervals(_rb9_fixed_events(lec))
                for event_index, event in enumerate(fixed):
                    for exam in exams:
                        eid = str(exam.get("id"))
                        exam_var = x.get((eid, lid))
                        if exam_var is None or event["date"] != _date_key(exam.get("date", exam.get("NgayThi"))):
                            continue
                        start, end = _range_for(exam)
                        if event["end"] < start:
                            idle = start - event["end"] - 1
                            fixed_between = any(
                                index != event_index and other["date"] == event["date"]
                                and event["end"] < other["start"]
                                and other["end"] < start
                                for index, other in enumerate(fixed)
                            )
                            between = [x[(str(other.get("id")), lid)] for other in exams
                                       if (str(other.get("id")), lid) in x
                                       and _date_key(other.get("date", other.get("NgayThi"))) == event["date"]
                                       and event["end"] < _range_for(other)[0] < start
                                       and str(other.get("id")) != eid]
                        elif end < event["start"]:
                            idle = event["start"] - end - 1
                            fixed_between = any(
                                index != event_index and other["date"] == event["date"]
                                and end < other["start"]
                                and other["end"] < event["start"]
                                for index, other in enumerate(fixed)
                            )
                            between = [x[(str(other.get("id")), lid)] for other in exams
                                       if (str(other.get("id")), lid) in x
                                       and _date_key(other.get("date", other.get("NgayThi"))) == event["date"]
                                       and end < _range_for(other)[0] < event["start"]
                                       and str(other.get("id")) != eid]
                        else:
                            continue
                        if 1 <= idle <= 2 and not fixed_between:
                            gap = model.NewBoolVar(f"s3_fixed_gap_{lid}_{event_index}_{eid}")
                            model.Add(gap <= exam_var)
                            for middle_var in between:
                                model.Add(gap + middle_var <= 1)
                            model.Add(gap >= exam_var - sum(between))
                            terms.append(penalty_weight("S3") * objective_scale * idle * gap)

            by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for exam in exams:
                by_day[_date_key(exam.get("date", exam.get("NgayThi")))].append(exam)
            for lec in lecturers:
                lid = str(lec.get("id"))
                for day, day_exams in by_day.items():
                    ordered = sorted(day_exams, key=lambda item: (
                        _range_for(item)[0], _range_for(item)[1], str(item.get("id"))))
                    for i, previous in enumerate(ordered):
                        previous_id = str(previous.get("id"))
                        previous_start, previous_end = _range_for(previous)
                        previous_var = x.get((previous_id, lid))
                        if previous_var is None:
                            continue
                        for current in ordered[i + 1:]:
                            current_id = str(current.get("id"))
                            current_start, _ = _range_for(current)
                            current_var = x.get((current_id, lid))
                            if current_var is None or current_start <= previous_end:
                                continue
                            idle = current_start - previous_end - 1
                            if not 1 <= idle <= 2:
                                continue
                            if any(event["date"] == day
                                   and previous_end < event["start"]
                                   and event["end"] < current_start
                                   for event in fixed):
                                continue
                            between = [x[(str(middle.get("id")), lid)] for middle in ordered
                                       if (str(middle.get("id")), lid) in x
                                       and previous_start < _range_for(middle)[0] < current_start
                                       and str(middle.get("id")) not in {previous_id, current_id}]
                            gap = model.NewBoolVar(f"s3_exam_gap_{lid}_{previous_id}_{current_id}")
                            model.Add(gap <= previous_var)
                            model.Add(gap <= current_var)
                            for middle_var in between:
                                model.Add(gap + middle_var <= 1)
                            model.Add(gap >= previous_var + current_var - 1 - sum(between))
                            terms.append(penalty_weight("S3") * objective_scale * idle * gap)

        # S4: concentrate a lecturer's assignments into fewer calendar weeks.
        if rule_enabled("S4"):
            by_week: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for exam in exams:
                week = _week_key(exam.get("date", exam.get("NgayThi")))
                if week:
                    by_week[week].append(exam)
            for lec in lecturers_with_quota:
                lid = str(lec.get("id"))
                for week, week_exams in by_week.items():
                    week_vars = [x[(str(exam.get("id")), lid)] for exam in week_exams
                                 if (str(exam.get("id")), lid) in x]
                    if not week_vars:
                        continue
                    used = model.NewBoolVar(f"s4_week_used_{lid}_{week}")
                    for var in week_vars:
                        model.Add(used >= var)
                    model.Add(used <= sum(week_vars))
                    terms.append(penalty_weight("S4") * objective_scale * used)

        model.Minimize(sum(terms) if terms else 0)
        return terms

    # Phase 1: satisfaction only. No auxiliary objective variables are added here.
    report_progress("finding_feasible", "Đang tìm lịch thỏa các ràng buộc cứng")
    if feasibility_only:
        phase1_budget = total_time_seconds
    else:
        # Reserve an optimization window even for the 30-second quick mode.
        # For standard/deep runs this remains 30s/60s, respectively.
        phase1_budget = min(total_time_seconds, max(15.0, min(60.0, total_time_seconds * 0.25)))
    phase1_solver = create_solver(phase1_budget)
    phase1_started = monotonic()
    phase1_callback = solution_callback_for("finding_feasible", "Đang tìm lịch thỏa các ràng buộc cứng")
    phase1_code = phase1_solver.Solve(model, phase1_callback)
    phase1_elapsed = float(phase1_solver.WallTime() or (monotonic() - phase1_started))
    phase1_status = phase1_solver.StatusName(phase1_code)
    LOGGER.info("CP-SAT P1 built vars=%d constraints=%d; status=%s wall=%.3fs",
                len(model.Proto().variables), len(model.Proto().constraints),
                phase1_status, phase1_elapsed)

    if phase1_code == cp_model.INFEASIBLE:
        diagnostics = hard_conflict_diagnostics(phase1_solver)
        message = "Dữ liệu đầu vào xung đột ràng buộc cứng"
        if diagnostics:
            message += ": " + "; ".join(diagnostics[:10])
        else:
            message += ". Hãy kiểm tra định mức, lịch cố định, ca thi và các phân công đã ghim."
        return {"status": "INFEASIBLE", "assignments": [], "missing": total_needed,
                "objective_value": None, "wall_time_seconds": phase1_elapsed,
                "quotas": quota, "diagnostics": diagnostics,
                "phase1_status": phase1_status, "phase2_status": "NOT_RUN",
                "phase1_time_seconds": phase1_elapsed, "phase2_time_seconds": 0.0,
                "not_fully_optimized": False, "hint_applied": False,
                "message": message}
    if phase1_code == cp_model.UNKNOWN:
        seconds = f"{phase1_elapsed:.0f}"
        return {"status": "UNKNOWN", "assignments": [], "missing": total_needed,
                "objective_value": None, "wall_time_seconds": phase1_elapsed,
                "quotas": quota, "diagnostics": [],
                "phase1_status": phase1_status, "phase2_status": "NOT_RUN",
                "phase1_time_seconds": phase1_elapsed, "phase2_time_seconds": 0.0,
                "not_fully_optimized": False, "hint_applied": False,
                "message": f"Chưa tìm được nghiệm trong {seconds} giây, hãy nới ràng buộc hoặc tăng thời gian."}
    if phase1_code not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {"status": phase1_status, "assignments": [], "missing": total_needed,
                "objective_value": None, "wall_time_seconds": phase1_elapsed,
                "quotas": quota, "diagnostics": [],
                "phase1_status": phase1_status, "phase2_status": "NOT_RUN",
                "phase1_time_seconds": phase1_elapsed, "phase2_time_seconds": 0.0,
                "not_fully_optimized": False, "hint_applied": False,
                "message": "Bộ giải không hoàn tất được pha tìm nghiệm thỏa ràng buộc cứng."}

    # Capture the valid incumbent before introducing any P2-only variables/objective.
    phase1_solution = values_from_solver(phase1_solver)
    p2_started = monotonic()
    p2_budget = max(0.1, total_time_seconds - phase1_elapsed)
    phase2_status = "SKIPPED_QUICK" if feasibility_only else "ERROR"
    phase2_elapsed = 0.0
    phase2_solution = phase1_solution
    phase2_objective: float | None = None
    hint_applied = False
    phase2_improved = False
    p2_solver = None
    if feasibility_only:
        report_progress("completed", "Đã tìm được lịch thỏa ràng buộc cứng; bỏ qua tối ưu mềm")
    else:
        try:
            try:
                model.ClearHints()
            except AttributeError:
                hint = getattr(model.Proto(), "solution_hint", None)
                if hint is not None and hasattr(hint, "Clear"):
                    hint.Clear()
            for key, var in x.items():
                model.AddHint(var, phase1_solution[key])
            hint_applied = True
            add_soft_objective()
            report_progress("optimizing_soft", "Đang tối ưu thứ tự ưu tiên các ràng buộc mềm")
            p2_solver = create_solver(p2_budget)
            phase2_callback = solution_callback_for("optimizing_soft", "Đang tối ưu thứ tự ưu tiên các ràng buộc mềm")
            p2_code = p2_solver.Solve(model, phase2_callback)
            phase2_elapsed = float(p2_solver.WallTime() or (monotonic() - p2_started))
            phase2_status = p2_solver.StatusName(p2_code)
            if p2_code in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                candidate = values_from_solver(p2_solver)
                phase2_improved = candidate != phase1_solution
                phase2_solution = candidate
                phase2_objective = float(p2_solver.ObjectiveValue()) / objective_scale
            LOGGER.info("CP-SAT P2 status=%s wall=%.3fs objective=%s hint_submitted=%s improved=%s",
                        phase2_status, phase2_elapsed, phase2_objective,
                        hint_applied, phase2_improved)
        except Exception:
            phase2_elapsed = monotonic() - p2_started
            LOGGER.exception("CP-SAT P2 failed; falling back to P1 solution")
            phase2_status = "ERROR"

    use_phase2 = phase2_status in ("OPTIMAL", "FEASIBLE")
    selected_solution = phase2_solution if use_phase2 else phase1_solution
    assignments = assignments_from_values(selected_solution)
    missing = max(0, total_needed - len(assignments))

    # Diagnostic counts are deliberately computed from the selected assignment map,
    # not from auxiliary solver variables, so fallback results remain reportable.
    soft_violations: dict[str, int | float | None] = {key: None for key in SOFT_RULE_WEIGHTS}
    soft_details: dict[str, dict[str, int | float]] = {}
    if rule_enabled("RB8"):
        rb8_violation_days = 0
        for lec in lecturers:
            lid = str(lec.get("id"))
            by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for exam in exams:
                if selected_solution.get((str(exam.get("id")), lid), 0):
                    by_day[_date_key(exam.get("date", exam.get("NgayThi")))].append(exam)
            fixed_by_day: dict[str, int] = defaultdict(int)
            for event in _rb9_fixed_events(lec):
                fixed_by_day[event["date"]] += max(1, int(event["end"]) - int(event["start"]) + 1)
            for day, day_exams in by_day.items():
                if any(_range_for(exam)[0] >= 13 for exam in day_exams):
                    exam_load = sum(max(1, _range_for(exam)[1] - _range_for(exam)[0] + 1)
                                    for exam in day_exams)
                    if fixed_by_day.get(day, 0) + exam_load > MAX_TIET_TRONG_NGAY_TRUOC_CA_TOI:
                        rb8_violation_days += 1
        soft_violations["RB8"] = rb8_violation_days
        soft_details["RB8"] = {"violating_lecturer_days": rb8_violation_days}
    if rule_enabled("S1"):
        lecturer_day_count = 0
        singleton_day_count = 0
        for lec in lecturers_with_quota:
            lid = str(lec.get("id"))
            by_day: dict[str, int] = defaultdict(int)
            fixed_days = set()
            for event in _rb9_fixed_events(lec):
                by_day[event["date"]] += 1
                fixed_days.add(event["date"])
            exam_days: dict[str, int] = defaultdict(int)
            for exam in exams:
                if selected_solution.get((str(exam.get("id")), lid), 0):
                    day = _date_key(exam.get("date", exam.get("NgayThi")))
                    by_day[day] += 1
                    exam_days[day] += 1
            lecturer_day_count += len(by_day)
            singleton_day_count += sum(count == 1 and day not in fixed_days
                                       for day, count in exam_days.items())
        # One diagnostic unit is one used day plus one extra unit for a singleton day.
        soft_violations["S1"] = lecturer_day_count + singleton_day_count
        soft_details["S1"] = {
            "lecturer_days": lecturer_day_count,
            "singleton_exam_days": singleton_day_count,
        }
    if rule_enabled("S2") or rule_enabled("S5"):
        for rule_id, groups, kind in (
            ("S2", {_session_group(exam) for exam in exams}, "session"),
            ("S5", {_type_group(exam) for exam in exams}, "format"),
        ):
            if not rule_enabled(rule_id):
                continue
            imbalance_units = 0.0
            for group in groups:
                group_exams = [exam for exam in exams if
                               (_session_group(exam) if kind == "session" else _type_group(exam)) == group]
                group_total = sum(selected_solution.get((str(exam.get("id")), str(lec.get("id"))), 0)
                                  for exam in group_exams for lec in lecturers)
                for lec in lecturers_with_quota:
                    lid = str(lec.get("id"))
                    count = sum(selected_solution.get((str(exam.get("id")), lid), 0) for exam in group_exams)
                    deviation = abs(count * total_quota - group_total * quota[lid]) / objective_scale
                    if kind == "session" and group == 3:
                        deviation *= 2
                    imbalance_units += deviation
            soft_violations[rule_id] = imbalance_units
            soft_details[rule_id] = {"weighted_deviation_units": imbalance_units}
    if rule_enabled("S6") or rule_enabled("S7"):
        for rule_id, priority in (("S6", 2), ("S7", 3)):
            if not rule_enabled(rule_id):
                continue
            soft_violations[rule_id] = sum(
                selected_solution.get((str(exam.get("id")), str(lec.get("id"))), 0)
                for exam in exams for lec in lecturers
                if any(entry["priority"] == priority for entry in _busy_conflicts(lec, exam))
            )
            soft_details[rule_id] = {"overlapping_assignments": soft_violations[rule_id] or 0}
    if rule_enabled("S3"):
        idle_period_units = 0
        for lec in lecturers:
            lid = str(lec.get("id"))
            assigned = [exam for exam in exams if selected_solution.get((str(exam.get("id")), lid), 0)]
            by_day_assigned: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for exam in assigned:
                by_day_assigned[_date_key(exam.get("date", exam.get("NgayThi")))].append(exam)
            fixed_by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for event in _merge_fixed_event_intervals(_rb9_fixed_events(lec)):
                fixed_by_day[event["date"]].append(event)
            for day in set(by_day_assigned) | set(fixed_by_day):
                events = [dict(event, is_exam=False) for event in fixed_by_day.get(day, [])]
                events.extend(
                    {"start": _range_for(exam)[0], "end": _range_for(exam)[1], "is_exam": True}
                    for exam in by_day_assigned.get(day, [])
                )
                ordered = sorted(events, key=lambda event: (event["start"], event["end"]))
                for previous, current in zip(ordered, ordered[1:]):
                    if not previous["is_exam"] and not current["is_exam"]:
                        continue
                    if previous["end"] >= current["start"]:
                        continue
                    idle = current["start"] - previous["end"] - 1
                    if 1 <= idle <= 2:
                        idle_period_units += idle
        soft_violations["S3"] = idle_period_units
        soft_details["S3"] = {"idle_periods": idle_period_units}
    if rule_enabled("S4"):
        active_week_count = 0
        for lec in lecturers_with_quota:
            lid = str(lec.get("id"))
            active_week_count += len({
                _week_key(exam.get("date", exam.get("NgayThi"))) for exam in exams
                if selected_solution.get((str(exam.get("id")), lid), 0)
                and _week_key(exam.get("date", exam.get("NgayThi")))
            })
        # This is a compact clustering diagnostic (number of lecturer-weeks used).
        soft_violations["S4"] = active_week_count
        soft_details["S4"] = {"lecturer_weeks": active_week_count}

    soft_penalties = {
        rule_id: (
            None if units is None
            else round(float(units) * penalty_weight(rule_id), 6)
        )
        for rule_id, units in soft_violations.items()
    }
    soft_penalty_total = round(sum(value for value in soft_penalties.values() if value is not None), 6)

    # A P2 solution is usable even when it keeps the same assignment: its
    # objective still gives the correct penalty score and may prove optimality.
    phase2_usable = use_phase2
    if not phase2_usable:
        selected_solution = phase1_solution
        assignments = assignments_from_values(selected_solution)
        missing = max(0, total_needed - len(assignments))
        objective_value = None
        if feasibility_only:
            status = "FEASIBLE"
            message = "Đã tìm được lịch thỏa ràng buộc cứng ở chế độ Xếp nhanh; chưa tối ưu ràng buộc mềm."
        else:
            status = phase1_status
            message = "Đã tìm được lịch thỏa ràng buộc cứng; dùng nghiệm pha 1 vì pha 2 không tìm được cải thiện."
    else:
        status = phase2_status
        objective_value = phase2_objective
        message = "Đã tìm được lịch bằng Google OR-Tools CP-SAT với định mức chính xác."
        if phase2_status == "FEASIBLE":
            message += " Pha tối ưu hóa dừng theo thời gian; lịch hiện tại chưa tối ưu hoàn toàn."

    total_elapsed = phase1_elapsed + phase2_elapsed
    LOGGER.info("CP-SAT result status=%s p1=%s/%.3fs p2=%s/%.3fs objective=%s vars=%d constraints=%d",
                status, phase1_status, phase1_elapsed, phase2_status, phase2_elapsed,
                objective_value, len(model.Proto().variables), len(model.Proto().constraints))
    return {"status": status, "assignments": assignments, "missing": missing,
            "objective_value": objective_value, "wall_time_seconds": total_elapsed,
            "quotas": quota, "message": message,
            "phase1_status": phase1_status, "phase2_status": phase2_status,
            "phase1_time_seconds": phase1_elapsed, "phase2_time_seconds": phase2_elapsed,
            "not_fully_optimized": phase2_status != "OPTIMAL",
            "phase2_improved": phase2_improved, "hint_applied": hint_applied,
            "soft_violations": soft_violations, "soft_penalties": soft_penalties,
            "soft_penalty_total": soft_penalty_total,
            "soft_details": soft_details,
            "soft_weights": {rule_id: penalty_weight(rule_id) for rule_id in SOFT_RULE_WEIGHTS}}
