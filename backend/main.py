"""Điểm khởi chạy ứng dụng FastAPI theo MVC."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from .core.config import settings
    from .controllers.admin_auth import router as admin_auth_controller
    from .controllers.admin_calendars import router as admin_calendars_controller
    from .controllers.admin_exams import router as admin_exams_controller
    from .controllers.admin_system import router as admin_system_controller
    from .controllers.busy_requests import router as busy_requests_controller
    from .controllers.scheduling import router as scheduling_controller
    from .controllers.user_portal import router as user_portal_controller
except ImportError:
    from core.config import settings
    from controllers.admin_auth import router as admin_auth_controller
    from controllers.admin_calendars import router as admin_calendars_controller
    from controllers.admin_exams import router as admin_exams_controller
    from controllers.admin_system import router as admin_system_controller
    from controllers.busy_requests import router as busy_requests_controller
    from controllers.scheduling import router as scheduling_controller
    from controllers.user_portal import router as user_portal_controller


def create_app() -> FastAPI:
    """Tạo app, cấu hình middleware và gắn các MVC Controller."""
    application = FastAPI(title=settings.app_title, version=settings.app_version)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for controller in (
        scheduling_controller,
        admin_system_controller,
        admin_exams_controller,
        admin_calendars_controller,
        user_portal_controller,
        busy_requests_controller,
        admin_auth_controller,
    ):
        application.include_router(controller)
    return application


app = create_app()
