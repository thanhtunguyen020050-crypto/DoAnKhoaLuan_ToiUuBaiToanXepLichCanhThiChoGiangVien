import pyodbc

try:
    from .core.config import settings
except ImportError:
    from core.config import settings

# Giữ các tên cũ để các script quản trị hiện tại vẫn dùng được.
SQL_SERVER = settings.sql_server
SQL_DATABASE = settings.sql_database
SQL_DRIVER = settings.sql_driver
SQL_TRUSTED = settings.sql_trusted_connection


def get_connection():
    parts = [
        f'DRIVER={{{SQL_DRIVER}}}',
        f'SERVER={SQL_SERVER}',
        f'DATABASE={SQL_DATABASE}',
    ]
    if SQL_TRUSTED:
        parts.append('Trusted_Connection=yes')
        parts.append('TrustServerCertificate=yes')
    else:
        parts.append(f'UID={settings.sql_user}')
        parts.append(f'PWD={settings.sql_password}')
    return pyodbc.connect(';'.join(parts), timeout=5)
