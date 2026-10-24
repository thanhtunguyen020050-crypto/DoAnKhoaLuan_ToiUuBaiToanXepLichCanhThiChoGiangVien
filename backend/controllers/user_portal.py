"""FastAPI Controller: HTTP endpoint, validation and delegation to Model."""

from fastapi import APIRouter

try:
    from ..schemas.user_portal import LoginIn, ChangePasswordIn, SwapCreateIn, SwapRespondIn, AdminPasswordResetIn
except ImportError:
    from schemas.user_portal import LoginIn, ChangePasswordIn, SwapCreateIn, SwapRespondIn, AdminPasswordResetIn

try:
    from ..models.user_portal import login as _model_login, change_password as _model_change_password, my_schedule as _model_my_schedule, available_lecturers as _model_available_lecturers, create_swap as _model_create_swap, respond_swap as _model_respond_swap, list_swaps as _model_list_swaps, notifications as _model_notifications, mark_notification_read as _model_mark_notification_read, admin_notifications as _model_admin_notifications, admin_accounts as _model_admin_accounts, reset_user_password as _model_reset_user_password
except ImportError:
    from models.user_portal import login as _model_login, change_password as _model_change_password, my_schedule as _model_my_schedule, available_lecturers as _model_available_lecturers, create_swap as _model_create_swap, respond_swap as _model_respond_swap, list_swaps as _model_list_swaps, notifications as _model_notifications, mark_notification_read as _model_mark_notification_read, admin_notifications as _model_admin_notifications, admin_accounts as _model_admin_accounts, reset_user_password as _model_reset_user_password

router = APIRouter(prefix="/api/user", tags=["User UI"])

@router.post('/login')
def login(x: LoginIn):
    return _model_login(x=x)

@router.post('/change-password')
def change_password(x: ChangePasswordIn):
    return _model_change_password(x=x)

@router.get('/schedule/{ma_gv}')
def my_schedule(ma_gv: str):
    return _model_my_schedule(ma_gv=ma_gv)

@router.get('/lecturers/{ma_gv}')
def available_lecturers(ma_gv: str):
    return _model_available_lecturers(ma_gv=ma_gv)

@router.post('/swaps')
def create_swap(x: SwapCreateIn):
    return _model_create_swap(x=x)

@router.post('/swaps/{request_id}/respond')
def respond_swap(request_id: int, x: SwapRespondIn):
    return _model_respond_swap(request_id=request_id, x=x)

@router.get('/swaps/{ma_gv}')
def list_swaps(ma_gv: str):
    return _model_list_swaps(ma_gv=ma_gv)

@router.get('/notifications/{ma_gv}')
def notifications(ma_gv: str):
    return _model_notifications(ma_gv=ma_gv)

@router.post('/notifications/{ma_gv}/{notification_id}/read')
def mark_notification_read(ma_gv: str, notification_id: int):
    return _model_mark_notification_read(ma_gv=ma_gv, notification_id=notification_id)

@router.get('/admin/notifications')
def admin_notifications():
    return _model_admin_notifications()

@router.get('/admin/accounts')
def admin_accounts():
    return _model_admin_accounts()

@router.post('/admin/accounts/{ma_gv}/reset-password')
def reset_user_password(ma_gv: str, x: AdminPasswordResetIn):
    return _model_reset_user_password(ma_gv=ma_gv, x=x)
