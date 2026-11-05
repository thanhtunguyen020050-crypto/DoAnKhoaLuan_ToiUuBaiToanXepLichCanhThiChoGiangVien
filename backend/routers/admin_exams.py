"""Router quản trị - đợt thi và ca thi của API FastAPI."""
import logging

from fastapi import APIRouter, HTTPException
try:
    from ..ketnoi_sql import get_connection
    from ..schemas.admin import DotThiIn, CaThiIn, LuuPhanCongIn, DinhMucChungIn, DinhMucGiangVienIn
    from ..services.admin_helpers import dict_rows, _thu_vn, _drain
except ImportError:
    from ketnoi_sql import get_connection
    from schemas.admin import DotThiIn, CaThiIn, LuuPhanCongIn, DinhMucChungIn, DinhMucGiangVienIn
    from services.admin_helpers import dict_rows, _thu_vn, _drain

router = APIRouter(tags=['Quản trị - đợt thi và ca thi'])
logger = logging.getLogger(__name__)


@router.get('/api/dot-thi')
def list_exam_periods():
    try:
        with get_connection() as cn:
            cur=cn.cursor(); cur.execute('EXEC dbo.sp_DanhSachDotThi')
            return {'items':dict_rows(cur)}
    except Exception as e: raise HTTPException(500,f'Lỗi đọc đợt thi: {e}')

@router.get('/api/dot-thi/moi-nhat')
def latest_exam_period():
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('SELECT TOP 1 MaDot,TenDot,HocKy,NamHoc,LoaiDot,NgayBatDau,NgayKetThuc,GhiChu FROM dbo.DotThi ORDER BY NgayBatDau DESC,MaDot DESC');r=cur.fetchone()
            return dict(zip([c[0] for c in cur.description],r)) if r else {}
    except Exception as e: raise HTTPException(500,str(e))

@router.post('/api/dot-thi')
def create_exam_period(x:DotThiIn):
    ma_dot=f'{x.hoc_ky}_{x.nam_hoc.replace("-","")}'
    ten=f'Đợt thi {x.hoc_ky} năm học {x.nam_hoc}'
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('EXEC dbo.sp_ThemDotThi ?,?,?,?,?,?,?',ma_dot,ten,x.hoc_ky,x.nam_hoc,x.ngay_bat_dau,x.ngay_ket_thuc,x.ghi_chu)
            cn.commit();return {'ok':True,'ma_dot':ma_dot}
    except Exception as e: raise HTTPException(400,str(e))

@router.put('/api/dot-thi/{ma_dot}')
def update_exam_period(ma_dot:str,x:DotThiIn):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('EXEC dbo.sp_SuaDotThi ?,?,?,?,?,?,?',ma_dot,f'Đợt thi {x.hoc_ky} năm học {x.nam_hoc}',x.hoc_ky,x.nam_hoc,x.ngay_bat_dau,x.ngay_ket_thuc,x.ghi_chu);cn.commit();return {'ok':True,'ma_dot':ma_dot}
    except Exception as e: raise HTTPException(400,str(e))

@router.delete('/api/dot-thi/{ma_dot}')
def delete_exam_period(ma_dot:str):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('EXEC dbo.sp_XoaDotThi ?',ma_dot);cn.commit();return {'ok':True}
    except Exception as e: raise HTTPException(400,str(e))

@router.get('/api/ca-thi')
def list_exam_shifts(ma_dot:str|None=None):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('EXEC dbo.sp_DanhSachCaThi ?',ma_dot)
            return {'items':dict_rows(cur)}
    except Exception as e: raise HTTPException(500,f'Lỗi đọc ca thi: {e}')

@router.post('/api/dot-thi/{ma_dot}/phan-cong')
def save_exam_assignments(ma_dot:str,x:LuuPhanCongIn):
    """Save assignments against authoritative SQL quotas; browser quotas are never persisted here."""
    pairs=[(a.ma_ca.strip(),a.ma_gv.strip()) for a in x.assignments]
    if len(pairs)!=len(set(pairs)):
        raise HTTPException(400,'Danh sách có phân công bị lặp.')
    try:
        with get_connection() as cn:
            try:
                cur=cn.cursor()

                # Keep the SQL quotas used by the solver authoritative. Re-running
                # sp_TinhDinhMucTheoTyLe here could change them between solve and save.
                # Lock both source sets until this transaction commits.
                cur.execute('''
                    SELECT
                        COALESCE((SELECT SUM(CONVERT(BIGINT,SoCaQuyDinh))
                                  FROM dbo.DinhMucPhanCong WITH (UPDLOCK,HOLDLOCK)
                                  WHERE MaDot=?),0),
                        COALESCE((SELECT SUM(CONVERT(BIGINT,SoGVCanCap))
                                  FROM dbo.CaThi WITH (UPDLOCK,HOLDLOCK)
                                  WHERE MaDot=?),0)
                ''',ma_dot,ma_dot)
                totals=cur.fetchone()
                quota_total=int(totals[0] or 0)
                required_total=int(totals[1] or 0)
                if quota_total != required_total:
                    raise HTTPException(
                        409,
                        f'[RB1] Tổng định mức trong SQL là {quota_total} lượt, '
                        f'nhưng tổng nhu cầu của đợt là {required_total} lượt. '
                        'Lịch cũ được giữ nguyên; hãy đồng bộ định mức và chạy xếp lịch lại.'
                    )

                # Stage small scalar parameters instead of sending a large JSON LOB.
                # This avoids ODBC Driver 17 precision/NTEXT problems on UTF-8 SQL databases.
                cur.execute('CREATE TABLE #LuuPhanCong (MaCa VARCHAR(50) COLLATE DATABASE_DEFAULT NOT NULL, MaGV VARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL, PRIMARY KEY(MaCa,MaGV))')
                if pairs:
                    cur.executemany('INSERT INTO #LuuPhanCong(MaCa,MaGV) VALUES (?,?)',pairs)

                cur.execute('SELECT TOP 1 r.MaCa FROM #LuuPhanCong r LEFT JOIN dbo.CaThi c ON c.MaCa=r.MaCa AND c.MaDot=? WHERE c.MaCa IS NULL',ma_dot)
                if cur.fetchone():
                    raise HTTPException(400,'Danh sách có ca thi không thuộc đợt thi đã chọn.')
                cur.execute("SELECT TOP 1 r.MaGV FROM #LuuPhanCong r LEFT JOIN dbo.GiangVien g ON g.MaGV=r.MaGV AND g.TrangThai=N'Đang công tác' WHERE g.MaGV IS NULL")
                if cur.fetchone():
                    raise HTTPException(400,'Danh sách có giảng viên không tồn tại hoặc không còn công tác.')

                cur.execute('DELETE p FROM dbo.PhanCongCoiThi p INNER JOIN dbo.CaThi c ON c.MaCa=p.MaCa WHERE c.MaDot=?',ma_dot)
                cur.execute('INSERT INTO dbo.PhanCongCoiThi(MaCa,MaGV) SELECT MaCa,MaGV FROM #LuuPhanCong')

                # This procedure validates the hard constraints, including exact
                # quotas and required seats. Busy levels 2-3 are soft; do not let a
                # stale installed sp_ChotXepLich threshold (53005) block publishing.
                cur.execute('EXEC dbo.sp_KiemTraRangBuoc ?,1',ma_dot)
                _drain(cur)
                cn.commit()
                return {'ok':True,'ma_dot':ma_dot,'assignments_saved':len(pairs)}
            except Exception:
                try:
                    cn.rollback()
                except Exception:
                    logger.exception('Rollback failed while saving assignments for MaDot=%s',ma_dot)
                raise
    except HTTPException:
        raise
    except Exception as e:
        logger.exception('Failed saving assignments for MaDot=%s',ma_dot)
        raise HTTPException(400,f'Không lưu được phân công vào SQL Server: {e}')

@router.put('/api/dinh-muc/{ma_dot}/{ma_gv}')
def update_lecturer_quota(ma_dot:str,ma_gv:str,x:DinhMucGiangVienIn):
    """Save both quota representations; exact ca entries are protected in SQL."""
    try:
        with get_connection() as cn:
            cur=cn.cursor()
            cur.execute("SELECT 1 FROM dbo.GiangVien WHERE MaGV=? AND TrangThai=N'Đang công tác'",ma_gv)
            if not cur.fetchone():
                raise HTTPException(400,'Giảng viên không tồn tại hoặc không còn công tác.')
            cur.execute('SELECT 1 FROM dbo.DinhMucPhanCong WHERE MaDot=? AND MaGV=?',ma_dot,ma_gv)
            if not cur.fetchone():
                raise HTTPException(404,'Giảng viên chưa được chọn tham gia đợt thi.')
            cur.execute('''
                UPDATE dbo.DinhMucPhanCong
                SET TyLeDinhMuc=?,
                    SoCaQuyDinh=CASE WHEN ?=1 THEN ? ELSE SoCaQuyDinh END,
                    SoCaThuCong=?,
                    GhiChu=CASE WHEN ?=1 THEN N'Định mức số ca nhập tay' ELSE N'Định mức theo tỷ lệ' END
                WHERE MaDot=? AND MaGV=?
            ''',x.ty_le,int(x.so_ca_thu_cong),x.so_ca,int(x.so_ca_thu_cong),int(x.so_ca_thu_cong),ma_dot,ma_gv)
            cur.execute('EXEC dbo.sp_TinhDinhMucTheoTyLe ?',ma_dot)
            _drain(cur)
            cur.execute('''
                SELECT MaGV,TyLeDinhMuc,SoCaQuyDinh,SoCaThuCong
                FROM dbo.DinhMucPhanCong
                WHERE MaDot=?
                ORDER BY MaGV
            ''',ma_dot)
            items=dict_rows(cur)
            cur.execute('SELECT ISNULL(SUM(SoGVCanCap),0) FROM dbo.CaThi WHERE MaDot=?',ma_dot)
            total=int(cur.fetchone()[0] or 0)
            cn.commit()
            return {'ok':True,'ma_dot':ma_dot,'items':items,'tong_nhu_cau':total,
                    'tong_dinh_muc':sum(int(item['SoCaQuyDinh'] or 0) for item in items)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400,f'Không lưu được định mức: {e}')

@router.post('/api/ca-thi')
def create_exam_shift(x:CaThiIn):
    import datetime
    try:
        d=datetime.date.fromisoformat(x.ngay_thi)
    except Exception: raise HTTPException(400,'Ngày thi không hợp lệ.')
    ma_dot=x.ma_dot or f'{x.hoc_ky}_{x.nam_hoc.replace("-","")}'
    try:
        with get_connection() as cn:
            cur=cn.cursor()
            cur.execute('SELECT MaDot,NgayBatDau,NgayKetThuc FROM dbo.DotThi WHERE MaDot=?',(ma_dot,)); dot=cur.fetchone()
            # A period may already exist under a manually assigned MaDot. Reuse
            # that period instead of trying to create a duplicate HK/year row.
            if not dot:
                cur.execute('SELECT MaDot,NgayBatDau,NgayKetThuc FROM dbo.DotThi WHERE HocKy=? AND NamHoc=?',(x.hoc_ky,x.nam_hoc)); dot=cur.fetchone()
                if dot:
                    ma_dot=dot[0]
            if not dot:
                cur.execute('EXEC dbo.sp_ThemDotThi ?,?,?,?,?,?,?',ma_dot,f'Đợt thi {x.hoc_ky} năm học {x.nam_hoc}',x.hoc_ky,x.nam_hoc,x.ngay_thi,x.ngay_thi,'Tạo tự động từ form tiếp nhận lịch thi'); _drain(cur)
            else:
                bd,kt=dot[1],dot[2]; nb=min(bd,d); nk=max(kt,d)
                if nb!=bd or nk!=kt:
                    cur.execute('SELECT HocKy,NamHoc FROM dbo.DotThi WHERE MaDot=?',ma_dot); rr=cur.fetchone()
                    cur.execute('EXEC dbo.sp_SuaDotThi ?,?,?,?,?,?,?',ma_dot,f'Đợt thi {x.hoc_ky} năm học {x.nam_hoc}',x.hoc_ky,x.nam_hoc,nb.isoformat(),nk.isoformat(),'Cập nhật tự động từ form tiếp nhận lịch thi'); _drain(cur)
            # deterministic unique key, independent of UI/localStorage
            code=f"{ma_dot}_{d.strftime('%Y%m%d')}_{x.tu_tiet:02d}_{x.den_tiet:02d}"
            cur.execute('EXEC dbo.sp_ThemCaThi ?,?,?,?,?,?,?,?,?,?',code,ma_dot,x.ngay_thi,_thu_vn(x.ngay_thi),x.tu_tiet,x.den_tiet,x.hinh_thuc_thi,x.so_gv_can_cap,None,None); _drain(cur)
            cn.commit(); return {'ok':True,'ma_ca':code,'ma_dot':ma_dot}
    except Exception as e: raise HTTPException(400,str(e))

@router.put('/api/ca-thi/{ma_ca}')
def update_exam_shift(ma_ca:str,x:CaThiIn):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('EXEC dbo.sp_SuaCaThi ?,?,?,?,?,?,?,?,?',ma_ca,x.ngay_thi,_thu_vn(x.ngay_thi),x.tu_tiet,x.den_tiet,x.hinh_thuc_thi,x.so_gv_can_cap,None,None);_drain(cur);cn.commit();return {'ok':True}
    except Exception as e: raise HTTPException(400,str(e))

@router.delete('/api/ca-thi/all')
def clear_all_exams():
    """Xóa ca thi và dữ liệu yêu cầu đổi ca phụ thuộc trong một transaction."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('EXEC dbo.sp_XoaTatCaCaThi')
            row = cur.fetchone()
            deleted = int(row[0]) if row and row[0] is not None else 0
            _drain(cur)
            cn.commit()
            return {'ok': True, 'deleted': deleted}
    except Exception as e:
        raise HTTPException(400, f'Lỗi xóa ca thi: {e}')

@router.delete('/api/ca-thi/{ma_ca}')
def delete_exam_shift(ma_ca:str):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('EXEC dbo.sp_XoaCaThi ?',ma_ca);_drain(cur);cn.commit();return {'ok':True}
    except Exception as e: raise HTTPException(400,str(e))

@router.post('/api/dinh-muc/dat-chung')
def set_common_quota(x:DinhMucChungIn):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('EXEC dbo.sp_DatDinhMucChung ?,?,?',x.ma_dot,x.ty_le,x.ma_khoa)
            # bỏ qua các result set trung gian do sp_TinhDinhMucTheoTyLe trả về
            result={}
            while True:
                if cur.description:
                    cols=[c[0] for c in cur.description];rows=cur.fetchall()
                    if rows and 'TongNhuCau' in cols:result=dict(zip(cols,rows[-1]))
                if not cur.nextset():break
            cn.commit();return result or {'MaDot':x.ma_dot}
    except Exception as e:raise HTTPException(400,str(e))
