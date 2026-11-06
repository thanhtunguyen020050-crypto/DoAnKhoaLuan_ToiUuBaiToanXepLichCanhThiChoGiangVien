"""Shared RB7 campus and travel-gap rules for backend models and CP-SAT."""
from __future__ import annotations

import unicodedata
import re


_MAIN_CAMPUS = "140 Lê Trọng Tấn"
DEFAULT_MIN_TRAVEL_SLOTS = 1


def is_main_campus_room(room: object) -> bool | None:
    """Return True/False for the campus in a room string, or None if unknown."""
    value = str(room or "")
    separator = value.find(" - ")
    if separator < 0:
        return None

    campus = value[separator + 3:]
    campus = re.sub(
        r"[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+",
        " ",
        campus,
    ).strip()
    if not campus:
        return None

    campus_key = "".join(
        char for char in unicodedata.normalize("NFKD", campus).casefold()
        if not unicodedata.combining(char)
    )
    main_key = "".join(
        char for char in unicodedata.normalize("NFKD", _MAIN_CAMPUS).casefold()
        if not unicodedata.combining(char)
    )
    return campus_key == main_key


def rb7_teaching_exam_violation(
    room: object,
    teaching_start: int,
    teaching_end: int,
    exam_start: int,
    exam_end: int,
    min_travel_slots: int = DEFAULT_MIN_TRAVEL_SLOTS,
) -> bool:
    """Check RB7 for a teaching event against an exam at the main campus."""
    if is_main_campus_room(room) is not False:
        return False
    if teaching_start <= exam_end and exam_start <= teaching_end:
        return False  # Overlap belongs to RB4.

    if teaching_end < exam_start:
        gap = exam_start - teaching_end - 1
    elif exam_end < teaching_start:
        gap = teaching_start - exam_end - 1
    else:
        return False
    return gap < min_travel_slots


def normalize_min_travel_slots(value: object = None) -> int:
    """Read an optional configured gap, using the legacy-compatible default."""
    if value in (None, ""):
        return DEFAULT_MIN_TRAVEL_SLOTS
    try:
        result = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("SoTietDiChuyenToiThieu must be an integer from 1 to 4") from exc
    if not 1 <= result <= 4:
        raise ValueError("SoTietDiChuyenToiThieu must be between 1 and 4")
    return result


def read_min_travel_slots(cur, ma_dot: str) -> int:
    """Read K from CauHinhXepLich, falling back only when the column is absent."""
    cur.execute(
        "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS "
        "WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='CauHinhXepLich' "
        "AND COLUMN_NAME='SoTietDiChuyenToiThieu'"
    )
    if not cur.fetchone():
        return DEFAULT_MIN_TRAVEL_SLOTS

    cur.execute(
        "SELECT SoTietDiChuyenToiThieu FROM dbo.CauHinhXepLich WHERE MaDot=?",
        ma_dot,
    )
    row = cur.fetchone()
    return normalize_min_travel_slots(row[0] if row else None)
