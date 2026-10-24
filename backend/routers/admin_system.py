"""Router quản trị - hệ thống và giảng viên của API FastAPI."""
from fastapi import APIRouter, HTTPException
try:
    from ..ketnoi_sql import get_connection
    from ..schemas.admin import GiangVienIn
    from ..services.admin_helpers import dict_rows, bomon_for_khoa
except ImportError:
    from ketnoi_sql import get_connection
    from schemas.admin import GiangVienIn
    from services.admin_helpers import dict_rows, bomon_for_khoa

router = APIRouter(tags=['Quản trị - hệ thống và giảng viên'])


@router.get('/api/kiem-tra-ket-noi')
def health():
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('SELECT DB_NAME(),@@SERVERNAME');r=cur.fetchone()
            return {'ok':True,'database':r[0],'server':r[1]}
    except Exception as e:raise HTTPException(503,f'Không kết nối được SQL Server: {e}')

@router.get('/api/bo-mon')
def list_departments(ma_khoa:str='CNTT'):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute("SELECT MaBoMon,TenBoMon,MaKhoa FROM dbo.BoMon WHERE MaKhoa=? AND TrangThai=N'Đang hoạt động' ORDER BY TenBoMon",ma_khoa);return {'items':dict_rows(cur)}
    except Exception as e: raise HTTPException(500,f'Lỗi đọc bộ môn: {e}')

@router.get('/api/khoa/resolve')
def resolve_khoa(ten:str):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('SELECT TOP 1 MaKhoa FROM dbo.Khoa WHERE MaKhoa=? OR TenKhoa=?',ten,ten);r=cur.fetchone()
            if not r:raise HTTPException(404,'Không tìm thấy khoa.')
            return {'MaKhoa':r[0]}
    except HTTPException:raise
    except Exception as e:raise HTTPException(500,str(e))

@router.get('/api/giang-vien')
def list_lecturers(ma_dot:str|None=None):
    try:
        with get_connection() as cn:
            cur=cn.cursor();cur.execute('''
SELECT gv.MaGV,gv.HoTen,gv.HocVi,gv.ChucVu,gv.Email,gv.SoDienThoai,gv.TrangThai,
       bm.MaBoMon,bm.TenBoMon,k.MaKhoa,k.TenKhoa,
       dm.TyLeDinhMuc,dm.SoCaQuyDinh,dm.MaDot
FROM dbo.GiangVien gv
JOIN dbo.BoMon bm ON bm.MaBoMon=gv.MaBoMon
JOIN dbo.Khoa k ON k.MaKhoa=bm.MaKhoa
OUTER APPLY (SELECT TOP 1 d.MaDot,d.TyLeDinhMuc,d.SoCaQuyDinh FROM dbo.DinhMucPhanCong d WHERE d.MaGV=gv.MaGV AND (? IS NULL OR d.MaDot=?) ORDER BY d.MaDot DESC) dm
WHERE gv.TrangThai=N'Đang công tác'
ORDER BY k.TenKhoa,bm.TenBoMon,gv.HoTen''',ma_dot,ma_dot)
            return {'items':dict_rows(cur)}
    except Exception as e:raise HTTPException(500,f'Lỗi đọc GiangVien: {e}')

@router.post('/api/giang-vien')
def create_lecturer(x:GiangVienIn):
    ma=x.ma_gv or ('GV'+__import__('time').strftime('%y%m%d%H%M%S%f')[:16])
    try:
        with get_connection() as cn:
            cur=cn.cursor();bm=bomon_for_khoa(cur,x.don_vi,x.ma_bo_mon)
            if not bm:raise HTTPException(400,'Không xác định được Bộ môn từ Khoa.')
            cur.execute('EXEC dbo.sp_ThemGiangVien ?,?,?,?,?,?,?',ma,x.ho_ten,None,None,x.email,x.so_dien_thoai,bm)
            if x.ma_dot:cur.execute('EXEC dbo.sp_ThemDinhMuc ?,?,?,NULL',x.ma_dot,ma,x.ty_le)
            cn.commit();return {'ok':True,'ma_gv':ma}
    except HTTPException:raise
    except Exception as e:raise HTTPException(400,str(e))

@router.put('/api/giang-vien/{ma_gv}')
def update_lecturer(ma_gv:str,x:GiangVienIn):
    try:
        with get_connection() as cn:
            cur=cn.cursor();bm=bomon_for_khoa(cur,x.don_vi,x.ma_bo_mon)
            if not bm:raise HTTPException(400,'Không xác định được Bộ môn từ Khoa.')
            cur.execute("EXEC dbo.sp_SuaGiangVien ?,?,?,?,?,?,?,N'Đang công tác'",ma_gv,x.ho_ten,None,None,x.email,x.so_dien_thoai,bm)
            if x.ma_dot:
                cur.execute('SELECT 1 FROM dbo.DinhMucPhanCong WHERE MaDot=? AND MaGV=?',x.ma_dot,ma_gv)
                if cur.fetchone():cur.execute('EXEC dbo.sp_CapNhatTyLeDinhMuc ?,?,?',x.ma_dot,ma_gv,x.ty_le)
                else:cur.execute('EXEC dbo.sp_ThemDinhMuc ?,?,?,NULL',x.ma_dot,ma_gv,x.ty_le)
            cn.commit();return {'ok':True}
    except HTTPException:raise
    except Exception as e:raise HTTPException(400,str(e))

@router.delete('/api/giang-vien/{ma_gv}')
def delete_lecturer(ma_gv:str):
    try:
        with get_connection() as cn:cur=cn.cursor();cur.execute('EXEC dbo.sp_XoaGiangVien ?',ma_gv);cn.commit();return {'ok':True}
    except Exception as e:raise HTTPException(400,str(e))
