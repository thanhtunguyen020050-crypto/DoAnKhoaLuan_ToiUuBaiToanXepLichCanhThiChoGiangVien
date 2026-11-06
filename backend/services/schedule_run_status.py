"""Thread-safe, process-local status for the latest automatic schedule runs."""
from __future__ import annotations

from datetime import datetime, timezone
from threading import RLock
from time import monotonic
from typing import Any
from uuid import uuid4


_LOCK = RLock()
_RUNS: dict[str, dict[str, Any]] = {}


def begin_run(
    ma_dot: str,
    requested_count: int | None = None,
    time_limit_seconds: float = 120,
    feasibility_only: bool = False,
) -> str:
    key = str(ma_dot)
    with _LOCK:
        existing = _RUNS.get(key)
        if existing and existing.get("running"):
            raise RuntimeError("Đợt thi này đang có một lần xếp lịch tự động chạy.")
        run_id = uuid4().hex
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        _RUNS[key] = {
            "run_id": run_id,
            "ma_dot": key,
            "status": "RUNNING",
            "phase": "preparing",
            "phase_label": "Đang chuẩn bị dữ liệu và kiểm tra định mức",
            "solutions_found": 0,
            "best_objective": None,
            "best_bound": None,
            "started_at": now,
            "completed_at": None,
            "elapsed_seconds": 0.0,
            "message": None,
            "requested_count": max(0, int(requested_count)) if requested_count is not None else None,
            "time_limit_seconds": max(1, min(300, int(time_limit_seconds))),
            "feasibility_only": bool(feasibility_only),
            "running": True,
            "_started_monotonic": monotonic(),
        }
        return run_id


def update_run(ma_dot: str, run_id: str, **updates: Any) -> None:
    with _LOCK:
        run = _RUNS.get(str(ma_dot))
        if not run or run.get("run_id") != run_id or not run.get("running"):
            return
        run.update(updates)
        run["elapsed_seconds"] = max(0.0, monotonic() - run["_started_monotonic"])


def finish_run(
    ma_dot: str,
    run_id: str,
    status: str,
    message: str | None = None,
    result: dict[str, Any] | None = None,
) -> None:
    with _LOCK:
        run = _RUNS.get(str(ma_dot))
        if not run or run.get("run_id") != run_id:
            return
        assignments = (result or {}).get("assignments") or []
        missing = max(0, int((result or {}).get("missing", 0) or 0))
        needed = max(len(assignments) + missing, int(run.get("requested_count") or 0))
        run.update(
            status="COMPLETED",
            result_status=str(status),
            phase="completed",
            phase_label="Đã hoàn tất",
            completed_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            elapsed_seconds=max(0.0, monotonic() - run["_started_monotonic"]),
            assigned_count=len(assignments),
            missing_count=max(missing, needed - len(assignments)),
            needed_count=needed,
            objective_value=(result or {}).get("objective_value"),
            message=message,
            _result=result,
            running=False,
        )


def fail_run(ma_dot: str, run_id: str, message: str) -> None:
    with _LOCK:
        run = _RUNS.get(str(ma_dot))
        if not run or run.get("run_id") != run_id:
            return
        run.update(
            status="FAILED",
            result_status="ERROR",
            phase="failed",
            phase_label="Không thể hoàn tất lần xếp lịch",
            completed_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            elapsed_seconds=max(0.0, monotonic() - run["_started_monotonic"]),
            assigned_count=0,
            missing_count=int(run.get("requested_count") or 0),
            needed_count=int(run.get("requested_count") or 0),
            message=str(message),
            _error=str(message),
            running=False,
        )


def get_latest_run_status() -> dict[str, Any] | None:
    with _LOCK:
        if not _RUNS:
            return None
        active = [item for item in _RUNS.values() if item.get("running")]
        run = max(active or list(_RUNS.values()), key=lambda item: item["_started_monotonic"])
        result = {
            key: value for key, value in run.items()
            if not key.startswith("_") and key not in {"run_id", "message"}
        }
        if run.get("running"):
            result["elapsed_seconds"] = max(0.0, monotonic() - run["_started_monotonic"])
        return result


def get_run_result(ma_dot: str, run_id: str) -> dict[str, Any] | None:
    """Return the private result payload for its owning authenticated admin poll."""
    with _LOCK:
        run = _RUNS.get(str(ma_dot))
        if not run or run.get("run_id") != run_id:
            return None
        return {
            "run_id": run_id,
            "ma_dot": str(ma_dot),
            "running": bool(run.get("running")),
            "status": run.get("status"),
            "result_status": run.get("result_status"),
            "result": run.get("_result"),
            "error": run.get("_error"),
        }
