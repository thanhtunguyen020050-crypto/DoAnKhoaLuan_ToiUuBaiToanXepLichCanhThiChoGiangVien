"""Chạy API bằng cấu hình host/port trong file .env."""
import uvicorn
import sys
from pathlib import Path

# Keep `python run.py` working in environments that launch Python with safe-path mode.
sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    from .core.config import settings
except ImportError:
    from core.config import settings


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        # Chạy một tiến trình trực tiếp để tránh reloader tạo tiến trình con
        # gây lỗi/thoát ngầm trên một số cấu hình Python và Windows.
        reload=False,
    )
