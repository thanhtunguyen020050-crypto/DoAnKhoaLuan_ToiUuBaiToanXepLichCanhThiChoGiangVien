"""HTTP endpoints dành riêng cho chức năng xếp lịch."""

from fastapi import APIRouter, HTTPException

try:
    from ..schemas.scheduling import ScheduleRequest
    from ..services.cpsat_solver import solve_schedule
    from ..ketnoi_sql import get_connection
except ImportError:
    from schemas.scheduling import ScheduleRequest
    from services.cpsat_solver import solve_schedule
    from ketnoi_sql import get_connection

def run_cpsat(request: ScheduleRequest):
    """Read SQL-authoritative quotas, then solve against those exact RB1 limits."""
    try:
        payload = request.model_dump()
        dot_ids = {str(exam.get('ma_dot')) for exam in payload['exams'] if exam.get('ma_dot')}
        if len(dot_ids) > 1:
            raise HTTPException(status_code=400, detail='Các ca thi gửi lên thuộc nhiều đợt thi khác nhau.')
        if dot_ids:
            ma_dot = next(iter(dot_ids))
            with get_connection() as cn:
                cur = cn.cursor()
                weights = [(str(lecturer.get('id', '')).strip(), float(lecturer.get('pct', 0) or 0)) for lecturer in payload['lecturers']]
                if weights:
                    cur.execute('CREATE TABLE #LichXepDinhMuc (MaGV VARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY, TyLeDinhMuc DECIMAL(5,2) NOT NULL)')
                    cur.executemany('INSERT INTO #LichXepDinhMuc(MaGV,TyLeDinhMuc) VALUES (?,?)', weights)
                    cur.execute("SELECT TOP 1 r.MaGV FROM #LichXepDinhMuc r LEFT JOIN dbo.GiangVien g ON g.MaGV=r.MaGV AND g.TrangThai=N'Đang công tác' WHERE g.MaGV IS NULL")
                    if cur.fetchone():
                        raise HTTPException(status_code=400, detail='Danh sách giảng viên gửi lên có người không tồn tại hoặc không còn công tác.')
                    cur.execute('\n                        UPDATE d SET TyLeDinhMuc=r.TyLeDinhMuc\n                        FROM dbo.DinhMucPhanCong d\n                        JOIN #LichXepDinhMuc r ON r.MaGV=d.MaGV\n                        WHERE d.MaDot=?\n                        ', ma_dot)
                    cur.execute("\n                        INSERT INTO dbo.DinhMucPhanCong(MaDot,MaGV,TyLeDinhMuc,GhiChu)\n                        SELECT ?,r.MaGV,r.TyLeDinhMuc,N'Đồng bộ khi xếp lịch'\n                        FROM #LichXepDinhMuc r\n                        WHERE NOT EXISTS (\n                            SELECT 1 FROM dbo.DinhMucPhanCong d\n                            WHERE d.MaDot=? AND d.MaGV=r.MaGV\n                        )\n                        ", ma_dot, ma_dot)
                cur.execute('EXEC dbo.sp_TinhDinhMucTheoTyLe ?', ma_dot)
                while cur.nextset():
                    pass
                cur.execute('SELECT MaGV, SoCaQuyDinh FROM dbo.DinhMucPhanCong WHERE MaDot=?', ma_dot)
                quotas = {str(ma_gv): int(so_ca or 0) for ma_gv, so_ca in cur.fetchall()}
                cn.commit()
            for lecturer in payload['lecturers']:
                lecturer['quota'] = quotas.get(str(lecturer.get('id')), 0)
            payload['use_authoritative_quotas'] = True
        return solve_schedule(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f'Không đọc được định mức chuẩn từ SQL Server để xếp lịch: {exc}')
