import os
import pyodbc
from dotenv import load_dotenv

load_dotenv()

SQL_SERVER = os.getenv('SQL_SERVER', r'LAPTOP-I45QUNGD')
SQL_DATABASE = os.getenv('SQL_DATABASE', 'DB_XepLichCoiThi_Final')
SQL_DRIVER = os.getenv('SQL_DRIVER', 'ODBC Driver 17 for SQL Server')
SQL_TRUSTED = os.getenv('SQL_TRUSTED_CONNECTION', 'yes').lower() in ('1','true','yes','y')


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
        parts.append(f'UID={os.getenv("SQL_USER", "")}')
        parts.append(f'PWD={os.getenv("SQL_PASSWORD", "")}')
    return pyodbc.connect(';'.join(parts), timeout=5)
