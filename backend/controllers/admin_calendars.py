"""FastAPI Controller: HTTP endpoint, validation and delegation to Model."""

from fastapi import APIRouter

try:
    from ..schemas.admin import LichDayImportRow, LichBanImportRow
except ImportError:
    from schemas.admin import LichDayImportRow, LichBanImportRow

try:
    from ..models.admin_calendars import teaching_schedule as _model_teaching_schedule, replace_teaching as _model_replace_teaching, import_teaching as _model_import_teaching, busy_schedule as _model_busy_schedule, clear_all_teaching as _model_clear_all_teaching, clear_all_busy as _model_clear_all_busy, replace_busy as _model_replace_busy, import_busy as _model_import_busy
except ImportError:
    from models.admin_calendars import teaching_schedule as _model_teaching_schedule, replace_teaching as _model_replace_teaching, import_teaching as _model_import_teaching, busy_schedule as _model_busy_schedule, clear_all_teaching as _model_clear_all_teaching, clear_all_busy as _model_clear_all_busy, replace_busy as _model_replace_busy, import_busy as _model_import_busy

router = APIRouter(tags=['Quản trị - lịch dạy và lịch bận'])

@router.get('/api/lich-day/{ma_gv}')
def teaching_schedule(ma_gv: str):
    return _model_teaching_schedule(ma_gv=ma_gv)

@router.put('/api/lich-day/{ma_gv}')
def replace_teaching(ma_gv: str, items: list[dict]):
    return _model_replace_teaching(ma_gv=ma_gv, items=items)

@router.post('/api/lich-day/import')
def import_teaching(rows: list[LichDayImportRow], filename: str | None=None):
    return _model_import_teaching(rows=rows, filename=filename)

@router.get('/api/lich-ban/{ma_gv}')
def busy_schedule(ma_gv: str):
    return _model_busy_schedule(ma_gv=ma_gv)

@router.delete('/api/lich-day/all')
def clear_all_teaching():
    return _model_clear_all_teaching()

@router.delete('/api/lich-ban/all')
def clear_all_busy():
    return _model_clear_all_busy()

@router.put('/api/lich-ban/{ma_gv}')
def replace_busy(ma_gv: str, items: list[dict]):
    return _model_replace_busy(ma_gv=ma_gv, items=items)

@router.post('/api/lich-ban/import')
def import_busy(rows: list[LichBanImportRow], filename: str | None=None):
    return _model_import_busy(rows=rows, filename=filename)
