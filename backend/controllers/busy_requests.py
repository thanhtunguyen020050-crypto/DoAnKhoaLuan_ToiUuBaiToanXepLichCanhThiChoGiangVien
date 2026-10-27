"""FastAPI Controller: HTTP endpoint, validation and delegation to Model."""

from fastapi import APIRouter, Depends, Query

try:
    from ..schemas.busy_requests import BusyRequestCreateIn, BusyRequestNominateIn, BusyRequestCoverResponseIn, BusyRequestApproveIn, BusyRequestRejectIn
except ImportError:
    from schemas.busy_requests import BusyRequestCreateIn, BusyRequestNominateIn, BusyRequestCoverResponseIn, BusyRequestApproveIn, BusyRequestRejectIn

try:
    from ..auth_utils import require_lecturer, require_admin
except ImportError:
    from auth_utils import require_lecturer, require_admin

try:
    from ..models.busy_requests import get_my_busy_requests as _model_get_my_busy_requests, create_busy_request as _model_create_busy_request, get_busy_request_detail as _model_get_busy_request_detail, user_get_replacement_candidates as _model_user_get_replacement_candidates, user_get_replacement_candidates_for_shift as _model_user_get_replacement_candidates_for_shift, user_request_cover as _model_user_request_cover, user_respond_cover as _model_user_respond_cover, admin_list_busy_requests as _model_admin_list_busy_requests, admin_get_busy_request as _model_admin_get_busy_request, admin_get_replacement_candidates as _model_admin_get_replacement_candidates, admin_approve_busy_request as _model_admin_approve_busy_request, admin_reject_busy_request as _model_admin_reject_busy_request
except ImportError:
    from models.busy_requests import get_my_busy_requests as _model_get_my_busy_requests, create_busy_request as _model_create_busy_request, get_busy_request_detail as _model_get_busy_request_detail, user_get_replacement_candidates as _model_user_get_replacement_candidates, user_get_replacement_candidates_for_shift as _model_user_get_replacement_candidates_for_shift, user_request_cover as _model_user_request_cover, user_respond_cover as _model_user_respond_cover, admin_list_busy_requests as _model_admin_list_busy_requests, admin_get_busy_request as _model_admin_get_busy_request, admin_get_replacement_candidates as _model_admin_get_replacement_candidates, admin_approve_busy_request as _model_admin_approve_busy_request, admin_reject_busy_request as _model_admin_reject_busy_request

try:
    from ..models.busy_requests import withdraw_busy_request as _model_withdraw_busy_request, remind_nominee as _model_remind_nominee
except ImportError:
    from models.busy_requests import withdraw_busy_request as _model_withdraw_busy_request, remind_nominee as _model_remind_nominee

router = APIRouter(tags=["Busy Requests"])

@router.get('/api/user/busy-requests')
def get_my_busy_requests(ma_gv: str=Depends(require_lecturer)):
    return _model_get_my_busy_requests(ma_gv=ma_gv)

@router.post('/api/user/busy-requests/{request_id}/withdraw')
def user_withdraw_busy_request(request_id: int, ma_gv: str=Depends(require_lecturer)):
    return _model_withdraw_busy_request(request_id=request_id, ma_gv=ma_gv)

@router.post('/api/user/busy-requests/{request_id}/remind-cover')
def user_remind_cover_nominee(request_id: int, ma_gv: str=Depends(require_lecturer)):
    return _model_remind_nominee(request_id=request_id, ma_gv=ma_gv)

@router.post('/api/user/busy-requests')
def create_busy_request(req_data: BusyRequestCreateIn, ma_gv: str=Depends(require_lecturer)):
    return _model_create_busy_request(req_data=req_data, ma_gv=ma_gv)

@router.get('/api/user/busy-cover-candidates')
def user_get_replacement_candidates_for_shift(ma_ca: str=Query(min_length=1, max_length=50), ma_gv: str=Depends(require_lecturer)):
    return _model_user_get_replacement_candidates_for_shift(ma_ca=ma_ca, ma_gv=ma_gv)

@router.get('/api/user/busy-requests/{request_id}')
def get_busy_request_detail(request_id: int, ma_gv: str=Depends(require_lecturer)):
    return _model_get_busy_request_detail(request_id=request_id, ma_gv=ma_gv)

@router.get('/api/user/busy-requests/{request_id}/candidates')
def user_get_replacement_candidates(request_id: int, ma_gv: str=Depends(require_lecturer)):
    return _model_user_get_replacement_candidates(request_id=request_id, ma_gv=ma_gv)

@router.post('/api/user/busy-requests/{request_id}/request-cover')
def user_request_cover(request_id: int, payload: BusyRequestNominateIn, ma_gv: str=Depends(require_lecturer)):
    return _model_user_request_cover(request_id=request_id, payload=payload, ma_gv=ma_gv)

@router.post('/api/user/busy-requests/{request_id}/respond-cover')
def user_respond_cover(request_id: int, payload: BusyRequestCoverResponseIn, ma_gv: str=Depends(require_lecturer)):
    return _model_user_respond_cover(request_id=request_id, payload=payload, ma_gv=ma_gv)

@router.get('/api/admin/busy-requests')
def admin_list_busy_requests(trang_thai: str | None=Query(default=None), q: str | None=Query(default=None), admin_user: str=Depends(require_admin)):
    return _model_admin_list_busy_requests(trang_thai=trang_thai, q=q, admin_user=admin_user)

@router.get('/api/admin/busy-requests/{request_id}')
def admin_get_busy_request(request_id: int, admin_user: str=Depends(require_admin)):
    return _model_admin_get_busy_request(request_id=request_id, admin_user=admin_user)

@router.get('/api/admin/busy-requests/{request_id}/candidates')
def admin_get_replacement_candidates(request_id: int, admin_user: str=Depends(require_admin)):
    return _model_admin_get_replacement_candidates(request_id=request_id, admin_user=admin_user)

@router.post('/api/admin/busy-requests/{request_id}/approve')
def admin_approve_busy_request(request_id: int, payload: BusyRequestApproveIn, admin_user: str=Depends(require_admin)):
    return _model_admin_approve_busy_request(request_id=request_id, payload=payload, admin_user=admin_user)

@router.post('/api/admin/busy-requests/{request_id}/reject')
def admin_reject_busy_request(request_id: int, payload: BusyRequestRejectIn, admin_user: str=Depends(require_admin)):
    return _model_admin_reject_busy_request(request_id=request_id, payload=payload, admin_user=admin_user)
