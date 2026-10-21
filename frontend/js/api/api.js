'use strict';
window.API = (() => {
  const base = window.API_BASE_URL || 'http://127.0.0.1:8000/api';
  async function req(path, opts={}) {
    const r = await fetch(base + path, {headers:{'Content-Type':'application/json'}, ...opts});
    const data = await r.json().catch(()=>({}));
    if (!r.ok){
      const d=data.detail;
      const msg=typeof d==='string'?d:(d?.message||((d?.errors||[]).map(x=>`Dòng ${x.line}: ${x.name||''} ${x.msg||''}`).join('\n'))||('API lỗi '+r.status));
      const err=new Error(msg); err.detail=d; throw err;
    }
    return data;
  }
  return {
    async health(){return req('/kiem-tra-ket-noi')},
    async adminNotifications(){return req('/user/admin/notifications')},
    async userAccounts(){
      try{return await req('/user/admin/accounts')}
      catch(e){
        if(e.detail!=='Not Found')throw e;
        // Backend chưa nạp endpoint mới: dùng danh sách giảng viên từ SQL Server làm phương án dự phòng.
        const r=await req('/giang-vien');
        return {items:(r.items||[]).map(x=>({...x,IsActive:true,MustChangePassword:null,TrangThaiGiangVien:x.TrangThai,AccountStatusKnown:false}))};
      }
    },
    async resetUserPassword(maGV, username, currentPassword){return req('/user/admin/accounts/'+encodeURIComponent(maGV)+'/reset-password',{method:'POST',body:JSON.stringify({username,current_password:currentPassword})})},
    async solveSchedule(payload){return req('/xep-lich/cpsat',{method:'POST',body:JSON.stringify(payload)})},
    async latestDot(){return req('/dot-thi/moi-nhat')},
    async dots(){return req('/dot-thi')},
    async createDot(x){return req('/dot-thi',{method:'POST',body:JSON.stringify(x)})},
    async updateDot(id,x){return req('/dot-thi/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify(x)})},
    async deleteDot(id){return req('/dot-thi/'+encodeURIComponent(id),{method:'DELETE'})},
    async exams(dot){return req('/ca-thi'+(dot?'?ma_dot='+encodeURIComponent(dot):''))},
    async createExam(x){return req('/ca-thi',{method:'POST',body:JSON.stringify(x)})},
    async updateExam(id,x){return req('/ca-thi/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify(x)})},
    async deleteExam(id){return req('/ca-thi/'+encodeURIComponent(id),{method:'DELETE'})},
    async saveAssignments(maDot,assignments){return req('/dot-thi/'+encodeURIComponent(maDot)+'/phan-cong',{method:'POST',body:JSON.stringify({assignments})})},
    async lecturers(dot){return req('/giang-vien'+(dot?'?ma_dot='+encodeURIComponent(dot):''))},
    async createLecturer(x){return req('/giang-vien',{method:'POST',body:JSON.stringify(x)})},
    async updateLecturer(id,x){return req('/giang-vien/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify(x)})},
    async setCommonQuota(dot,tyLe,maKhoa=null){return req('/dinh-muc/dat-chung',{method:'POST',body:JSON.stringify({ma_dot:dot,ty_le:tyLe,ma_khoa:maKhoa})})},
    async boMon(khoa='CNTT'){return req('/bo-mon?ma_khoa='+encodeURIComponent(khoa))},
    async resolveKhoa(ten){const r=await req('/khoa/resolve?ten='+encodeURIComponent(ten));return r.MaKhoa},
    async deleteLecturer(id){return req('/giang-vien/'+encodeURIComponent(id),{method:'DELETE'})},
    async teaching(id){return req('/lich-day/'+encodeURIComponent(id))},
    async replaceTeaching(id,items){return req('/lich-day/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify(items)})},
    async importTeaching(rows,filename){return req('/lich-day/import?filename='+encodeURIComponent(filename||''),{method:'POST',body:JSON.stringify(rows)})},
    async busy(id){return req('/lich-ban/'+encodeURIComponent(id))},
    async replaceBusy(id,items){return req('/lich-ban/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify(items)})},
    async importBusy(rows,filename){return req('/lich-ban/import?filename='+encodeURIComponent(filename||''),{method:'POST',body:JSON.stringify(rows)})}
  };
})();
