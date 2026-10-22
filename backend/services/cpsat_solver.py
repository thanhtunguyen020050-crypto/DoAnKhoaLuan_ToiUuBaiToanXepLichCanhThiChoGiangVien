"""Mô hình tối ưu xếp lịch gác thi bằng Google OR-Tools CP-SAT.

Module này chỉ nhận dữ liệu đã chuẩn hóa và trả về kết quả; không chứa API
hoặc truy vấn SQL để có thể kiểm thử độc lập.
"""
from __future__ import annotations
from collections import defaultdict
from time import monotonic
from typing import Any

try:
    from ortools.sat.python import cp_model
except ImportError:  # Hiển thị thông báo rõ nếu chưa cài requirements
    cp_model = None


def _range_for(exam: dict[str, Any]) -> tuple[int, int]:
    period = str(exam.get("period", ""))
    import re
    match = re.search(r"(\d+)\s*[→>-]\s*(\d+)", period)
    if match:
        return int(match.group(1)), int(match.group(2))
    session = int(exam.get("ses", 0) or 0)
    return {1: (1, 2), 2: (3, 4), 3: (7, 8), 4: (9, 10)}.get(session, (0, 0))


def _overlap(a: dict[str, Any], b: dict[str, Any]) -> bool:
    a1, a2 = _range_for(a)
    b1, b2 = _range_for(b)
    # SQL stores inclusive lesson ranges and checks overlap with <=.
    return a1 <= b2 and b1 <= a2


def _busy_info(lecturer: dict[str, Any], exam: dict[str, Any]) -> dict[str, Any] | None:
    date = str(exam.get("date", ""))
    start, end = _range_for(exam)
    for item in lecturer.get("busy") or []:
        busy = item if isinstance(item, dict) else {"key": str(item), "priority": 3}
        key = str(busy.get("key", ""))
        if not key.startswith(date + "|"):
            continue
        block = key.split("|", 1)[1]
        bstart, bend = (1, 6) if block == "S" else (7, 12)
        if start <= bend and bstart <= end:
            return busy
    return None


def _type_group(exam: dict[str, Any]) -> str:
    """Match SQL NhomHinhThucThi: theory and multiple choice share one group."""
    kind = str(exam.get("kind", "")).strip()
    if kind.upper() in {"LT", "LÝ THUYẾT", "TRẮC NGHIỆM"}:
        return "Lý thuyết"
    if kind.upper() in {"TL", "TỰ LUẬN"}:
        return "Tự luận"
    return kind


def _session_group(exam: dict[str, Any]) -> int:
    """Use the same session boundaries as SQL CaThi.Buoi."""
    start, _ = _range_for(exam)
    return 1 if start <= 6 else (2 if start <= 12 else 3)


def _teaching_conflict(lecturer: dict[str, Any], exam: dict[str, Any]) -> bool:
    date = str(exam.get("date", ""))
    start, end = _range_for(exam)
    import re
    for raw in lecturer.get("teach") or []:
        parts = str(raw).split("|", 1)
        if len(parts) != 2 or parts[0] != date:
            continue
        match = re.match(r"\s*(\d+)\s*[→>-]\s*(\d+)\s*$", parts[1])
        if match and start <= int(match.group(2)) and int(match.group(1)) <= end:
            return True
    return False


def _quotas(lecturers: list[dict[str, Any]], exams: list[dict[str, Any]]) -> dict[str, int]:
    total = sum(max(0, int(e.get("need", 0) or 0)) for e in exams)
    active = [l for l in lecturers if float(l.get("pct", 0) or 0) > 0]
    # SQL stores percentages as DECIMAL(5,2). Use integer basis points so
    # the largest-remainder order matches SQL exactly, including tied values.
    pct_units = {str(l.get("id")): int(round(float(l.get("pct", 0) or 0) * 100)) for l in active}
    pct_sum = sum(pct_units.values())
    result = {str(l.get("id")): 0 for l in lecturers}
    if not pct_sum:
        return result
    fractions = []
    used = 0
    for lec in active:
        units = pct_units[str(lec.get("id"))]
        numerator = total * units
        base, remainder = divmod(numerator, pct_sum)
        result[str(lec.get("id"))] = base
        used += base
        fractions.append((lec, remainder, units))
    # Keep the same largest-remainder order as SQL sp_TinhDinhMucTheoTyLe:
    # fractional remainder DESC, percentage DESC, lecturer ID ASC.
    fractions.sort(key=lambda item: (-item[1], -item[2], str(item[0].get("id"))))
    i = 0
    while used < total and fractions:
        result[str(fractions[i % len(fractions)][0].get("id"))] += 1
        used += 1
        i += 1
    return result


def solve_schedule(payload: dict[str, Any]) -> dict[str, Any]:
    if cp_model is None:
        raise RuntimeError("Chưa cài Google OR-Tools. Hãy chạy: python -m pip install -r requirements.txt")

    started = monotonic()
    lecturers = list(payload.get("lecturers") or [])
    exams = list(payload.get("exams") or [])
    soft = payload.get("soft") or {}
    if not lecturers or not exams:
        return {"status": "INVALID", "assignments": [], "missing": 0,
                "objective_value": None, "wall_time_seconds": monotonic()-started,
                "message": "Cần có ít nhất một giảng viên và một ca thi."}

    lec_by_id = {str(l.get("id")): l for l in lecturers}
    exam_by_id = {str(e.get("id")): e for e in exams}
    quota = _quotas(lecturers, exams)
    model = cp_model.CpModel()
    x: dict[tuple[str, str], Any] = {}

    for exam in exams:
        eid = str(exam.get("id"))
        for lec in lecturers:
            lid = str(lec.get("id"))
            x[(eid, lid)] = model.NewBoolVar(f"assign_{len(x)}")

    # Mỗi ca phải đủ số giảng viên được yêu cầu.
    for exam in exams:
        eid = str(exam.get("id"))
        need = max(0, int(exam.get("need", 0) or 0))
        model.Add(sum(x[(eid, str(l.get("id")))] for l in lecturers) == need)

    # Mỗi giảng viên có định mức theo tỷ lệ, cho phép lệch tối đa 1 ca.
    # Người có quota 0 (định mức 0%) vẫn không được nhận ca.
    for lec in lecturers:
        lid = str(lec.get("id"))
        assigned = sum(x[(str(e.get("id")), lid)] for e in exams)
        if quota[lid] <= 0:
            model.Add(assigned == 0)
        else:
            model.Add(assigned >= max(0, quota[lid] - 1))
            model.Add(assigned <= quota[lid] + 1)

    # Giảng viên không thể nhận các ca thi bị trùng giờ; không xếp trùng lịch dạy.
    for lec in lecturers:
        lid = str(lec.get("id"))
        for i, a in enumerate(exams):
            aid = str(a.get("id"))
            if _teaching_conflict(lec, a):
                model.Add(x[(aid, lid)] == 0)
            busy = _busy_info(lec, a)
            if busy and int(busy.get("priority", 3) or 3) == 1:
                model.Add(x[(aid, lid)] == 0)
            for b in exams[i+1:]:
                if str(a.get("date")) == str(b.get("date")) and _overlap(a, b):
                    model.Add(x[(aid, lid)] + x[(str(b.get("id")), lid)] <= 1)

    # Giữ phân công đã khóa; nếu khóa vi phạm hard constraint, CP-SAT sẽ báo infeasible.
    for exam in exams:
        eid = str(exam.get("id"))
        locked = [str(a.get("l")) for a in (exam.get("asg") or []) if a.get("lock")]
        for lid in locked:
            if lid in lec_by_id:
                model.Add(x[(eid, lid)] == 1)
        for lec in lecturers:
            lid = str(lec.get("id"))
            if lid not in locked:
                model.Add(x[(eid, lid)] == 0) if False else None

    # RB5: do not mix exam groups for one lecturer within the same SQL session.
    for lec in lecturers:
        lid = str(lec.get("id"))
        buckets: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
        for exam in exams:
            buckets[(str(exam.get("date")), str(_session_group(exam)))].append(exam)
        for bucket in buckets.values():
            for i, a in enumerate(bucket):
                for b in bucket[i+1:]:
                    if _type_group(a) != _type_group(b):
                        model.Add(x[(str(a.get("id")), lid)] + x[(str(b.get("id")), lid)] <= 1)

    # Hàm mục tiêu: né lịch bận (soft) và hạn chế ca gãy trong ngày.
    penalties = []
    s2 = soft.get("S2", {}) if isinstance(soft, dict) else {}
    s2_on = bool(s2.get("on", True))
    for exam in exams:
        eid = str(exam.get("id"))
        for lec in lecturers:
            lid = str(lec.get("id"))
            busy = _busy_info(lec, exam)
            if busy and s2_on:
                priority = int(busy.get("priority", 3) or 3)
                weight = 1000 if priority == 1 else (6 if priority == 2 else 2)
                penalties.append(weight * x[(eid, lid)])

    # Phạt khoảng trống giữa hai ca liên tiếp của cùng giảng viên trong một ngày.
    # Chuyển từ sáng sang chiều cũng tính là ca gãy, kể cả khi tiết cuối sáng
    # và tiết đầu chiều có số thứ tự liên tiếp (ví dụ 5-6 rồi 7-8).
    gap_weight = int((soft.get("S1", {}) or {}).get("w", 6)) if isinstance(soft, dict) else 6
    if isinstance(soft, dict) and (soft.get("S1", {}) or {}).get("on", True):
        for lec in lecturers:
            lid = str(lec.get("id"))
            by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for exam in exams:
                by_day[str(exam.get("date"))].append(exam)
            for day_exams in by_day.values():
                ordered = sorted(
                    day_exams,
                    key=lambda exam: (_range_for(exam)[0], _range_for(exam)[1], str(exam.get("id"))),
                )
                for i, prev_exam in enumerate(ordered):
                    prev_start, prev_end = _range_for(prev_exam)
                    for cur_exam in ordered[i + 1:]:
                        cur_start, _ = _range_for(cur_exam)
                        if prev_end >= cur_start:
                            continue
                        idle_periods = max(0, cur_start - prev_end - 1)
                        crosses_session = _session_group(prev_exam) != _session_group(cur_exam)
                        gap_size = max(idle_periods, 1 if crosses_session else 0)
                        if not gap_size:
                            continue

                        prev_id, cur_id = str(prev_exam.get("id")), str(cur_exam.get("id"))
                        between = [
                            x[(str(middle.get("id")), lid)]
                            for middle in ordered
                            if prev_start < _range_for(middle)[0] < cur_start
                            and str(middle.get("id")) not in {prev_id, cur_id}
                        ]
                        consecutive = model.NewBoolVar(
                            f"gap_{lid}_{prev_exam.get('date')}_{prev_id}_{cur_id}"
                        )
                        prev_var, cur_var = x[(prev_id, lid)], x[(cur_id, lid)]
                        model.Add(consecutive <= prev_var)
                        model.Add(consecutive <= cur_var)
                        model.Add(consecutive + sum(between) <= 1)
                        model.Add(consecutive >= prev_var + cur_var - 1 - sum(between))
                        penalties.append(gap_weight * gap_size * consecutive)

    model.Minimize(sum(penalties) if penalties else 0)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(payload.get("time_limit_seconds", 20) or 20)
    solver.parameters.num_search_workers = 8
    status_code = solver.Solve(model)
    status = solver.StatusName(status_code)
    if status_code not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {"status": status, "assignments": [], "missing": sum(max(0, int(e.get("need", 0) or 0)) for e in exams),
                "objective_value": None, "wall_time_seconds": solver.WallTime(),
                "message": "Không tìm được lịch thỏa các ràng buộc cứng (định mức, trùng ca, lịch dạy, lịch bận mức 1, không trộn loại ca trong cùng buổi). Hãy kiểm tra dữ liệu và phân công đã khóa."}

    assignments = []
    for exam in exams:
        eid = str(exam.get("id"))
        locked_ids = {str(a.get("l")) for a in (exam.get("asg") or []) if a.get("lock")}
        for lec in lecturers:
            lid = str(lec.get("id"))
            if solver.Value(x[(eid, lid)]):
                assignments.append({"exam_id": exam.get("id"), "lecturer_id": lec.get("id"), "locked": lid in locked_ids})
    needed = sum(max(0, int(e.get("need", 0) or 0)) for e in exams)
    missing = max(0, needed - len(assignments))
    return {"status": status, "assignments": assignments, "missing": missing,
            "objective_value": solver.ObjectiveValue(), "wall_time_seconds": solver.WallTime(),
            "message": "Đã tìm được lịch bằng Google OR-Tools CP-SAT."}
