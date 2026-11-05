"""HTTP endpoints dành riêng cho chức năng xếp lịch."""

import re
from decimal import Decimal, InvalidOperation, ROUND_FLOOR

from fastapi import APIRouter, HTTPException

try:
    from ..schemas.scheduling import ScheduleRequest
    from ..services.cpsat_solver import solve_schedule
    from ..ketnoi_sql import get_connection
except ImportError:
    from schemas.scheduling import ScheduleRequest
    from services.cpsat_solver import solve_schedule
    from ketnoi_sql import get_connection

_SOFT_WEIGHTS = {"S1": 1000, "S2": 800, "S3": 600, "S4": 400, "S5": 250, "S6": 100}


def _rebalance_quota_rows(rows, total_needed):
    """Apportion exact integer quotas by stored percentage using largest remainder."""
    total_needed = max(0, int(total_needed or 0))
    weights = {}
    for row in rows:
        lecturer_id = str(row[0]).strip()
        try:
            weight = Decimal(str(row[1] or 0))
        except (InvalidOperation, ValueError):
            weight = Decimal(0)
        weights[lecturer_id] = max(Decimal(0), weight)

    weight_sum = sum(weights.values(), Decimal(0))
    if weight_sum <= 0:
        raise HTTPException(
            status_code=400,
            detail="Không thể cân bằng định mức: tổng tỷ lệ định mức của giảng viên tham gia phải lớn hơn 0.",
        )

    exact = {lecturer_id: Decimal(total_needed) * weight / weight_sum
             for lecturer_id, weight in weights.items()}
    quotas = {lecturer_id: int(value.to_integral_value(rounding=ROUND_FLOOR))
              for lecturer_id, value in exact.items()}
    remainder = total_needed - sum(quotas.values())
    order = sorted(exact, key=lambda lecturer_id: (-(exact[lecturer_id] - quotas[lecturer_id]), lecturer_id))
    for lecturer_id in order[:remainder]:
        quotas[lecturer_id] += 1
    return quotas


def _normalize_soft_config(value):
    """Convert browser soft-rule flags to fixed solver weights."""
    source = value if isinstance(value, dict) else {}
    normalized = {}
    weights = {}
    for rule_id, fixed_weight in _SOFT_WEIGHTS.items():
        raw = source.get(rule_id, True)
        enabled_value = raw.get("on", raw.get("enabled", True)) if isinstance(raw, dict) else raw
        if isinstance(enabled_value, str):
            enabled = enabled_value.strip().casefold() not in {"", "0", "false", "off", "no"}
        else:
            enabled = bool(enabled_value)

        weight = fixed_weight if enabled else 0
        normalized[rule_id] = {
            "on": enabled,
            "enabled": enabled,
            "w": weight,
            "weight": weight,
            "priority": weight,
        }
        weights[rule_id] = weight
    return normalized, weights


def _norm(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").casefold())


def _columns(cur, table):
    cur.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
        "WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME=?",
        table,
    )
    return [row[0] for row in cur.fetchall()]


def _read_calendar_rows(cur, table, lecturer_ids, *, ma_dot=None):
    """Read known calendar tables without assuming optional columns exist."""
    if not lecturer_ids:
        return [], False
    columns = _columns(cur, table)
    by_norm = {_norm(column): column for column in columns}
    lecturer_col = next((by_norm[key] for key in ("magv", "lecturerid") if key in by_norm), None)
    if not lecturer_col:
        return [], False

    dot_col = next((by_norm[key] for key in ("madot", "dotthiid") if key in by_norm), None)
    filters = [f"[{lecturer_col.replace(']', ']]')}] IN ({','.join('?' for _ in lecturer_ids)})"]
    params = list(lecturer_ids)
    if ma_dot is not None and dot_col:
        filters.append(f"[{dot_col.replace(']', ']]')}] = ?")
        params.append(ma_dot)
    table_sql = f"[dbo].[{table.replace(']', ']]')}]"
    cur.execute(f"SELECT * FROM {table_sql} WHERE {' AND '.join(filters)}", *params)
    names = [description[0] for description in cur.description]
    rows = []

    date_keys = ("ngayday", "ngayhoc", "ngaythi", "ngayban", "ngay", "date", "ngaybatdau")
    start_keys = ("tutiet", "tietbatdau", "startperiod", "start", "tietbd")
    end_keys = ("dentiet", "tietketthuc", "endperiod", "end", "tietkt")
    period_keys = ("period", "ca", "buoi", "khoangtiet", "tiet")
    room_keys = ("phong", "diadiem", "coso", "location", "campus")
    priority_keys = ("mucdo", "mucdoban", "priority", "capdoban")

    for values in cur.fetchall():
        record = {_norm(name): value for name, value in zip(names, values)}
        day = next((record[key] for key in date_keys if record.get(key) not in (None, "")), None)
        start = next((record[key] for key in start_keys if record.get(key) not in (None, "")), None)
        end = next((record[key] for key in end_keys if record.get(key) not in (None, "")), None)
        period = next((record[key] for key in period_keys if record.get(key) not in (None, "")), None)
        room = next((record[key] for key in room_keys if record.get(key) not in (None, "")), None)
        priority_raw = next((record[key] for key in priority_keys if record.get(key) not in (None, "")), 3)
        priority_match = re.search(r"\d+", str(priority_raw))
        priority = int(priority_match.group()) if priority_match else 3
        if day is None:
            continue
        entry = {
            "MaGV": str(record.get("magv", "")).strip(),
            "date": day,
            "room": room,
            "priority": priority,
        }
        if start is not None and end is not None:
            entry.update(start=start, end=end)
        elif period is not None:
            entry["period"] = str(period)
        rows.append(entry)
    return rows, True


def _merge_calendar(sql_rows, table_exists, client_rows):
    """Prefer current SQL calendar data; fall back for deployments without its table."""
    return sql_rows if table_exists else client_rows


def _normalize_exam(exam):
    item = dict(exam)
    item.setdefault("id", item.get("MaCa"))
    item.setdefault("date", item.get("NgayThi", item.get("ngay_thi")))
    item.setdefault("period", item.get("CaTiet", item.get("ca_tiet", item.get("Ca", ""))))
    item.setdefault("need", item.get("SoGiamThiCan", item.get("SoGiamThi", item.get("so_giam_thi", 0))))
    item.setdefault("kind", item.get("LoaiCa", item.get("loai_ca", "")))
    item.setdefault("room", item.get("Phong", item.get("DiaDiem", item.get("dia_diem"))))
    item.setdefault("ma_dot", item.get("MaDot"))
    return item


def run_cpsat(request: ScheduleRequest):
    """Read SQL-authoritative quotas/calendars; never write quota from the browser."""
    try:
        payload = request.model_dump()
        payload["soft"], payload["soft_weights"] = _normalize_soft_config(payload.get("soft"))
        payload["exams"] = [_normalize_exam(exam) for exam in payload.get("exams", [])]
        dot_ids = {str(exam.get('ma_dot')) for exam in payload['exams'] if exam.get('ma_dot')}
        if payload.get("ma_dot"):
            dot_ids.add(str(payload["ma_dot"]))
        if len(dot_ids) > 1:
            raise HTTPException(status_code=400, detail='Các ca thi gửi lên thuộc nhiều đợt thi khác nhau.')
        if not dot_ids:
            raise HTTPException(status_code=400, detail='Không xác định được đợt thi để đọc định mức đã lưu trong SQL.')
        if dot_ids:
            ma_dot = next(iter(dot_ids))
            with get_connection() as cn:
                cur = cn.cursor()
                # Recalculate exact quotas from percentages already stored in SQL.
                # Never copy the browser's percentage values back into this table.
                cur.execute("EXEC dbo.sp_TinhDinhMucTheoTyLe ?", ma_dot)
                while cur.nextset():
                    pass
                cur.execute(
                    """
                    SELECT d.MaGV, d.TyLeDinhMuc, d.SoCaQuyDinh
                    FROM dbo.DinhMucPhanCong d
                    JOIN dbo.GiangVien g ON g.MaGV=d.MaGV
                    WHERE d.MaDot=? AND g.TrangThai=N'Đang công tác'
                    """,
                    ma_dot,
                )
                participant_rows = cur.fetchall()
                total_needed = sum(max(0, int(exam.get("need", 0) or 0)) for exam in payload["exams"])
                saved_quota_total = sum(max(0, int(row[2] or 0)) for row in participant_rows)
                if saved_quota_total != total_needed:
                    # The stored procedure normally keeps this total aligned. Repair stale
                    # or manually edited totals before CP-SAT receives exact quotas.
                    balanced = _rebalance_quota_rows(participant_rows, total_needed)
                    for lecturer_id, exact_quota in balanced.items():
                        cur.execute(
                            "UPDATE dbo.DinhMucPhanCong SET SoCaQuyDinh=? WHERE MaDot=? AND MaGV=?",
                            exact_quota,
                            ma_dot,
                            lecturer_id,
                        )
                    cn.commit()
                    participant_rows = [
                        (row[0], row[1], balanced[str(row[0]).strip()])
                        for row in participant_rows
                    ]
                participant_by_id = {
                    str(row[0]).strip(): {"pct": float(row[1] or 0), "quota": int(row[2] or 0)}
                    for row in participant_rows
                }
                participating_ids = set(participant_by_id)
                requested_ids = {
                    str(lecturer.get("id", "")).strip()
                    for lecturer in payload["lecturers"]
                }
                excluded_ids = requested_ids - participating_ids
                if excluded_ids:
                    raise HTTPException(
                        status_code=400,
                        detail="Danh sách xếp lịch có giảng viên chưa được chọn tham gia đợt thi.",
                    )
                client_by_id = {
                    str(lecturer.get("id", "")).strip(): lecturer
                    for lecturer in payload["lecturers"]
                }
                lecturer_ids = sorted(participating_ids)
                sql_teach, has_teach_table = _read_calendar_rows(cur, "LichDayGV", lecturer_ids)
                sql_busy, has_busy_table = _read_calendar_rows(cur, "LichBanGV", lecturer_ids)
                sql_duty, has_duty_table = _read_calendar_rows(
                    cur, "PhanCongTrucDe", lecturer_ids, ma_dot=ma_dot
                )

                # The participant set and exact quotas come only from SQL.
                # Client fields may supply display data, never quota values.
                payload["lecturers"] = []
                for lecturer_id in lecturer_ids:
                    lecturer = dict(client_by_id.get(lecturer_id, {}))
                    lecturer.update(id=lecturer_id, **participant_by_id[lecturer_id])
                    lecturer["teach"] = _merge_calendar(
                        [row for row in sql_teach if str(row.get("MaGV", "")).strip() == lecturer_id],
                        has_teach_table,
                        lecturer.get("teach", []),
                    )
                    lecturer["busy"] = _merge_calendar(
                        [row for row in sql_busy if str(row.get("MaGV", "")).strip() == lecturer_id],
                        has_busy_table,
                        lecturer.get("busy", []),
                    )
                    lecturer["duty"] = _merge_calendar(
                        [row for row in sql_duty if str(row.get("MaGV", "")).strip() == lecturer_id],
                        has_duty_table,
                        lecturer.get("duty", []),
                    )
                    payload["lecturers"].append(lecturer)
            payload['use_authoritative_quotas'] = True
        return solve_schedule(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f'Không đọc được định mức chuẩn từ SQL Server để xếp lịch: {exc}')
