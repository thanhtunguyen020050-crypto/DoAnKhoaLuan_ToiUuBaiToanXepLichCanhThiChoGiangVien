"""HTTP endpoints dành riêng cho chức năng xếp lịch."""
from fastapi import APIRouter, HTTPException
try:
    from ..schemas.scheduling import ScheduleRequest
    from ..services.cpsat_solver import solve_schedule
except ImportError:
    from schemas.scheduling import ScheduleRequest
    from services.cpsat_solver import solve_schedule

router = APIRouter(prefix="/api/xep-lich", tags=["Xếp lịch CP-SAT"])


@router.post("/cpsat")
def run_cpsat(request: ScheduleRequest):
    """Nhận trạng thái lịch từ frontend và trả về các phân công tối ưu."""
    try:
        return solve_schedule(request.model_dump())
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Không thể giải bài toán xếp lịch: {exc}")
