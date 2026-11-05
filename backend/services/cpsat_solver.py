"""CP-SAT exam invigilation scheduler.

The solver accepts normalized records, but also tolerates the legacy calendar
strings still emitted by older callers. SQL-provided quotas are authoritative
when ``use_authoritative_quotas`` is set.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date as date_type
from datetime import datetime
import logging
import os
import re
import unicodedata
from time import monotonic
from typing import Any

try:
    from ortools.sat.python import cp_model
except ImportError:  # pragma: no cover - surfaced to the API caller
    cp_model = None


_RANGE_RE = re.compile(r"(\d+)\s*[→>-]\s*(\d+)")
TOTAL_TIME_SECONDS = 120.0
PHASE1_TIME_SECONDS = 30.0
MAX_SOLVER_WORKERS = 8
SOFT_RULE_WEIGHTS = {"S1": 1000, "S2": 800, "S3": 600, "S4": 400, "S5": 250, "S6": 100}
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
            "room": _field(record, "room", "Phong", "DiaDiem", "dia_diem", "location", "campus"),
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


def _same_campus(left: Any, right: Any) -> bool:
    """Compare locations, preferring street-address identity over room labels."""
    def normalize(value: Any) -> str:
        value = unicodedata.normalize("NFKD", str(value or "").casefold())
        value = "".join(ch for ch in value if not unicodedata.combining(ch))
        return re.sub(r"[^a-z0-9]+", " ", value).strip()

    a, b = normalize(left), normalize(right)
    if not a or not b:
        return True  # Unknown location alone must not fabricate a campus conflict.
    # Common HU IT campus addresses and general numbered street addresses.
    def address(value: str) -> str | None:
        for marker in ("tan ky tan quy", "le trong tan"):
            if marker in value:
                number = re.search(rf"\b(\d{{1,4}})\s+{marker}\b", value)
                return f"{number.group(1) if number else ''} {marker}".strip()
        match = re.search(r"\b(\d{1,4})\s+([a-z]+(?:\s+[a-z]+){1,5})", value)
        return " ".join(match.groups()) if match else None

    address_a, address_b = address(a), address(b)
    if address_a or address_b:
        return bool(address_a and address_b and address_a == address_b)
    # Ignore room-level identifiers so A101 and B306 at the same named site
    # are not mistaken for campuses; retain the named building/site itself.
    def site(value: str) -> str:
        value = re.sub(r"\b(?:phong|room|p)\s*[a-z]?\s*\d{2,4}\b", " ", value)
        value = re.sub(r"\b[a-z]\s*\d{2,4}\b", " ", value)
        value = re.sub(r"\b\d{2,4}\b", " ", value)
        value = re.sub(r"\b(?:phong hoc|phong may tinh|classroom)\b", " ", value)
        return " ".join(value.split())
    site_a, site_b = site(a), site(b)
    return site_a == site_b if site_a and site_b else a == b


def _teaching_conflict(lecturer: dict[str, Any], exam: dict[str, Any]) -> bool:
    day = _date_key(exam.get("date", exam.get("NgayThi")))
    start, end = _range_for(exam)
    for event in _calendar_entries(lecturer.get("teach")):
        if event["date"] == day and start <= event["end"] and event["start"] <= end:
            return True
    return False


def _fixed_events(lecturer: dict[str, Any]) -> list[dict[str, Any]]:
    """Teaching and exam-paper duty are both fixed hard-conflict events."""
    return (_calendar_entries(lecturer.get("teach"))
            + _calendar_entries(lecturer.get("duty"), default_priority=1))


def _different_campus_travel_conflict(exam: dict[str, Any], event: dict[str, Any]) -> bool:
    if not exam.get("room") or not event.get("room") or _same_campus(exam.get("room"), event.get("room")):
        return False
    exam_start, exam_end = _range_for(exam)
    if exam_end < event["start"]:
        idle = event["start"] - exam_end - 1
    elif event["end"] < exam_start:
        idle = exam_start - event["end"] - 1
    else:
        return True
    return idle < 1


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


def solve_schedule(payload: dict[str, Any]) -> dict[str, Any]:
    if cp_model is None:
        raise RuntimeError("Chưa cài Google OR-Tools. Hãy chạy: python -m pip install -r requirements.txt")

    started = monotonic()
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
            elif any(event["date"] == day and _different_campus_travel_conflict(exam, event) for event in fixed):
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
    # and one free lesson for travel between different campus locations.
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
                event["date"] == day and _different_campus_travel_conflict(exam, event)
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
                elif first_end < second_start and not _same_campus(first.get("room"), second.get("room")):
                    if second_start - first_end - 1 < 1:
                        guarded(
                            ("time", lid, str(first.get("id")), str(second.get("id"))),
                            f"Giảng viên {lid}: thiếu tiết di chuyển giữa ca {first.get('id')} và {second.get('id')}",
                            model.Add(x[(str(first.get("id")), lid)] + x[(str(second.get("id")), lid)] <= 1),
                        )
                elif second_end < first_start and not _same_campus(first.get("room"), second.get("room")):
                    if first_start - second_end - 1 < 1:
                        guarded(
                            ("time", lid, str(second.get("id")), str(first.get("id"))),
                            f"Giảng viên {lid}: thiếu tiết di chuyển giữa ca {second.get('id')} và {first.get('id')}",
                            model.Add(x[(str(first.get("id")), lid)] + x[(str(second.get("id")), lid)] <= 1),
                        )

    # Hard night workload cap: teaching and paper-duty periods count 1:1.
    # Hard 8: teaching, paper-duty, and exam periods share a 12-period daily cap
    # whenever this lecturer is assigned an exam beginning at period 13 or later.
    MAX_TIET_TRONG_NGAY_TRUOC_CA_TOI = 12
    for lec in lecturers:
        lid = str(lec.get("id"))
        fixed = _fixed_events(lec)
        exams_by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for exam in exams:
            day = _date_key(exam.get("date", exam.get("NgayThi")))
            exams_by_day[day].append(exam)

        for day, day_exams in exams_by_day.items():
            fixed_load = sum(
                max(1, int(event["end"]) - int(event["start"]) + 1)
                for event in fixed if event["date"] == day
            )
            exam_load = []
            for exam in day_exams:
                eid = str(exam.get("id"))
                key = (eid, lid)
                if key not in x:
                    continue
                start, end = _range_for(exam)
                exam_load.append(max(1, end - start + 1) * x[key])

            for exam in day_exams:
                eid = str(exam.get("id"))
                start, _ = _range_for(exam)
                night_var = x.get((eid, lid))
                if start < 13 or night_var is None:
                    continue
                load_constraint = model.Add(
                    fixed_load + sum(exam_load) <= MAX_TIET_TRONG_NGAY_TRUOC_CA_TOI
                )
                load_constraint.OnlyEnforceIf(night_var)
                guarded(
                    ("night_daily_load", lid, day, eid),
                    f"[H8] Giảng viên {lid}: tổng tải ngày vượt "
                    f"{MAX_TIET_TRONG_NGAY_TRUOC_CA_TOI} tiết khi nhận ca tối {eid}",
                    load_constraint,
                )

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

    def add_soft_objective() -> list[Any]:
        """Add P2-only auxiliaries and objective terms to the already-built model."""
        terms: list[Any] = []
        deviation_bound = max(1, total_needed * max(1, total_quota))

        # S1: proportional balance across sessions; night is weighted most
        # strongly while all three session groups share the configured priority.
        if rule_enabled("S1"):
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
                    terms.append(SOFT_RULE_WEIGHTS["S1"] * session_scale * _abs_deviation(
                        model, expression, deviation_bound, f"s1_session_{session}_{lid}"))

        # S4: balance exam formats across the round in proportion to quota.
        if rule_enabled("S4"):
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
                    terms.append(SOFT_RULE_WEIGHTS["S4"] * _abs_deviation(
                        model, expression, deviation_bound, f"s4_format_{group}_{lid}"))

        # S5/S6: soft busy periods. Hard level-1 busy was removed at variable build.
        busy_weights = {
            2: SOFT_RULE_WEIGHTS["S5"] if rule_enabled("S5") else 0,
            3: SOFT_RULE_WEIGHTS["S6"] if rule_enabled("S6") else 0,
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

        # S2: penalize 1-2-slot gaps around fixed events or between chosen exams.
        if rule_enabled("S2"):
            for lec in lecturers:
                lid = str(lec.get("id"))
                fixed = _fixed_events(lec)
                for event_index, event in enumerate(fixed):
                    for exam in exams:
                        eid = str(exam.get("id"))
                        exam_var = x.get((eid, lid))
                        if exam_var is None or event["date"] != _date_key(exam.get("date", exam.get("NgayThi"))):
                            continue
                        if not _same_campus(event.get("room"), exam.get("room")):
                            continue
                        start, end = _range_for(exam)
                        if event["end"] < start:
                            idle = start - event["end"] - 1
                            between = [x[(str(other.get("id")), lid)] for other in exams
                                       if (str(other.get("id")), lid) in x
                                       and event["end"] < _range_for(other)[0] < start
                                       and str(other.get("id")) != eid]
                        elif end < event["start"]:
                            idle = event["start"] - end - 1
                            between = [x[(str(other.get("id")), lid)] for other in exams
                                       if (str(other.get("id")), lid) in x
                                       and end < _range_for(other)[0] < event["start"]
                                       and str(other.get("id")) != eid]
                        else:
                            continue
                        if 1 <= idle <= 2:
                            gap = model.NewBoolVar(f"s2_fixed_gap_{lid}_{event_index}_{eid}")
                            model.Add(gap <= exam_var)
                            for middle_var in between:
                                model.Add(gap + middle_var <= 1)
                            model.Add(gap >= exam_var - sum(between))
                            terms.append(SOFT_RULE_WEIGHTS["S2"] * idle * gap)

            by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for exam in exams:
                by_day[_date_key(exam.get("date", exam.get("NgayThi")))].append(exam)
            for lec in lecturers:
                lid = str(lec.get("id"))
                for day_exams in by_day.values():
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
                            between = [x[(str(middle.get("id")), lid)] for middle in ordered
                                       if (str(middle.get("id")), lid) in x
                                       and previous_start < _range_for(middle)[0] < current_start
                                       and str(middle.get("id")) not in {previous_id, current_id}]
                            gap = model.NewBoolVar(f"s2_exam_gap_{lid}_{previous_id}_{current_id}")
                            model.Add(gap <= previous_var)
                            model.Add(gap <= current_var)
                            for middle_var in between:
                                model.Add(gap + middle_var <= 1)
                            model.Add(gap >= previous_var + current_var - 1 - sum(between))
                            terms.append(SOFT_RULE_WEIGHTS["S2"] * idle * gap)

        # S3: reward adjacent same-form assignments and concentrate duties in fewer weeks.
        if rule_enabled("S3"):
            by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
            by_week: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for exam in exams:
                by_day[_date_key(exam.get("date", exam.get("NgayThi")))].append(exam)
                week = _week_key(exam.get("date", exam.get("NgayThi")))
                if week:
                    by_week[week].append(exam)
            for lec in lecturers_with_quota:
                lid = str(lec.get("id"))
                for day_exams in by_day.values():
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
                            if current_var is None:
                                continue
                            if (current_start == previous_end + 1
                                    and _session_group(previous) == _session_group(current)
                                    and _type_group(previous) == _type_group(current)):
                                adjacent = model.NewBoolVar(f"s3_cluster_{lid}_{previous_id}_{current_id}")
                                model.Add(adjacent <= previous_var)
                                model.Add(adjacent <= current_var)
                                model.Add(adjacent >= previous_var + current_var - 1)
                                terms.append(-SOFT_RULE_WEIGHTS["S3"] * adjacent)
                for week, week_exams in by_week.items():
                    week_vars = [x[(str(exam.get("id")), lid)] for exam in week_exams
                                 if (str(exam.get("id")), lid) in x]
                    if not week_vars:
                        continue
                    used = model.NewBoolVar(f"s3_week_used_{lid}_{week}")
                    for var in week_vars:
                        model.Add(used >= var)
                    model.Add(used <= sum(week_vars))
                    terms.append(SOFT_RULE_WEIGHTS["S3"] * used)

        model.Minimize(sum(terms) if terms else 0)
        return terms

    # Phase 1: satisfaction only. No auxiliary objective variables are added here.
    phase1_solver = create_solver(min(PHASE1_TIME_SECONDS, TOTAL_TIME_SECONDS))
    phase1_started = monotonic()
    phase1_code = phase1_solver.Solve(model)
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
    p2_budget = max(10.0, TOTAL_TIME_SECONDS - phase1_elapsed)
    phase2_status = "ERROR"
    phase2_elapsed = 0.0
    phase2_solution = phase1_solution
    phase2_objective: float | None = None
    hint_applied = False
    phase2_improved = False
    p2_solver = None
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
        p2_solver = create_solver(p2_budget)
        p2_code = p2_solver.Solve(model)
        phase2_elapsed = float(p2_solver.WallTime() or (monotonic() - p2_started))
        phase2_status = p2_solver.StatusName(p2_code)
        if p2_code in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            candidate = values_from_solver(p2_solver)
            phase2_improved = candidate != phase1_solution
            phase2_solution = candidate
            phase2_objective = float(p2_solver.ObjectiveValue())
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
    soft_violations: dict[str, int | None] = {key: None for key in SOFT_RULE_WEIGHTS}
    if rule_enabled("S1") or rule_enabled("S4"):
        for rule_id, groups, kind in (
            ("S1", {_session_group(exam) for exam in exams}, "session"),
            ("S4", {_type_group(exam) for exam in exams}, "format"),
        ):
            if not rule_enabled(rule_id):
                continue
            imbalanced = 0
            for group in groups:
                group_exams = [exam for exam in exams if
                               (_session_group(exam) if kind == "session" else _type_group(exam)) == group]
                group_total = sum(selected_solution.get((str(exam.get("id")), str(lec.get("id"))), 0)
                                  for exam in group_exams for lec in lecturers)
                for lec in lecturers_with_quota:
                    lid = str(lec.get("id"))
                    count = sum(selected_solution.get((str(exam.get("id")), lid), 0) for exam in group_exams)
                    if count * total_quota != group_total * quota[lid]:
                        imbalanced += 1
            soft_violations[rule_id] = imbalanced
    if rule_enabled("S5") or rule_enabled("S6"):
        for rule_id, priority in (("S5", 2), ("S6", 3)):
            if not rule_enabled(rule_id):
                continue
            soft_violations[rule_id] = sum(
                selected_solution.get((str(exam.get("id")), str(lec.get("id"))), 0)
                for exam in exams for lec in lecturers
                if any(entry["priority"] == priority for entry in _busy_conflicts(lec, exam))
            )
    if rule_enabled("S2"):
        gap_count = 0
        for lec in lecturers:
            lid = str(lec.get("id"))
            assigned = [exam for exam in exams if selected_solution.get((str(exam.get("id")), lid), 0)]
            for exam in assigned:
                start, end = _range_for(exam)
                if any(event["date"] == _date_key(exam.get("date", exam.get("NgayThi")))
                       and _same_campus(event.get("room"), exam.get("room"))
                       and (1 <= start - event["end"] - 1 <= 2
                            or 1 <= event["start"] - end - 1 <= 2)
                       for event in _fixed_events(lec)):
                    gap_count += 1
            assigned.sort(key=lambda item: (_date_key(item.get("date", item.get("NgayThi"))),
                                             _range_for(item)[0]))
            for previous, current in zip(assigned, assigned[1:]):
                if _date_key(previous.get("date", previous.get("NgayThi"))) != _date_key(current.get("date", current.get("NgayThi"))):
                    continue
                idle = _range_for(current)[0] - _range_for(previous)[1] - 1
                if 1 <= idle <= 2:
                    gap_count += 1
        soft_violations["S2"] = gap_count
    if rule_enabled("S3"):
        active_week_count = 0
        for lec in lecturers_with_quota:
            lid = str(lec.get("id"))
            active_week_count += len({
                _week_key(exam.get("date", exam.get("NgayThi"))) for exam in exams
                if selected_solution.get((str(exam.get("id")), lid), 0)
                and _week_key(exam.get("date", exam.get("NgayThi")))
            })
        # This is a compact clustering diagnostic (number of lecturer-weeks used).
        soft_violations["S3"] = active_week_count

    # Keep the P1 incumbent if P2 found no different assignment. P1 is already
    # guaranteed to satisfy every hard constraint.
    phase2_usable = use_phase2 and phase2_improved
    if not phase2_usable:
        selected_solution = phase1_solution
        assignments = assignments_from_values(selected_solution)
        missing = max(0, total_needed - len(assignments))
        status = phase1_status
        objective_value = None
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
            "soft_violations": soft_violations}
