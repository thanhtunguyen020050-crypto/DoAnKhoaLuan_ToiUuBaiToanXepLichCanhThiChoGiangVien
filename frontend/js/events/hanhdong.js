/* ========= Hành động (click) ========= */
const A={
  login(){
    const u=$('#lu').value.trim().toLowerCase(),p=$('#lp').value,acc=S.users.find(x=>x.user===u),er=$('#lerr');
    if(!acc){er.textContent='Tên đăng nhập không tồn tại.';return}
    if(!acc.on){er.textContent='Tài khoản này đang bị khóa.';return}
    if(!p){er.textContent='Hãy nhập mật khẩu.';return}
    cur=acc;view='home';render();
  },
  async 'admin-notifications'(){
    try{
      const r=await API.adminNotifications();
      const items=r.items||[];localStorage.setItem('huit-admin-seen',String(Math.max(0,...items.map(x=>x.ID))));refreshAdminBell(true);
      openModal({title:'Thông báo đổi ca',wide:true,body:items.length?'<div class="pcl">'+items.map(x=>'<div class="pc"><div class="t"><b>'+esc(x.TieuDe)+'</b><span>'+esc(x.NoiDung)+'</span><span class="hint">'+esc(x.TaoLuc||'')+'</span></div></div>').join('')+'</div>':'<p class="muted">Chưa có thông báo đổi ca.</p>',foot:'<button class="btn pri" data-act="close">Đóng</button>'});
    }catch(e){toast('Không tải được thông báo: '+e.message)}
  },
  'change-admin-password'(){
    openModal({title:'Đổi mật khẩu Admin',body:'<p class="muted">Mật khẩu được lưu dạng băm trong SQL Server.</p><label class="f"><span>Mật khẩu hiện tại</span><input type="password" id="adminOldPass" autocomplete="current-password"></label><label class="f"><span>Mật khẩu mới</span><input type="password" id="adminNewPass" minlength="8" maxlength="16" autocomplete="new-password"></label><label class="f"><span>Nhập lại mật khẩu mới</span><input type="password" id="adminConfirmPass" minlength="8" maxlength="16" autocomplete="new-password"></label><p class="hint">Mật khẩu mới dài 8–16 ký tự, có ít nhất một chữ in hoa (A–Z) và một ký tự đặc biệt (@, #, $...).</p><div class="err" id="adminPassErr" role="alert"></div>',foot:'<button class="btn" data-act="close">Hủy</button><button class="btn pri" data-act="save-admin-password">Đổi mật khẩu</button>'});
  },
  async 'save-admin-password'(){
    const oldp=$('#adminOldPass').value, newp=$('#adminNewPass').value, confirm=$('#adminConfirmPass').value, er=$('#adminPassErr');
    er.textContent='';
    if(newp!==confirm){er.textContent='Mật khẩu nhập lại không khớp.';return}
    if(newp.length<8||newp.length>16||!/[A-Z]/.test(newp)||!/[^A-Za-z0-9]/.test(newp)){er.textContent='Mật khẩu mới phải dài 8–16 ký tự, có chữ in hoa và ký tự đặc biệt.';return}
    try{
      const r=await fetch((window.API_BASE_URL||'http://127.0.0.1:8000/api')+'/auth/admin-change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:sessionStorage.getItem('authUsername')||'admin',current_password:oldp,new_password:newp})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(typeof d.detail==='string'?d.detail:'Không đổi được mật khẩu.');
      closeModal();toast('Đã đổi mật khẩu Admin thành công.');
    }catch(e){er.textContent=e.message||'Không kết nối được backend.'}
  },
  logout(){cur=null;sessionStorage.removeItem('authRole');sessionStorage.removeItem('authUsername');sessionStorage.removeItem('lecturerSession');sessionStorage.removeItem('mustChangePassword');location.replace('login.html')},
  go(t){view=t.dataset.v;render();window.scrollTo(0,0);if(view==='accounts')A['load-user-accounts']()},
  async 'load-user-accounts'(){accountsLoading=true;accountsError='';render();try{const r=await API.userAccounts();adminAccounts=r.items||[]}catch(e){accountsError=e.message==='Not Found'?'Backend chưa nhận API quản lý account. Hãy khởi động lại backend rồi bấm “Tải lại từ CSDL”.':(e.message||'Không tải được danh sách tài khoản.')}finally{accountsLoading=false;render()}},
  'reset-user-password'(t){
    const maGV=t.dataset.id, account=adminAccounts.find(a=>String(a.MaGV)===String(maGV));
    openModal({title:'Cấp mật khẩu tạm',body:'<p class="muted">Cấp mật khẩu mới cho <b>'+esc(account&&account.HoTen||maGV)+'</b> ('+esc(maGV)+'). Mật khẩu hiện tại sẽ mất hiệu lực.</p><label class="f"><span>Nhập lại mật khẩu Admin để xác nhận</span><input type="password" id="resetAdminPassword" autocomplete="current-password" required></label><div class="err" id="resetPasswordError" role="alert"></div>',foot:'<button class="btn" data-act="close">Hủy</button><button class="btn pri" data-act="confirm-reset-user-password" data-id="'+esc(maGV)+'">Cấp mật khẩu tạm</button>'});
  },
  async 'confirm-reset-user-password'(t){
    const maGV=t.dataset.id, error=$('#resetPasswordError'), password=$('#resetAdminPassword').value;
    error.textContent='';
    if(!password){error.textContent='Nhập mật khẩu Admin để xác nhận.';return}
    try{
      const r=await API.resetUserPassword(maGV,sessionStorage.getItem('authUsername')||'admin',password);
      const account=adminAccounts.find(a=>String(a.MaGV)===String(maGV));
      if(account){account.MustChangePassword=true;account.AccountStatusKnown=true}
      const shown=r.temporary_password||'';
      openModal({title:'Mật khẩu tạm đã được cấp',body:'<p>Gửi mật khẩu này trực tiếp cho user. Mật khẩu chỉ hiện ở đây một lần; user phải đổi mật khẩu sau khi đăng nhập.</p><label class="f"><span>Tài khoản: '+esc(maGV)+'</span><input type="text" readonly value="'+esc(shown)+'" onclick="this.select()"></label>',foot:'<button class="btn pri" data-act="close">Đã lưu mật khẩu</button>'});
    }catch(e){error.textContent=e.message||'Không thể cấp mật khẩu tạm.'}
  },
  close(){closeModal()},
  ovclose(t,e){if(e.target===t)closeModal()},
  logo(){$('#logoFile').click()},
  'add-user'(){openModal({title:'Thêm tài khoản',body:'<label class="f"><span>Họ tên</span><input type="text" id="un"></label><label class="f"><span>Tên đăng nhập</span><input type="text" id="uu"></label><label class="f"><span>Vai trò</span><select id="ur">'+ROLES.map(r=>'<option>'+r+'</option>').join('')+'</select></label><div class="err" id="ferr"></div>',foot:'<button class="btn" data-act="close">Hủy</button><button class="btn pri" data-act="save-user">Tạo tài khoản</button>'})},
  'save-user'(){
    const n=$('#un').value.trim(),u=$('#uu').value.trim().toLowerCase(),r=$('#ur').value,er=$('#ferr');
    if(!n||!u){er.textContent='Nhập đủ họ tên và tên đăng nhập.';return}
    if(S.users.some(x=>x.user===u)){er.textContent='Tên đăng nhập này đã tồn tại.';return}
    S.users.push({id:S.nid++,name:n,user:u,role:r,on:true});closeModal();render();toast('Đã tạo tài khoản '+u);
  },
  'del-user'(t){const u=S.users.find(x=>x.id===+t.dataset.id);if(!u||u.id===1)return;if(cur&&cur.id===u.id){toast('Không thể xóa tài khoản đang đăng nhập.');return}S.users=S.users.filter(x=>x!==u);render()},
  async 'refresh-lec'(){await refreshLecturers(true)},
  'add-lec'(){lecForm(null)},
  'edit-lec'(t){lecForm(lec(t.dataset.id))},
  async 'save-lec'(t){
    const n=$('#fn').value.trim(),d=$('#fd').value.trim(),bm=$('#fbm').value,q=parseInt($('#fq').value,10),er=$('#ferr');
    if(!n||!d){er.textContent='Nhập đủ họ tên và khoa.';return}
    if(isNaN(q)||q<0||q>100){er.textContent='Định mức phải là số từ 0 đến 100 (%).';return}
    try{
      const dot=window.__MA_DOT||null;
      if(t.dataset.id){
        const l=lec(t.dataset.id); await API.updateLecturer(l.id,{ho_ten:n,don_vi:'CNTT',ma_bo_mon:bm,ty_le:q,ma_dot:dot}); l.name=n;l.dept=d;l.pct=q;
        toast('Đã cập nhật giảng viên trên SQL Server.');
      }else{
        const r=await API.createLecturer({ho_ten:n,don_vi:'CNTT',ma_bo_mon:bm,ty_le:q,ma_dot:dot});
        S.lecs.push({id:r.ma_gv,name:n,dept:d,pct:q,quota:0,busy:[],teach:[]});
        toast('Đã thêm giảng viên vào SQL Server.');
      }
      closeModal();await refreshLecturers(false);render();
    }catch(e){er.textContent=e.message}
  },
  async 'del-lec'(t){
    const l=lec(t.dataset.id);if(!l)return;
    if(!confirm('Ngừng công tác giảng viên '+l.name+' trên SQL Server?'))return;
    try{await API.deleteLecturer(l.id);S.exams.forEach(e=>{e.asg=e.asg.filter(a=>String(a.l)!==String(l.id))});S.lecs=S.lecs.filter(x=>x!==l);render();toast('Đã cập nhật trạng thái giảng viên trên SQL Server.')}catch(e){toast(e.message)}
  },
  'quota-all'(){openModal({title:'Đặt định mức chung',body:'<p class="muted" style="margin-bottom:10px">Áp dụng cho '+(F.ld?'giảng viên khoa '+esc(F.ld):'tất cả giảng viên')+' đang hiển thị.</p><label class="f"><span>Định mức (%)</span><input type="number" id="qa" min="0" max="100" value="100"></label>',foot:'<button class="btn" data-act="close">Hủy</button><button class="btn pri" data-act="do-quota-all">Áp dụng</button>'})},
  async 'do-quota-all'(){const q=parseInt($('#qa').value,10);if(isNaN(q)||q<0||q>100)return;try{const dot=window.__MA_DOT;if(!dot){toast('Chưa có đợt thi để lưu định mức.');return}let maKhoa=null;if(F.ld)maKhoa=await API.resolveKhoa(F.ld);const r=await API.setCommonQuota(dot,q,maKhoa);closeModal();await refreshLecturers(false);render();toast('Đã lưu định mức chung '+q+'% vào SQL Server. Tổng định mức: '+r.TongDinhMuc+'/'+r.TongNhuCau+' ca.')}catch(e){toast(e.message)}},
  busy(t){
    const l=lec(t.dataset.id),dates=[...new Set(S.exams.map(e=>e.date))].sort();
    if(!dates.length){openModal({title:'Lịch dạy và lịch bận',body:'<p>Chưa có lịch thi nên chưa có ngày để khai báo lịch bận. Hãy import lịch thi ở mục 3 trước.</p>',foot:'<button class="btn" data-act="close">Đóng</button>'});return}
    const cb=(c,v,on,lb)=>'<span class="c"><input type="checkbox" class="'+c+'" value="'+v+'"'+(on?' checked':'')+' aria-label="'+lb+'"></span>';
    const teach=(l.teach||[]).slice().sort();
    openModal({title:'Lịch dạy và lịch bận của '+l.name,wide:true,body:'<p class="muted" style="margin-bottom:8px"><b>Lịch dạy</b>: lấy từ file import, là HARD CONSTRAINT 100% — tuyệt đối không xếp gác trùng. <b>Lịch bận</b>: phát sinh cá nhân, là SOFT CONSTRAINT — ưu tiên né.</p>'+(teach.length?'<div class="panel" style="margin:8px 0"><b>Lịch dạy đã import ('+teach.length+' ca)</b><p class="hint">'+teach.map(x=>{const p=x.split('|');return fmtD(p[0])+' · tiết '+p[1].replace('-', ' → ')}).join('; ')+'</p></div>':'<p class="hint">Chưa có lịch dạy được import cho giảng viên này.</p>')+'<div class="bz" style="grid-template-columns:1.6fr repeat(2,.9fr)"><span class="hd">Ngày</span><span class="hd c">Bận sáng</span><span class="hd c">Bận chiều</span>'+dates.map(d=>'<span>'+wd(d)+' '+fmtD(d)+'</span>'+cb('bk',d+'|S',(l.busy||[]).some(x=>(typeof x==='string'?x:x.key)===d+'|S'),'Bận sáng '+fmtD(d))+cb('bk',d+'|C',(l.busy||[]).some(x=>(typeof x==='string'?x:x.key)===d+'|C'),'Bận chiều '+fmtD(d))).join('')+'</div>',foot:'<button class="btn" data-act="close">Hủy</button><button class="btn pri" data-act="save-busy" data-id="'+l.id+'">Lưu lịch bận</button>'});
  },
  async 'save-busy'(t){
    const l=lec(t.dataset.id);if(!l)return;
    const busy=[...document.querySelectorAll('#modal .bk:checked')].map(x=>x.value);
    const items=busy.map(v=>{const [d,b]=v.split('|');return {ngay_ban:d,tu_tiet:b==='S'?1:7,den_tiet:b==='S'?6:12,ly_do:null}});
    try{await API.replaceBusy(l.id,items);await refreshLecturers(false);closeModal();render();toast('Đã lưu lịch bận vào SQL Server. Lịch dạy import không bị thay đổi. Lịch bận nhập tay được xử lý ở mức ưu tiên thấp nhất.')}catch(e){toast(e.message)}
  },
  'clear-schedule'(t){
    const l=lec(t.dataset.id);if(!l)return;
    const hasTeach=!!(l.teach&&l.teach.length),hasBusy=!!(l.busy&&l.busy.length);
    const icoBook='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
    const icoBan='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>';
    const cardStyle=(active,enabled)=>'display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:10px;border:2px solid '+(active&&enabled?'var(--bad)':'var(--line)')+';background:'+(active&&enabled?'var(--badbg)':'var(--card)')+';cursor:'+(enabled?'pointer':'not-allowed')+';opacity:'+(enabled?'1':'0.4')+';transition:border-color .15s,background .15s;user-select:none';
    const cardTeach='<label style="'+cardStyle(hasTeach,hasTeach)+'" id="cardTeach">'
      +'<span style="flex:none;width:40px;height:40px;border-radius:9px;background:'+(hasTeach?'var(--badbg)':'var(--sky)')+';color:'+(hasTeach?'var(--bad)':'var(--muted)')+';display:flex;align-items:center;justify-content:center">'+icoBook+'</span>'
      +'<span style="flex:1;min-width:0"><span style="display:block;font-weight:600;font-size:14px">Lịch dạy</span>'
      +'<span style="display:block;font-size:12.5px;color:var(--muted);margin-top:1px">'+(hasTeach?'<b style="color:var(--bad)">'+l.teach.length+' ca dạy</b> sẽ bị xóa khỏi LichDayGV':'Chưa có lịch dạy để xóa')+'</span></span>'
      +'<input type="checkbox" id="clrTeach" style="width:18px;height:18px;accent-color:var(--bad);flex:none"'+(hasTeach?' checked':' disabled')+'>'
      +'</label>';
    const cardBusy='<label style="'+cardStyle(hasBusy,hasBusy)+'" id="cardBusy">'
      +'<span style="flex:none;width:40px;height:40px;border-radius:9px;background:'+(hasBusy?'var(--badbg)':'var(--sky)')+';color:'+(hasBusy?'var(--bad)':'var(--muted)')+';display:flex;align-items:center;justify-content:center">'+icoBan+'</span>'
      +'<span style="flex:1;min-width:0"><span style="display:block;font-weight:600;font-size:14px">Lịch bận</span>'
      +'<span style="display:block;font-size:12.5px;color:var(--muted);margin-top:1px">'+(hasBusy?'<b style="color:var(--bad)">'+l.busy.length+' buổi bận</b> sẽ bị xóa khỏi LichBanGV':'Chưa có lịch bận để xóa')+'</span></span>'
      +'<input type="checkbox" id="clrBusy" style="width:18px;height:18px;accent-color:var(--bad);flex:none"'+(hasBusy?' checked':' disabled')+'>'
      +'</label>';
    const warn='<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;background:var(--warnbg);color:var(--warn);font-size:13px;margin-top:14px">'
      +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
      +'<span>Dữ liệu bị xóa <b>không thể khôi phục</b>. Hãy chắc chắn trước khi xác nhận.</span></div>';
    openModal({
      title:'Xóa lịch của '+esc(l.name),
      body:'<p style="color:var(--muted);font-size:13.5px;margin-bottom:14px">Chọn loại lịch cần xóa:</p>'
        +'<div style="display:flex;flex-direction:column;gap:10px">'+cardTeach+cardBusy+'</div>'
        +warn
        +'<div class="err" id="clrErr" style="margin-top:10px"></div>',
      foot:'<button class="btn" data-act="close">Hủy</button>'
        +'<button style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:0;border-radius:8px;background:var(--bad);color:#fff;font-weight:600;font-size:14px;cursor:pointer" data-act="do-clear-schedule" data-id="'+l.id+'">'
        +'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'
        +'Xóa đã chọn</button>'
    });
  },
  async 'do-clear-schedule'(t){
    const l=lec(t.dataset.id);if(!l)return;
    const doTeach=$('#clrTeach')&&$('#clrTeach').checked;
    const doBusy=$('#clrBusy')&&$('#clrBusy').checked;
    if(!doTeach&&!doBusy){const er=$('#clrErr');if(er)er.textContent='Vui lòng chọn ít nhất một loại lịch để xóa.';return}
    const what=(doTeach&&doBusy)?'lịch dạy và lịch bận':doTeach?'lịch dạy':'lịch bận';
    try{
      const errs=[];
      if(doTeach){try{await API.replaceTeaching(l.id,[])}catch(e){errs.push('Lịch dạy: '+e.message)}}
      if(doBusy){try{await API.replaceBusy(l.id,[])}catch(e){errs.push('Lịch bận: '+e.message)}}
      await refreshLecturers(false);closeModal();render();
      if(errs.length)toast('Xóa một phần. Lỗi: '+errs.join('; '));
      else toast('Đã xóa '+what+' của '+l.name+' khỏi SQL Server.');
    }catch(e){toast(e.message)}
  },

  'pick-busy-file'(){$('#fileBusy').click()},
  async 'apply-busy'(){
    if(!pendBusy)return;
    try{
      const r=await API.importBusy(pendBusy.rows,pendBusy.name);
      await refreshLecturers(false);
      const n=pendBusy.rows.length;pendBusy=null;render();
      toast('Đã import '+n+' dòng lịch bận, khớp '+r.teachers+' giảng viên vào LichBanGV. Ngày được chuẩn hóa và tên không phân biệt hoa/thường.');
    }catch(e){
      const d=e&&e.detail;
      const errs=d&&d.errors?d.errors:[{line:'-',msg:e.message||String(e)}];
      pendBusy.errors=[...(pendBusy.errors||[]),...errs];
      render();toast(d&&d.message?d.message:(e.message||String(e)));
    }
  },
  'cancel-busy'(){pendBusy=null;render()},
  'pick-teach-file'(){$('#fileTeach').click()},
  async 'apply-teach'(){
    if(!pendTeach)return;
    try{
      const r=await API.importTeaching(pendTeach.rows.map(x=>({name:x.name,date:x.date,start:x.start,end:x.end,line:x.line})),pendTeach.name);
      await refreshLecturers(false);
      const n=pendTeach.rows.length;pendTeach=null;render();toast('Đã import '+n+' ca lịch dạy vào bảng LichDayGV cho '+r.teachers+' giảng viên. Không tạo giảng viên mới và không ghi vào LichBanGV.');
    }catch(e){
      pendTeach.errors=[...(pendTeach.errors||[]),{line:'-',msg:e.message||String(e)}]; render(); toast(e.message||String(e));
    }
  },
  'cancel-teach'(){pendTeach=null;render()},
  'pick-exam-file'(){$('#fileExam').click()},
  'add-exam'(){examForm()},
  async 'save-exam'(t){
    const date=parseDate($('#exDate').value),period=$('#exPeriod').value,slot=parsePeriod(period),kind=$('#exKind').value,need=parseInt($('#exNeed').value,10),old=t.dataset.id?exm(+t.dataset.id):null,dots=S.dots||[],dot=(old&&dots.find(d=>d.MaDot===old.ma_dot))||dots.find(d=>date&&String(d.NgayBatDau).slice(0,10)<=date&&String(d.NgayKetThuc).slice(0,10)>=date)||dots[0]||{},now=new Date().getFullYear(),hk=old&&old.hoc_ky||dot.HocKy||'HK1',yh=old&&old.nam_hoc||dot.NamHoc||(now+'-'+(now+1)),er=$('#exErr');
    if(!date){er.textContent='Hãy chọn ngày thi.';return}if(!slot){er.textContent='Tiết/ca không hợp lệ.';return}if(isNaN(need)||need<1||need>30){er.textContent='Số giảng viên cần từ 1 đến 30.';return}
    if(old&&need<old.asg.length){er.textContent='Số giảng viên cần không thể thấp hơn số người đã được phân công.';return}
    try{
      const payload={ma_dot:old?old.ma_dot:null,hoc_ky:hk,nam_hoc:yh,ngay_thi:date,tu_tiet:slot.start,den_tiet:slot.end,hinh_thuc_thi:kind==='TL'?'Tự luận':'Lý thuyết',so_gv_can_cap:need};
      if(old) await API.updateExam(old.ma_ca,payload); else await API.createExam(payload);
      closeModal();await refreshExamData(false);render();toast((old?'Đã cập nhật':'Đã lưu')+' ca thi vào SQL Server.');
    }catch(e){er.textContent=e.message}
  },
  async 'del-exam'(t){const e=exm(+t.dataset.id);if(!e)return;if(!confirm('Xóa ca thi này khỏi SQL Server?'))return;try{await API.deleteExam(e.ma_ca);await refreshExamData(false);toast('Đã xóa ca thi khỏi SQL Server.')}catch(x){toast(x.message)}},
  'edit-exam'(t){examForm(exm(+t.dataset.id))},
  async 'do-import-exam'(){
    if(!pend||!pend.rows.length)return;
    try{
      const hk=((S.dots||[])[0]||{}).HocKy||'HK1',yh=((S.dots||[])[0]||{}).NamHoc||((new Date().getFullYear())+'-'+(new Date().getFullYear()+1));
      for(const r of pend.rows){const s=parsePeriod(r.period);await API.createExam({hoc_ky:hk,nam_hoc:yh,ngay_thi:r.date,tu_tiet:s.start,den_tiet:s.end,hinh_thuc_thi:r.kind==='TL'?'Tự luận':'Lý thuyết',so_gv_can_cap:r.need})}
      pend=null;await refreshExamData(false);render();toast('Đã nhập toàn bộ ca thi vào SQL Server.');
    }catch(e){toast(e.message)}
  },
  'cancel-import-exam'(){pend=null;render()},
  'reset-soft'(){S.soft={S1:{on:true,w:6},S2:{on:true,w:8,n:80}};render();toast('Đã khôi phục cấu hình mặc định.')},
  precheck(){doPre();render()},
  async auto(){await runAuto()},
  async 'force-run'(){await autoRun()},
  pick(t){pick={ex:+t.dataset.ex,q:''};const e=exm(pick.ex);openModal({title:'Chọn giảng viên · '+(e.period||SES[e.ses])+', '+fmtD(e.date),wide:true,body:'<p class="muted">'+LB[e.kind]+' · cần '+e.need+' giảng viên</p><div class="tools" style="margin-top:10px"><div class="grow"><input type="text" data-inp="pick-q" placeholder="Tìm giảng viên" aria-label="Tìm giảng viên"></div><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="lockNew" checked>Khóa phân công này</label></div><div class="pl" id="pickList">'+pickList()+'</div>'})},
  'pick-ok'(t){
    const e=exm(pick.ex),lid=t.dataset.l;if(e.asg.length>=e.need){toast('Ca thi đã đủ giảng viên cần phân công.');return}const issues=hardIssues(e,lid);if(issues.length){toast('Không thể phân công: '+issues.join(', '));return}const lock=$('#lockNew').checked;e.asg.push({l:lid,lock:lock});closeModal();render();
  },
  async 'publish-assignments'(){try{const r=await persistAssignments();toast('Đã lưu '+r.assignments_saved+' lượt phân công lên SQL Server. Trang giảng viên có thể làm mới để xem lịch.')}catch(e){toast(e.message||'Không lưu được phân công lên SQL Server.')}},
  lock(t){const e=exm(+t.dataset.ex),a=e.asg.find(x=>String(x.l)===String(t.dataset.l));a.lock=!a.lock;render()},
  unasg(t){const e=exm(+t.dataset.ex);e.asg=e.asg.filter(x=>String(x.l)!==String(t.dataset.l));render()},
  'clear-unlocked'(){let n=0;S.exams.forEach(e=>{const k=e.asg.filter(a=>a.lock);n+=e.asg.length-k.length;e.asg=k});render();toast('Đã xóa '+n+' phân công chưa khóa.')},
  'save-hist'(){snapshot('Thủ công');render();toast('Đã lưu bản này vào lịch sử.')},
  tab6(t){tab6=t.dataset.t;render()},
  xmode(t){F.xm=t.dataset.m;render()},
  xlsx(){
    if(typeof XLSX==='undefined'){toast('Chưa tải được thư viện Excel. Kiểm tra kết nối mạng rồi thử lại.');return}
    const wb=XLSX.utils.book_new(),names={lec:'Theo giảng viên',ses:'Theo ca thi'};let n=0;
    if(S.exams.length){XLSX.utils.book_append_sheet(wb,assignmentMatrix(),'Phân công coi thi');n++}
    ['lec','ses'].forEach(m=>{
      const d=exportData(m);if(!d.rows.length)return;
      const ws=XLSX.utils.aoa_to_sheet([d.head].concat(d.rows));
      ws['!cols']=d.head.map((h,i)=>({wch:Math.min(40,Math.max(String(h).length,...d.rows.map(r=>String(r[i]==null?'':r[i]).length))+2)}));
      XLSX.utils.book_append_sheet(wb,ws,names[m]);n++;
    });
    if(!n){toast('Chưa có dữ liệu để xuất.');return}
    const gap=analyze().S1,gapRows=[
      ['Chỉ số ca gãy','Giá trị'],
      ['Ràng buộc S1',gap.enabled?'Đang bật':'Đang tắt'],
      ['Mức ưu tiên S1',gap.weight],
      ['Tỷ lệ ngày không gãy',gap.total?Math.round((gap.total-gap.fragmentedDays)/gap.total*100)+'%':'—'],
      ['Số GV-ngày bị gãy',gap.fragmentedDays],
      ['Số khoảng gãy giữa ca',gap.gapEvents],
      ['Tổng tiết trống giữa ca',gap.idlePeriods],
      ['Số lần gãy do qua buổi',gap.sessionBreaks],
      ['Đơn vị phạt S1',gap.penaltyUnits],
      ['Điểm phạt S1',gap.penalty],
      ['Tổng GV-ngày lên trường',gap.total],
      ['GV-ngày có nhiều ca',gap.multiShiftDays]
    ];
    const gapWs=XLSX.utils.aoa_to_sheet(gapRows);
    gapWs['!cols']=[{wch:34},{wch:24}];
    XLSX.utils.book_append_sheet(wb,gapWs,'Chỉ số ca gãy');n++;
    const t=new Date(),pad=x=>String(x).padStart(2,'0');
    XLSX.writeFile(wb,'lich-gac-thi-'+t.getFullYear()+pad(t.getMonth()+1)+pad(t.getDate())+'.xlsx');
    toast('Đã tải file Excel gồm '+n+' trang, có bảng ma trận và chỉ số ca gãy.');
  },
  copy(){const d=exportData(F.xm);copyText([d.head].concat(d.rows).map(r=>r.join('\t')).join('\n'))},
  restore(t){
    const h=S.hist.find(x=>x.id===+t.dataset.id);if(!h)return;
    h.snap.forEach(p=>{const e=exm(p[0]);if(e)e.asg=p[1].filter(x=>lec(x[0])).map(x=>({l:x[0],lock:!!x[1]}))});
    view='sched';render();toast('Đã khôi phục bản xếp lúc '+h.time+'.');
  },
  'del-hist'(t){S.hist=S.hist.filter(x=>x.id!==+t.dataset.id);render()}
};
document.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(!t)return;const f=A[t.dataset.act];if(f)f(t,e)});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('#modal').innerHTML)closeModal();
  if(e.key==='Enter'&&!cur&&(e.target.id==='lu'||e.target.id==='lp'))A.login();
});

