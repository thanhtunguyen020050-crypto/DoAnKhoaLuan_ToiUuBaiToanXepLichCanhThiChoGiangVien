/* ========= Hành động (click) ========= */
function renderTeachingEditor(){
  const l=teachingEdit&&lec(teachingEdit.id);if(!l)return;
  const items=teachingEdit.items||[],busy=teachingEdit.busy||[],savedDuty=teachingEdit.savedDuty||[],newDuty=teachingEdit.newDuty||[];
  const teachingRows=items.length?items.map((x,i)=>`<div class="sched-manual-row"><div><b>${esc(fmtD(x.date))} \u00b7 ti\u1ebft ${x.start}\u2013${x.end}</b>${x.source?`<small>Ngu\u1ed3n: ${esc(x.source)}</small>`:''}</div><button type="button" class="btn sm ghost danger icon-delete" data-act="remove-teaching-row" data-index="${i}" aria-label="X\u00f3a ca d\u1ea1y">${IC.trash}</button></div>`).join(''):'<p class="muted sched-manual-empty">Ch\u01b0a c\u00f3 ca d\u1ea1y.</p>';
  const busyRows=busy.length?busy.map((x,i)=>`<div class="sched-manual-row"><div><b>${esc(fmtD(x.date))} \u00b7 ti\u1ebft ${x.start}\u2013${x.end}</b><small>${esc(x.reason||'Ch\u01b0a ghi l\u00fd do')}</small></div><button type="button" class="btn sm ghost danger icon-delete" data-act="remove-manual-busy" data-index="${i}" aria-label="X\u00f3a l\u1ecbch b\u1eadn">${IC.trash}</button></div>`).join(''):'<p class="muted sched-manual-empty">Ch\u01b0a c\u00f3 l\u1ecbch b\u1eadn.</p>';
  const dutyRows=[...savedDuty.map(x=>({saved:true,date:String(x.NgayThi).slice(0,10),start:x.TuTiet,end:x.DenTiet,code:x.MaHP,course:x.MonThi,source:x.NguonFile})),...newDuty.map((x,i)=>({...x,index:i}))];
  const dutyList=dutyRows.length?dutyRows.map(x=>`<div class="sched-manual-row"><div><b>${esc(fmtD(x.date))} \u00b7 ti\u1ebft ${x.start}\u2013${x.end} \u00b7 ${esc(x.code)}</b><small>${esc(x.course)}${x.saved?' \u00b7 \u0110\u00e3 l\u01b0u'+(x.source?' \u00b7 '+esc(x.source):''):' \u00b7 Ch\u01b0a l\u01b0u'}</small></div>${x.saved?'':`<button type="button" class="btn sm ghost danger icon-delete" data-act="remove-manual-duty" data-index="${x.index}" aria-label="B\u1ecf l\u1ecbch tr\u1ef1c \u0111\u1ec1">${IC.trash}</button>`}</div>`).join(''):'<p class="muted sched-manual-empty">Ch\u01b0a c\u00f3 l\u1ecbch tr\u1ef1c \u0111\u1ec1 trong \u0111\u1ee3t n\u00e0y.</p>';
  const reasons=[['','Kh\u00f4ng n\u00eau l\u00fd do'],['\u0110i c\u00f4ng t\u00e1c, h\u1ecdp theo quy\u1ebft \u0111\u1ecbnh c\u1ee7a Tr\u01b0\u1eddng','\u0110i c\u00f4ng t\u00e1c, h\u1ecdp theo quy\u1ebft \u0111\u1ecbnh c\u1ee7a Tr\u01b0\u1eddng'],['B\u1eadn vi\u1ec7c gia \u0111\u00ecnh (Hi\u1ebfu, h\u1ef7)','B\u1eadn vi\u1ec7c gia \u0111\u00ecnh (Hi\u1ebfu, h\u1ef7)'],['S\u1ef1 c\u1ed1 s\u1ee9c kh\u1ecfe / B\u1eadn vi\u1ec7c kh\u1ea9n c\u1ea5p \u0111\u1ed9t xu\u1ea5t (\u01afu ti\u00ean sau c\u00f9ng - trao \u0111\u1ed5i gi\u1eefa GV)','S\u1ef1 c\u1ed1 s\u1ee9c kh\u1ecfe / B\u1eadn vi\u1ec7c kh\u1ea9n c\u1ea5p \u0111\u1ed9t xu\u1ea5t']];
  const reasonOptions=reasons.map(([v,label])=>`<option value="${esc(v)}">${esc(label)}</option>`).join('');
  const tab=teachingEdit.tab||'teaching';
  const tabButton=(key,label,icon,count)=>`<button type="button" class="sched-tab${tab===key?' active':''}" data-act="schedule-tab" data-tab="${key}" aria-selected="${tab===key}">${icon}<span>${label}</span>${count?`<i>${count}</i>`:''}</button>`;
  openModal({title:'Th\u00eam l\u1ecbch \u00b7 '+l.name,wide:true,className:'schedule-editor-modal',body:`<p class="sched-intro">Qu\u1ea3n l\u00fd l\u1ecbch d\u1ea1y, l\u1ecbch b\u1eadn v\u00e0 l\u1ecbch tr\u1ef1c \u0111\u1ec1 c\u1ee7a gi\u1ea3ng vi\u00ean n\u00e0y.</p><nav class="sched-tabs" role="tablist">${tabButton('teaching','L\u1ecbch d\u1ea1y',IC.cal,items.length)}${tabButton('busy','L\u1ecbch b\u1eadn',IC.calendarOff,busy.length)}${tabButton('duty','Tr\u1ef1c \u0111\u1ec1',IC.clip,savedDuty.length+newDuty.length)}</nav>
    <section class="panel sched-manual-section" ${tab!=='teaching'?'hidden':''}><div class="sched-manual-heading"><span class="sched-manual-icon teaching">${IC.cal}</span><div><b>L\u1ecbch d\u1ea1y</b><small>Gi\u00fap tr\u00e1nh ph\u00e2n c\u00f4ng coi thi tr\u00f9ng gi\u1edd</small></div></div><div class="sched-manual-list">${teachingRows}</div><div class="sched-manual-form"><label class="f"><span>Ng\u00e0y d\u1ea1y</span><input type="date" id="teachDate"></label><label class="f"><span>Ti\u1ebft \u0111\u1ea7u</span><input type="number" id="teachStart" min="1" max="12" value="1"></label><label class="f"><span>Ti\u1ebft cu\u1ed1i</span><input type="number" id="teachEnd" min="1" max="12" value="2"></label><button type="button" class="btn" data-act="add-teaching-row">Th\u00eam ca d\u1ea1y</button></div></section>
    <section class="panel sched-manual-section" ${tab!=='busy'?'hidden':''}><div class="sched-manual-heading"><span class="sched-manual-icon busy">${IC.calendarOff}</span><div><b>L\u1ecbch b\u1eadn</b><small>Khai b\u00e1o kho\u1ea3ng ti\u1ebft v\u00e0 l\u00fd do b\u1eadn</small></div></div><div class="sched-manual-list">${busyRows}</div><div class="sched-manual-form sched-busy-form"><label class="f"><span>Ng\u00e0y b\u1eadn</span><input type="date" id="manualBusyDate"></label><label class="f"><span>Ti\u1ebft \u0111\u1ea7u</span><input type="number" id="manualBusyStart" min="1" max="12" value="1"></label><label class="f"><span>Ti\u1ebft cu\u1ed1i</span><input type="number" id="manualBusyEnd" min="1" max="12" value="12"></label><label class="f"><span>L\u00fd do</span><select id="manualBusyReason">${reasonOptions}</select></label><button type="button" class="btn" data-act="add-manual-busy">Th\u00eam l\u1ecbch b\u1eadn</button></div></section>
    <section class="panel sched-manual-section" ${tab!=='duty'?'hidden':''}><div class="sched-manual-heading"><span class="sched-manual-icon duty">${IC.clip}</span><div><b>L\u1ecbch tr\u1ef1c \u0111\u1ec1 th\u1ee7 c\u00f4ng</b><small>Gi\u1ea3ng vi\u00ean \u0111ang ch\u1ecdn s\u1ebd \u0111\u01b0\u1ee3c g\u00e1n tr\u1ef1c \u0111\u1ec1</small></div></div><div class="sched-manual-list">${dutyList}</div><div class="sched-manual-form sched-duty-form"><label class="f"><span>M\u00e3 h\u1ecdc ph\u1ea7n</span><input type="text" id="manualDutyCode" maxlength="30" placeholder="V\u00ed d\u1ee5: 0101101931"></label><label class="f sched-duty-course"><span>M\u00f4n thi</span><input type="text" id="manualDutyCourse" maxlength="300" placeholder="T\u00ean m\u00f4n thi"></label><label class="f"><span>Ng\u00e0y thi</span><input type="date" id="manualDutyDate"></label><label class="f"><span>Ti\u1ebft \u0111\u1ea7u</span><input type="number" id="manualDutyStart" min="1" max="16" value="1"></label><label class="f"><span>Ti\u1ebft cu\u1ed1i</span><input type="number" id="manualDutyEnd" min="1" max="16" value="2"></label><button type="button" class="btn" data-act="add-manual-duty">Th\u00eam tr\u1ef1c \u0111\u1ec1</button></div><p class="hint sched-manual-hint">\u0110\u1ee3t \u0111ang l\u01b0u: ${esc(window.__MA_DOT||'Ch\u01b0a c\u00f3 \u0111\u1ee3t thi')}. H\u1ecdc ph\u1ea7n, ng\u00e0y v\u00e0 ti\u1ebft \u0111\u01b0\u1ee3c l\u01b0u ri\u00eang kh\u1ecfi ph\u00e2n c\u00f4ng coi thi.</p></section><div class="err" id="teachErr" role="alert">${esc(teachingEdit.error||'')}</div>`,foot:'<button class="btn" data-act="close-schedule-editor">H\u1ee7y</button><button class="btn pri" data-act="save-teaching-schedule" data-id="'+esc(l.id)+'">L\u01b0u thay \u0111\u1ed5i</button>'});
}
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
      const noticeCards=items.map(x=>{
        const paragraphs=String(x.NoiDung||'Không có nội dung').split(/(?<=\.)\s+/).filter(Boolean);
        const message=paragraphs.map(p=>'<p>'+esc(p)+'</p>').join('');
        const action=x.Loai==='BusyRequest'&&x.YeuCauBaoBanID
          ? '<button class="btn sm pri" data-act="process-busy-request" data-id="'+esc(x.YeuCauBaoBanID)+'">Mở đơn đã được xác nhận</button>'
          : '';
        return '<div class="pc"><div class="t"><b>'+esc(x.TieuDe||'Thông báo')+'</b><div class="notice-message">'+message+'</div><span class="hint">'+esc(String(x.TaoLuc||'').replace('T',' '))+'</span>'+action+'</div></div>';
      }).join('');
      openModal({title:'Thông báo hệ thống',wide:true,body:items.length?'<div class="pcl">'+noticeCards+'</div>':'<p class="muted">Chưa có thông báo.</p>',foot:'<button class="btn pri" data-act="close">Đóng</button>'});
    }catch(e){toast('Không tải được thông báo: '+e.message)}
  },
  'change-admin-password'(){
    openModal({title:'Đổi mật khẩu Admin',body:'<label class="f"><span>Mật khẩu hiện tại</span><input type="password" id="adminOldPass" autocomplete="current-password"></label><label class="f"><span>Mật khẩu mới</span><input type="password" id="adminNewPass" minlength="8" maxlength="16" autocomplete="new-password"></label><label class="f"><span>Nhập lại mật khẩu mới</span><input type="password" id="adminConfirmPass" minlength="8" maxlength="16" autocomplete="new-password"></label><p class="hint">Mật khẩu mới dài 8–16 ký tự, có ít nhất một chữ in hoa (A–Z) và một ký tự đặc biệt (@, #, $...).</p><div class="err" id="adminPassErr" role="alert"></div>',foot:'<button class="btn" data-act="close">Hủy</button><button class="btn pri" data-act="save-admin-password">Đổi mật khẩu</button>'});
  },
  async 'save-admin-password'(){
    const oldp=$('#adminOldPass').value, newp=$('#adminNewPass').value, confirm=$('#adminConfirmPass').value, er=$('#adminPassErr');
    er.textContent='';
    if(newp!==confirm){er.textContent='Mật khẩu nhập lại không khớp.';return}
    if(newp.length<8||newp.length>16||!/[A-Z]/.test(newp)||!/[^A-Za-z0-9]/.test(newp)){er.textContent='Mật khẩu mới phải dài 8–16 ký tự, có chữ in hoa và ký tự đặc biệt.';return}
    try{
      const r=await fetch((window.API_BASE_URL||'http://127.0.0.1:8000/api')+'/auth/admin-change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:sessionStorage.getItem('authUsername')||'admin',current_password:oldp,new_password:newp})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(API.friendlyError(typeof d.detail==='string'?d.detail:(d.detail&&d.detail.message)||'Không đổi được mật khẩu.',r.status));
      closeModal();toast('Đã đổi mật khẩu Admin thành công.');
    }catch(e){er.textContent=e.message==='Failed to fetch'?'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.':(e.message||'Không thể đổi mật khẩu lúc này.')}
  },
  logout(){cur=null;sessionStorage.removeItem('authRole');sessionStorage.removeItem('authUsername');sessionStorage.removeItem('authToken');sessionStorage.removeItem('lecturerSession');sessionStorage.removeItem('mustChangePassword');location.replace('login.html')},
  go(t){if(t.dataset.task==='pending-busy'){busyReqFilter='PENDING';busyReqSearch=''}view=t.dataset.v;render();window.scrollTo(0,0);if(view==='accounts')A['load-user-accounts']();if(view==='busy_reqs')A['load-busy-requests']();},
  async 'load-user-accounts'(){accountsLoading=true;accountsError='';render();try{const r=await API.userAccounts();adminAccounts=r.items||[]}catch(e){accountsError=e.message==='Not Found'?'Chức năng quản lý tài khoản chưa sẵn sàng. Vui lòng thử làm mới dữ liệu hoặc liên hệ quản trị viên.':(e.message||'Không tải được danh sách tài khoản.')}finally{accountsLoading=false;render()}},
  'reset-user-password'(t){
    const maGV=t.dataset.id, account=adminAccounts.find(a=>String(a.MaGV)===String(maGV));
    openModal({title:'Cấp mật khẩu tạm',body:'<p class="muted">Cấp mật khẩu mới cho <b>'+esc(account&&account.HoTen||maGV)+'</b> ('+esc(maGV)+'). Mật khẩu hiện tại sẽ mất hiệu lực.</p><label class="f"><span>Nhập lại mật khẩu Admin để xác nhận</span><input type="password" id="resetAdminPassword" autocomplete="current-password" required></label><div class="err" id="resetPasswordError" role="alert"></div>',foot:'<button class="btn" data-act="close">Hủy</button><button class="btn pri" data-act="confirm-reset-user-password" data-id="'+esc(maGV)+'">Cấp mật khẩu tạm</button>'});
  },
  'export-accounts'(){
    if(!adminAccounts.length){toast('Chưa có tài khoản để xuất.');return}
    if(typeof XLSX==='undefined'){toast('Chưa tải được thư viện Excel. Kiểm tra kết nối mạng rồi thử lại.');return}
    const data=accountRows().items.map(a=>{const lastLogin=a.LastLoginAt?new Date(a.LastLoginAt):null;return [a.HoTen||'',a.MaGV||'',a.Email||'',a.TrangThaiGiangVien||'',a.AccountStatusKnown===false?'Chưa có tài khoản':a.MustChangePassword?'Cần đổi mật khẩu':'Đã thiết lập',lastLogin&&!Number.isNaN(lastLogin.getTime())?lastLogin.toLocaleString('vi-VN'):'Chưa đăng nhập']});
    const headers=['Giảng viên','Mã giảng viên','Email đăng nhập','Trạng thái công tác','Bảo mật mật khẩu','Đăng nhập cuối'];
    const ws=XLSX.utils.aoa_to_sheet([headers,...data]);
    ws['!cols']=[{wch:28},{wch:16},{wch:32},{wch:22},{wch:24},{wch:24}];
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Tài khoản');
    const now=new Date(),pad=n=>String(n).padStart(2,'0');
    XLSX.writeFile(wb,'danh-sach-tai-khoan-'+now.getFullYear()+pad(now.getMonth()+1)+pad(now.getDate())+'.xlsx');
    toast('Đã xuất '+data.length+' tài khoản.');
  },
  async 'toggle-account-employment'(t){
    const maGV=t.dataset.id, account=adminAccounts.find(a=>String(a.MaGV)===String(maGV));
    if(!account)return;
    const stopped=account.TrangThaiGiangVien!=='Đang công tác';
    const message=stopped
      ? 'Khôi phục trạng thái công tác cho '+(account.HoTen||maGV)+'? Tài khoản đăng nhập sẽ được mở lại.'
      : 'Chuyển '+(account.HoTen||maGV)+' sang trạng thái ngừng công tác? Giảng viên sẽ không đăng nhập được cho đến khi được khôi phục.';
    if(!confirm(message))return;
    t.disabled=true;
    try{
      if(stopped)await API.reactivateLecturer(maGV);
      else await API.deleteLecturer(maGV);
      await A['load-user-accounts']();
      toast(stopped?'Đã khôi phục trạng thái công tác và mở lại tài khoản.':'Đã ngừng công tác và khóa tài khoản đăng nhập.');
    }catch(e){t.disabled=false;toast(e.message||'Không thể cập nhật trạng thái công tác.')}
  },
  async 'reactivate-lecturer'(t){
    const maGV=t.dataset.id, account=adminAccounts.find(a=>String(a.MaGV)===String(maGV));
    if(!account||!confirm('Khôi phục trạng thái công tác cho '+(account.HoTen||maGV)+'? Tài khoản đăng nhập cũng sẽ được mở lại.'))return;
    try{
      await API.reactivateLecturer(maGV);
      await A['load-user-accounts']();
      toast('Đã khôi phục trạng thái công tác và mở lại tài khoản.');
    }catch(e){toast(e.message||'Không thể khôi phục tài khoản.')}
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
  ovclose(t,e){const close=e.target===t&&modalBackdropMouseDown===t;modalBackdropMouseDown=null;if(close)closeModal()},
  async 'load-busy-requests'(){
    busyReqsLoading=true;busyReqsError='';render();
    try{
      const r=await API.adminBusyRequests(busyReqFilter, busyReqSearch);
      adminBusyRequests=r.items||[];
    }catch(e){
      busyReqsError=e.message||'Không tải được danh sách yêu cầu báo bận.';
    }finally{
      busyReqsLoading=false;render();
      refreshAdminBusyCount();
    }
  },
  async 'accept-all-busy-requests'(t){
    const requests=adminBusyRequests.filter(r=>r.TrangThai==='PENDING');
    if(!requests.length){toast('Không có đơn đang chờ để chấp nhận.');return}
    const scope=busyReqSearch.trim()||busyReqFilter!=='ALL'
      ? 'trong danh sách đang lọc/tìm kiếm'
      : 'đang hiển thị';
    if(!confirm(`Chấp nhận tất cả ${requests.length} đơn đang chờ ${scope}? Mỗi đơn sẽ dùng giảng viên được nhờ và được kiểm tra lại RB1–RB6. Đơn không còn đủ điều kiện sẽ không cập nhật lịch.`))return;

    t.disabled=true;
    t.setAttribute('aria-busy','true');
    const approved=[], failed=[];
    for(let i=0;i<requests.length;i++){
      const row=requests[i], id=row.MaYeuCau;
      t.textContent=`Đang duyệt ${i+1}/${requests.length}…`;
      try{
        const detail=await API.adminBusyRequestDetail(id);
        if(detail.TrangThai!=='PENDING')throw new Error('Yêu cầu đã được xử lý trước đó.');
        const nominee=detail.MaGVThayTheDeNghi;
        if(!nominee)throw new Error('Chưa có giảng viên được nhờ coi thay.');

        // Re-check against the live schedule before each approval. The approve API
        // validates the constraints again inside its SQL transaction.
        const result=await API.adminBusyRequestCandidates(id);
        const candidate=(result.candidates||[]).find(c=>String(c.MaGV)===String(nominee));
        if(!candidate)throw new Error('Không tìm thấy giảng viên được nhờ trong danh sách thay thế.');
        if(!candidate.HopLe)throw new Error('Giảng viên được nhờ hiện không còn đủ điều kiện theo RB1–RB6.');

        await API.adminApproveBusyRequest(id, nominee, null);
        approved.push(id);
      }catch(err){
        failed.push({id,message:err.message||'Không thể chấp nhận yêu cầu.'});
      }
    }

    await A['load-busy-requests']();
    refreshAdminBusyCount(true);
    if(approved.length)await bootSQL();

    const failedHtml=failed.length
      ? '<div class="panel" style="margin-top:12px;background:var(--sub)"><b>Các đơn chưa được chấp nhận</b><ul style="margin:8px 0 0;padding-left:20px">'+failed.map(x=>'<li style="margin:6px 0"><b>Đơn #'+esc(x.id)+':</b> '+esc(x.message)+'</li>').join('')+'</ul></div>'
      : '<p class="hint">Tất cả đơn đang chờ trong danh sách đều đã được cập nhật.</p>';
    const approvedHtml=approved.length
      ? '<p><b>Đã chấp nhận '+approved.length+'/'+requests.length+' đơn.</b> Lịch coi thi đã được cập nhật cho các đơn này.</p>'
      : '<p><b>Chưa có đơn nào được chấp nhận.</b> Lịch coi thi không thay đổi.</p>';
    openModal({
      title:'Kết quả chấp nhận hàng loạt',
      wide:true,
      body:approvedHtml+failedHtml,
      foot:'<button class="btn pri" data-act="close">Đóng</button>'
    });
  },
  async 'process-busy-request'(t){
    const id=t.dataset.id;
    openModal({title:`Đang tải yêu cầu #${id}…`,body:'<p class="muted">Đang lấy dữ liệu chi tiết và phân tích ràng buộc giảng viên thay thế…</p>',foot:'<button class="btn" data-act="close">Đóng</button>'});
    try{
      const [detail, candResp]=await Promise.all([
        API.adminBusyRequestDetail(id),
        API.adminBusyRequestCandidates(id)
      ]);
      const cands=candResp.candidates||[];
      const eligibleCands=cands.filter(c=>c.HopLe && String(c.MaGV)===String(detail.MaGVThayTheDeNghi));
      const responseTime=detail.ThoiGianPhanHoiThayThe
        ? String(detail.ThoiGianPhanHoiThayThe).replace('T',' ')
        : '';
      window.__CURRENT_BUSY_DETAIL = detail;
      window.__CURRENT_BUSY_CANDIDATES = cands;

      const candRowsHtml = eligibleCands.map(c => {
        const quotaInfo = `Đã có ${c.DaCo}/${c.DinhMuc} ca`;

        return `<label class="busy-candidate" data-q="${esc((c.HoTen+' '+c.MaGV+' '+c.TenBoMon).toLowerCase())}">
          <input type="radio" name="candRadio" value="${esc(c.MaGV)}" data-name="${esc(c.HoTen)}" data-valid="1" ${String(c.MaGV)===String(detail.MaGVThayTheDeNghi)?'checked':''}>
          <div class="busy-candidate-info">
            <div class="busy-candidate-title">
              <b>${esc(c.HoTen)} (${esc(c.MaGV)})${String(c.MaGV)===String(detail.MaGVThayTheDeNghi)?' <span class="chip warn">Được giảng viên nhờ</span>':''}</b>
              <span class="chip ok">Đủ điều kiện</span>
            </div>
            <div class="muted busy-candidate-meta">${esc(c.TenBoMon)} · ${quotaInfo}</div>
          </div>
        </label>`;
      }).join('') || '<p class="muted">Không có giảng viên nào hiện đủ điều kiện thay thế cho ca này.</p>';

      openModal({
        title: `Xử lý yêu cầu báo bận #${detail.MaYeuCau} - ${esc(detail.HoTen)}`,
        wide: true,
        className: 'busy-request-modal',
        body: `
          <div class="busy-request-layout">
            <div class="busy-request-summary">
              <div class="panel" style="margin-bottom:12px;background:var(--sub)">
                <h4 style="margin-top:0">1. Thông tin báo bận</h4>
                <div><b>Giảng viên:</b> ${esc(detail.HoTen)} (${esc(detail.MaGV)})</div>
                <div><b>Đơn vị:</b> ${esc(detail.TenBoMon)}, ${esc(detail.TenKhoa)}</div>
                <div style="margin-top:6px"><b>Giảng viên được nhờ:</b> ${esc(detail.TenGVThayTheDeNghi||'Chưa có')} ${detail.MaGVThayTheDeNghi?'('+esc(detail.MaGVThayTheDeNghi)+')':''}</div>
                <div style="margin-top:6px"><b>Phản hồi:</b> <span class="chip ${detail.TrangThaiXacNhanThayThe==='ACCEPTED'?'ok':'warn'}">${detail.TrangThaiXacNhanThayThe==='ACCEPTED'?'Đã đồng ý':'Chưa xác nhận'}</span>${responseTime?`<br><small class="muted">Phản hồi lúc: ${esc(responseTime)}</small>`:''}</div>
                <div style="margin-top:6px"><b>Ca thi liên quan:</b> <span class="chip warn">${esc(detail.MaCa||'Chưa gán ca')}</span></div>
                ${detail.NgayThi ? `<div><b>Thời gian ca:</b> ${fmtD(detail.NgayThi)} · ${esc(detail.Buoi||'')} · Tiết ${detail.TuTiet}–${detail.DenTiet} · ${esc(detail.HinhThucThi||'')} (Phòng: ${esc(detail.PhongThi||'—')})</div>` : ''}
                <div style="margin-top:6px"><b>Khoảng thời gian bận:</b><br><small>${esc(detail.ThoiGianBatDauBan ? detail.ThoiGianBatDauBan.replace('T',' ') : '')} → ${esc(detail.ThoiGianKetThucBan ? detail.ThoiGianKetThucBan.replace('T',' ') : '')}</small></div>
                <div style="margin-top:6px"><b>Lý do báo bận:</b><br><b style="color:var(--bad)">${esc(detail.LyDoBaoBan)}</b></div>
                ${detail.GhiChuGV ? `<div style="margin-top:6px"><b>Ghi chú:</b> <i>${esc(detail.GhiChuGV)}</i></div>` : ''}
                <div style="margin-top:6px"><small class="muted">Gửi lúc: ${esc(detail.ThoiGianGui?detail.ThoiGianGui.replace('T',' '):'')}</small></div>
              </div>

              <div class="panel" style="background:var(--sub)">
                <h4 style="margin-top:0">2. Lịch hiện tại của GV</h4>
                <div style="font-size:12.5px">
                  <b>Ca coi thi đã phân công (${(detail.current_schedule||[]).length}):</b>
                  ${(detail.current_schedule||[]).map(s => `<div style="padding:2px 0;border-bottom:1px solid var(--line)">• ${fmtD(s.NgayThi)} (T${s.TuTiet}-${s.DenTiet}) - ${esc(s.MaCa)}${s.MaCa===detail.MaCa?' <span class="chip bad">Báo bận</span>':''}</div>`).join('') || '<div class="muted">Không có ca thi khác</div>'}
                </div>
              </div>
            </div>

            <div class="busy-request-options">
              <h4 style="margin-top:0">3. Xem phương án giảng viên thay thế</h4>
              <p class="sub" style="margin-bottom:8px">Hệ thống đã kiểm tra RB1–RB6 cho ca <b>${esc(detail.MaCa)}</b>. Admin duyệt người được nhờ đã đồng ý để cập nhật lịch.</p>
              
              <div id="candContainer" class="busy-request-candidates">
                ${candRowsHtml}
              </div>

              <label class="f" style="margin-top:10px">
                <span>Ghi chú xử lý của Quản trị viên <small>(không bắt buộc)</small></span>
                <input type="text" id="adminApproveNote" placeholder="Ví dụ: Đã kiểm tra và phân công thay thế theo quy định">
              </label>

              <div class="err" id="busyProcessErr" role="alert" style="margin-top:6px"></div>
            </div>
          </div>
        `,
        foot: `
          <button class="btn danger" data-act="open-reject-busy-modal" data-id="${detail.MaYeuCau}">${IC.x} Từ chối yêu cầu</button>
          <button class="btn" data-act="close">Đóng</button>
          <button class="btn pri" data-act="do-approve-busy" data-id="${detail.MaYeuCau}">${IC.ok} Chấp nhận và cập nhật lịch</button>
        `
      });

    }catch(err){
      toast(err.message);
      closeModal();
    }
  },
  async 'do-approve-busy'(t){
    const id = t.dataset.id;
    const selected = document.querySelector('input[name="candRadio"]:checked');
    const errEl = $('#busyProcessErr');
    if (!selected) {
      if (errEl) errEl.textContent = 'Vui lòng chọn một giảng viên thay thế trước khi duyệt.';
      return;
    }
    const isValid = selected.dataset.valid === '1';
    const gvName = selected.dataset.name;
    const maGV = selected.value;
    const note = $('#adminApproveNote') ? $('#adminApproveNote').value.trim() : '';

    if (!isValid) {
      if (!confirm(`CẢNH BÁO: Giảng viên ${gvName} (${maGV}) đang có ràng buộc vi phạm đã được liệt kê. Hệ thống sẽ kiểm tra nghiêm ngặt khi lưu. Bạn có chắc chắn muốn thử áp dụng phương án này không?`)) {
        return;
      }
    } else {
      if (!confirm(`Xác nhận phân công giảng viên ${gvName} (${maGV}) coi thay ca thi và cập nhật lịch chính thức?`)) {
        return;
      }
    }

    t.disabled = true;
    t.textContent = 'Đang cập nhật lịch…';
    try {
      const res = await API.adminApproveBusyRequest(id, maGV, note || null);
      closeModal();
      toast(res.message || 'Duyệt yêu cầu và cập nhật lịch thành công!');
      A['load-busy-requests']();
      refreshAdminBusyCount(true);
      bootSQL();
    } catch (err) {
      t.disabled = false;
      t.textContent = 'Chấp nhận và cập nhật lịch';
      if (errEl) errEl.textContent = err.message;
      else toast(err.message);
    }
  },
  'open-reject-busy-modal'(t){
    const id = t.dataset.id;
    const detail = window.__CURRENT_BUSY_DETAIL || {MaYeuCau: id};
    openModal({
      title: `Từ chối yêu cầu báo bận #${id}`,
      body: `
        <p class="muted">Nhập lý do từ chối yêu cầu của giảng viên <b>${esc(detail.HoTen||'')}</b> (${esc(detail.MaGV||'')}).</p>
        <p class="hint">Lịch coi thi chính thức hiện tại sẽ được <b>giữ nguyên 100%</b>. Giảng viên sẽ nhận được thông báo kèm lý do từ chối.</p>
        <label class="f">
          <span>Lý do từ chối <b style="color:var(--bad)">*</b></span>
          <textarea id="adminRejectReason" rows="3" required placeholder="Ví dụ: Đợt thi đã sát ngày và không còn giảng viên thay thế phù hợp..."></textarea>
        </label>
        <label class="f" style="margin-top:8px">
          <span>Ghi chú thêm của Admin</span>
          <input type="text" id="adminRejectNote" placeholder="Ghi chú nội bộ...">
        </label>
        <div class="err" id="rejectBusyErr" role="alert"></div>
      `,
      foot: `
        <button class="btn" data-act="process-busy-request" data-id="${id}">Quay lại</button>
        <button class="btn danger" data-act="do-reject-busy" data-id="${id}">Xác nhận từ chối</button>
      `
    });
  },
  async 'do-reject-busy'(t){
    const id = t.dataset.id;
    const reason = $('#adminRejectReason') ? $('#adminRejectReason').value.trim() : '';
    const note = $('#adminRejectNote') ? $('#adminRejectNote').value.trim() : '';
    const errEl = $('#rejectBusyErr');

    if (!reason) {
      if (errEl) errEl.textContent = 'Vui lòng nhập lý do từ chối yêu cầu báo bận.';
      return;
    }

    t.disabled = true;
    t.textContent = 'Đang xử lý…';
    try {
      const res = await API.adminRejectBusyRequest(id, reason, note || null);
      closeModal();
      toast(res.message || 'Đã từ chối yêu cầu báo bận. Lịch được giữ nguyên.');
      A['load-busy-requests']();
      refreshAdminBusyCount(true);
    } catch (err) {
      t.disabled = false;
      t.textContent = 'Xác nhận từ chối';
      if (errEl) errEl.textContent = err.message;
      else toast(err.message);
    }
  },
  async 'view-busy-detail'(t){
    const id = t.dataset.id;
    try {
      const d = await API.adminBusyRequestDetail(id);
      const reqStatusMap = {'PENDING': ['Chờ Admin xử lý', 'warn'], 'APPROVED': ['Đã chấp nhận', 'ok'], 'REJECTED': ['Đã từ chối', 'bad'], 'WITHDRAWN': ['Người gửi đã rút đơn', '']};
      const st = reqStatusMap[d.TrangThai] || [d.TrangThai, ''];
      
      let historyHtml = '';
      if (d.history && d.history.length) {
        historyHtml = `<div class="panel" style="margin-top:12px;background:var(--sub)">
          <b>Lịch sử điều chỉnh phân công coi thi</b>
          ${d.history.map(h => `<div style="font-size:13px;margin-top:6px;padding:6px 0;border-bottom:1px dashed var(--line)">
            <div><b>Hành động:</b> ${esc(h.HanhDong)} · ${esc(h.ThoiDiem)}</div>
            <div><b>Trước thay đổi:</b> ${esc(h.PhanCongTruoc)}</div>
            <div><b>Sau thay đổi:</b> <span style="color:var(--ok);font-weight:600">${esc(h.PhanCongSau)}</span></div>
            <div><b>Người thực hiện:</b> ${esc(h.NguoiThucHien)}</div>
            ${h.LyDo ? `<div><b>Ghi chú:</b> <i>${esc(h.LyDo)}</i></div>` : ''}
          </div>`).join('')}
        </div>`;
      }

      openModal({
        title: `Chi tiết yêu cầu báo bận #${d.MaYeuCau}`,
        wide: true,
        body: `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <small class="muted">Giảng viên báo bận:</small><br>
              <b>${esc(d.HoTen)}</b> (${esc(d.MaGV)})<br>
              <small class="muted">${esc(d.TenBoMon)} · ${esc(d.TenKhoa)}</small>
            </div>
            <div>
              <small class="muted">Trạng thái:</small><br>
              <span class="chip ${st[1]}">${esc(st[0])}</span><br>
              <small class="muted">Gửi lúc: ${esc(d.ThoiGianGui?d.ThoiGianGui.replace('T',' '):'')}</small>
            </div>
          </div>

          <div style="margin-top:12px">
            <small class="muted">Ca thi liên quan:</small><br>
            ${d.MaCa ? `<b>${esc(d.MaCa)}</b> (${fmtD(d.NgayThi)}, Tiết ${d.TuTiet}–${d.DenTiet}, Phòng ${esc(d.PhongThi||'—')})` : '<i>Không gắn ca cụ thể</i>'}
          </div>

          <div style="margin-top:12px"><small class="muted">Giảng viên được nhờ coi thay:</small><br><b>${esc(d.TenGVThayTheDeNghi||'—')}</b>${d.MaGVThayTheDeNghi?' ('+esc(d.MaGVThayTheDeNghi)+')':''}</div>

          <div style="margin-top:12px">
            <small class="muted">Khoảng thời gian bận:</small><br>
            <b>${esc(d.ThoiGianBatDauBan ? d.ThoiGianBatDauBan.replace('T',' ') : '')}</b> đến <b>${esc(d.ThoiGianKetThucBan ? d.ThoiGianKetThucBan.replace('T',' ') : '')}</b>
          </div>

          <div style="margin-top:12px">
            <small class="muted">Lý do báo bận:</small><br>
            <b>${esc(d.LyDoBaoBan)}</b>
          </div>

          ${d.GhiChuGV ? `<div style="margin-top:12px"><small class="muted">Ghi chú của GV:</small><br>${esc(d.GhiChuGV)}</div>` : ''}

          <div style="margin-top:16px;padding:12px;border-radius:8px;background:var(--sub)">
            <b>Kết quả xử lý:</b><br>
            ${d.TrangThai === 'APPROVED' ? `<div style="color:var(--ok);margin-top:6px">
              <b>ĐÃ DUYỆT VÀ CẬP NHẬT LỊCH:</b><br>
              Người duyệt: <b>${esc(d.NguoiXuLy||'Admin')}</b> lúc ${esc(d.ThoiGianXuLy?d.ThoiGianXuLy.replace('T',' '):'')}<br>
              ${d.GhiChuAdmin ? `Ghi chú Admin: <i>${esc(d.GhiChuAdmin)}</i>` : ''}
            </div>` : ''}
            ${d.TrangThai === 'REJECTED' ? `<div style="color:var(--bad);margin-top:6px">
              <b>ĐÃ TỪ CHỐI (LỊCH GIỮ NGUYÊN):</b><br>
              Lý do từ chối: <b style="color:var(--bad)">${esc(d.LyDoTuChoi||'Không nêu')}</b><br>
              Người xử lý: <b>${esc(d.NguoiXuLy||'Admin')}</b> lúc ${esc(d.ThoiGianXuLy?d.ThoiGianXuLy.replace('T',' '):'')}<br>
              ${d.GhiChuAdmin ? `Ghi chú Admin: <i>${esc(d.GhiChuAdmin)}</i>` : ''}
            </div>` : ''}
            ${d.TrangThai === 'WITHDRAWN' ? `<div class="muted" style="margin-top:6px">Người gửi đã rút đơn. Lịch coi thi vẫn giữ nguyên.</div>` : ''}
          </div>

          ${historyHtml}
        `,
        foot: '<button class="btn pri" data-act="close">Đóng</button>'
      });
    } catch(err) {
      toast(err.message);
    }
  },
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
  'pick-dot-lec'(){
    if(!window.__MA_DOT){toast('Chưa có đợt thi. Hãy tạo đợt thi trước.');return}
    dotLecForm();
  },
  async 'save-dot-lec'(){
    const er=$('#ferr'),ids=[...dotPick.sel];
    if(!ids.length){er.textContent='Chọn ít nhất 1 giảng viên tham gia đợt thi.';return}
    try{
      const r=await API.setDotLecturers(window.__MA_DOT,ids);
      closeModal();await refreshLecturers(false);render();
      toast('Đã lưu '+r.tong+' giảng viên tham gia đợt thi (thêm '+r.them+', bỏ '+r.bo+').');
    }catch(e){er.textContent=e.message}
  },
  'edit-lec'(t){lecForm(lec(t.dataset.id))},
  async 'save-lec'(t){
    const n=$('#fn').value.trim(),d=$('#fd').value.trim(),bm=$('#fbm').value,email=$('#femail').value.trim(),q=parseInt($('#fq').value,10),er=$('#ferr');
    if(!n||!d){er.textContent='Nhập đủ họ tên và khoa.';return}
    if(email&&!$('#femail').checkValidity()){er.textContent='Email chưa đúng định dạng.';return}
    if(isNaN(q)||q<0||q>100){er.textContent='Định mức phải là số từ 0 đến 100 (%).';return}
    if(t.disabled)return;
    const saveLabel=t.textContent;
    t.disabled=true;t.setAttribute('aria-busy','true');t.textContent='Đang lưu…';er.textContent='';
    let newAccount=null;
    try{
      const dot=window.__MA_DOT||null;
      if(t.dataset.id){
        const l=lec(t.dataset.id); await API.updateLecturer(l.id,{ho_ten:n,don_vi:'CNTT',ma_bo_mon:bm,email:email||null,ty_le:q,ma_dot:dot}); l.name=n;l.dept=d;l.email=email;l.pct=q;
        toast('Đã cập nhật thông tin giảng viên.');
      }else{
        const r=await API.createLecturer({ho_ten:n,don_vi:'CNTT',ma_bo_mon:bm,email:email||null,ty_le:q,ma_dot:dot});
        S.lecs.push({id:r.ma_gv,name:n,dept:d,email:email,pct:q,quota:0,busy:[],teach:[]});
        newAccount={maGV:r.ma_gv,password:r.initial_password||'1'};
        toast('Đã thêm giảng viên.');
      }
      closeModal();
      if(newAccount)openModal({title:'Đã tạo tài khoản giảng viên',body:'<p>Giảng viên có thể đăng nhập bằng tài khoản bên dưới. Mật khẩu tạm chỉ hiển thị lần này.</p><label class="f"><span>Tài khoản / Mã giảng viên</span><input type="text" readonly value="'+esc(newAccount.maGV)+'" onclick="this.select()"></label><label class="f"><span>Mật khẩu tạm</span><input type="text" readonly value="'+esc(newAccount.password)+'" onclick="this.select()"></label><p class="hint">Giảng viên cần đổi mật khẩu ngay lần đăng nhập đầu tiên. Nếu đóng hộp thoại mà chưa lưu mật khẩu, hãy dùng “Cấp mật khẩu tạm” trong Quản lý tài khoản.</p>',foot:'<button class="btn pri" data-act="close">Đóng</button>'});
      await refreshLecturers(false);render();
    }catch(e){t.disabled=false;t.removeAttribute('aria-busy');t.textContent=saveLabel;er.textContent=e.message}
  },
  async 'del-lec'(t){
    const l=lec(t.dataset.id);if(!l)return;
    if(!confirm('Ngừng hoạt động giảng viên '+l.name+'?'))return;
    try{await API.deleteLecturer(l.id);S.exams.forEach(e=>{e.asg=e.asg.filter(a=>String(a.l)!==String(l.id))});S.lecs=S.lecs.filter(x=>x!==l);render();toast('Đã cập nhật trạng thái giảng viên.')}catch(e){toast(e.message)}
  },
  'quota-all'(){
    const eligible=S.lecs.filter(l=>inDot(l)&&(!F.ld||l.dept===F.ld));
    const scope=F.ld?'các giảng viên đã tham gia thuộc khoa '+esc(F.ld):'các giảng viên đã chọn tham gia đợt '+esc(window.__MA_DOT||'');
    openModal({title:'Đặt định mức chung',body:'<p class="muted" style="margin-bottom:10px">Chỉ cập nhật định mức cho '+scope+' ('+eligible.length+' người). Không thêm giảng viên ngoài danh sách tham gia.</p><label class="f"><span>Định mức (%)</span><input type="number" id="qa" min="0" max="100" value="100"></label>',foot:'<button class="btn" data-act="close">Hủy</button><button class="btn pri" data-act="do-quota-all"'+(eligible.length?'':' disabled')+'>Áp dụng</button>'})
  },
  async 'do-quota-all'(){const q=parseInt($('#qa').value,10);if(isNaN(q)||q<0||q>100)return;try{const dot=window.__MA_DOT;if(!dot){toast('Chưa có đợt thi để lưu định mức.');return}let maKhoa=null;if(F.ld)maKhoa=await API.resolveKhoa(F.ld);const r=await API.setCommonQuota(dot,q,maKhoa);closeModal();await refreshLecturers(false);render();toast('Đã áp dụng '+q+'% cho '+(r.GiangVienCapNhat||0)+' giảng viên tham gia. Tổng định mức: '+r.TongDinhMuc+'/'+r.TongNhuCau+' ca.')}catch(e){toast(e.message)}},
  async 'teaching-schedule'(t){
    const l=lec(t.dataset.id);if(!l)return;
    const fallbackBusy=(l.busy||[]).map(x=>({date:x.date||String(x.key||'').split('|')[0],start:Number(x.start)|| (String(x.key||'').endsWith('|S')?1:7),end:Number(x.end)||(String(x.key||'').endsWith('|S')?6:12),reason:x.reason||null}));
    teachingEdit={id:l.id,items:(l.teach||[]).map(teachingEntry).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start||a.end-b.end),busy:fallbackBusy,savedDuty:[],newDuty:[],error:''};
    try{
      const dot=window.__MA_DOT;
      const [teachData,busyData,dutyData]=await Promise.all([API.teaching(l.id),API.busy(l.id),dot?API.dutyAssignments(dot):Promise.resolve({items:[]})]);
      if(!teachingEdit||String(teachingEdit.id)!==String(l.id))return;
      teachingEdit.items=(teachData.items||[]).map(teachingEntry).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start||a.end-b.end);
      teachingEdit.busy=(busyData.items||[]).map(x=>({date:String(x.NgayBan).slice(0,10),start:Number(x.TuTiet)||1,end:Number(x.DenTiet)||12,reason:x.LyDo||null}));
      teachingEdit.savedDuty=(dutyData.items||[]).filter(x=>String(x.MaGV)===String(l.id));
    }catch(e){if(teachingEdit)teachingEdit.error='\u0141\u1ed7i t\u1ea3i l\u1ecbch hi\u1ec7n c\u00f3: '+(e.message||String(e))}
    renderTeachingEditor();
  },
  'schedule-tab'(t){if(!teachingEdit)return;teachingEdit.tab=t.dataset.tab;renderTeachingEditor()},
  'add-teaching-row'(){
    if(!teachingEdit)return;
    const date=$('#teachDate').value,start=Number($('#teachStart').value),end=Number($('#teachEnd').value),er=$('#teachErr');if(er)er.textContent='';
    if(!date){if(er)er.textContent='H\u00e3y ch\u1ecdn ng\u00e0y d\u1ea1y.';return}
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>12||start>end){if(er)er.textContent='Ti\u1ebft d\u1ea1y ph\u1ea3i n\u1eb1m trong kho\u1ea3ng 1\u201312.';return}
    if(teachingEdit.items.some(x=>x.date===date&&x.start===start&&x.end===end)){if(er)er.textContent='Ca d\u1ea1y n\u00e0y \u0111\u00e3 c\u00f3 trong danh s\u00e1ch.';return}
    teachingEdit.items.push({date,start,end,source:null,note:null});teachingEdit.items.sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start||a.end-b.end);teachingEdit.tab='teaching';renderTeachingEditor();
  },
  'remove-teaching-row'(t){if(!teachingEdit)return;teachingEdit.items.splice(Number(t.dataset.index),1);renderTeachingEditor()},
  'add-manual-busy'(){
    if(!teachingEdit)return;
    const date=$('#manualBusyDate').value,start=Number($('#manualBusyStart').value),end=Number($('#manualBusyEnd').value),reason=$('#manualBusyReason').value||null,er=$('#teachErr');if(er)er.textContent='';
    if(!date){if(er)er.textContent='H\u00e3y ch\u1ecdn ng\u00e0y b\u1eadn.';return}
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>12||start>end){if(er)er.textContent='Ti\u1ebft b\u1eadn ph\u1ea3i n\u1eb1m trong kho\u1ea3ng 1\u201312.';return}
    if(teachingEdit.busy.some(x=>x.date===date&&x.start===start&&x.end===end)){if(er)er.textContent='Kho\u1ea3ng b\u1eadn n\u00e0y \u0111\u00e3 c\u00f3 trong danh s\u00e1ch.';return}
    teachingEdit.busy.push({date,start,end,reason});teachingEdit.busy.sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);teachingEdit.tab='busy';renderTeachingEditor();
  },
  'remove-manual-busy'(t){if(!teachingEdit)return;teachingEdit.busy.splice(Number(t.dataset.index),1);renderTeachingEditor()},
  'add-manual-duty'(){
    if(!teachingEdit)return;
    const l=lec(teachingEdit.id),code=$('#manualDutyCode').value.trim(),course=$('#manualDutyCourse').value.trim(),date=$('#manualDutyDate').value,start=Number($('#manualDutyStart').value),end=Number($('#manualDutyEnd').value),er=$('#teachErr');if(er)er.textContent='';
    if(!window.__MA_DOT){if(er)er.textContent='T\u1ea1o ho\u1eb7c ch\u1ecdn \u0111\u1ee3t thi tr\u01b0\u1edbc khi th\u00eam l\u1ecbch tr\u1ef1c \u0111\u1ec1.';return}
    if(!code||!course||!date){if(er)er.textContent='Nh\u1eadp m\u00e3 h\u1ecdc ph\u1ea7n, m\u00f4n thi v\u00e0 ng\u00e0y thi.';return}
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>16||start>end){if(er)er.textContent='Ti\u1ebft thi ph\u1ea3i n\u1eb1m trong kho\u1ea3ng 1\u201316.';return}
    const duplicate=[...(teachingEdit.savedDuty||[]),...(teachingEdit.newDuty||[])].some(x=>String(x.MaHP||x.ma_hp).toLowerCase()===code.toLowerCase()&&String(x.NgayThi||x.ngay_thi).slice(0,10)===date&&Number(x.TuTiet??x.tu_tiet)===start&&Number(x.DenTiet??x.den_tiet)===end&&String(x.MaGV||x.ma_gv)===String(l.id));
    if(duplicate){if(er)er.textContent='L\u1ecbch tr\u1ef1c \u0111\u1ec1 n\u00e0y \u0111\u00e3 c\u00f3 trong danh s\u00e1ch.';return}
    teachingEdit.newDuty.push({ma_hp:code,mon_thi:course,ngay_thi:date,tu_tiet:start,den_tiet:end,ma_gv:String(l.id),so_dien_thoai:null,ghi_chu:null});teachingEdit.tab='duty';renderTeachingEditor();
  },
  'remove-manual-duty'(t){if(!teachingEdit)return;teachingEdit.newDuty.splice(Number(t.dataset.index),1);renderTeachingEditor()},
  'close-schedule-editor'(){teachingEdit=null;closeModal()},
  async 'save-teaching-schedule'(t){
    if(!teachingEdit)return;
    const edit=teachingEdit,l=lec(edit.id);if(!l)return;
    const items=edit.items.map(x=>({ngay_day:x.date,tu_tiet:x.start,den_tiet:x.end,nguon_file:x.source??null,ghi_chu:x.note??null}));
    const busy=edit.busy.map(x=>({ngay_ban:x.date,tu_tiet:x.start,den_tiet:x.end,ly_do:x.reason||null}));
    const label=t.textContent;t.disabled=true;t.textContent='\u0110ang l\u01b0u\u2026';
    try{
      await API.replaceTeaching(l.id,items);await API.replaceBusy(l.id,busy);
      if(edit.newDuty.length)await API.importDuty(window.__MA_DOT,edit.newDuty,'Nhap truc de thu cong');
      teachingEdit=null;await refreshLecturers(false);closeModal();render();toast('L\u01b0u thay \u0111\u1ed5i l\u1ecbch d\u1ea1y, l\u1ecbch b\u1eadn v\u00e0 tr\u1ef1c \u0111\u1ec1 th\u00e0nh c\u00f4ng.');
    }catch(e){t.disabled=false;t.textContent=label;const er=$('#teachErr');if(er)er.textContent=e.message||'Kh\u00f4ng l\u01b0u \u0111\u01b0\u1ee3c l\u1ecbch.'}
  },
  'clear-schedule'(t){
    const l=lec(t.dataset.id);if(!l)return;
    const hasTeach=!!(l.teach&&l.teach.length),hasBusy=!!(l.busy&&l.busy.length),hasDuty=Number(l.dutyCount)>0;
    const icoBook='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
    const icoBan='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>';
    const cardStyle=(active,enabled)=>'display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:10px;border:2px solid '+(active&&enabled?'var(--bad)':'var(--line)')+';background:'+(active&&enabled?'var(--badbg)':'var(--card)')+';cursor:'+(enabled?'pointer':'not-allowed')+';opacity:'+(enabled?'1':'0.4')+';transition:border-color .15s,background .15s;user-select:none';
    const cardTeach='<label style="'+cardStyle(hasTeach,hasTeach)+'" id="cardTeach">'
      +'<span style="flex:none;width:40px;height:40px;border-radius:9px;background:'+(hasTeach?'var(--badbg)':'var(--sky)')+';color:'+(hasTeach?'var(--bad)':'var(--muted)')+';display:flex;align-items:center;justify-content:center">'+icoBook+'</span>'
      +'<span style="flex:1;min-width:0"><span style="display:block;font-weight:600;font-size:14px">Lịch dạy</span>'
      +'<span style="display:block;font-size:12.5px;color:var(--muted);margin-top:1px">'+(hasTeach?'<b style="color:var(--bad)">'+l.teach.length+' ca dạy</b> sẽ bị xóa':'Chưa có lịch dạy để xóa')+'</span></span>'
      +'<input type="checkbox" id="clrTeach" style="width:18px;height:18px;accent-color:var(--bad);flex:none"'+(hasTeach?' checked':' disabled')+'>'
      +'</label>';
    const cardBusy='<label style="'+cardStyle(hasBusy,hasBusy)+'" id="cardBusy">'
      +'<span style="flex:none;width:40px;height:40px;border-radius:9px;background:'+(hasBusy?'var(--badbg)':'var(--sky)')+';color:'+(hasBusy?'var(--bad)':'var(--muted)')+';display:flex;align-items:center;justify-content:center">'+icoBan+'</span>'
      +'<span style="flex:1;min-width:0"><span style="display:block;font-weight:600;font-size:14px">Lịch bận</span>'
      +'<span style="display:block;font-size:12.5px;color:var(--muted);margin-top:1px">'+(hasBusy?'<b style="color:var(--bad)">'+l.busy.length+' buổi bận</b> sẽ bị xóa':'Chưa có lịch bận để xóa')+'</span></span>'
      +'<input type="checkbox" id="clrBusy" style="width:18px;height:18px;accent-color:var(--bad);flex:none"'+(hasBusy?' checked':' disabled')+'>'
      +'</label>';
    const cardDuty='<label style="'+cardStyle(hasDuty,hasDuty)+'" id="cardDuty">'
      +'<span style="flex:none;width:40px;height:40px;border-radius:9px;background:'+(hasDuty?'var(--badbg)':'var(--sky)')+';color:'+(hasDuty?'var(--bad)':'var(--muted)')+';display:flex;align-items:center;justify-content:center">'+IC.clip+'</span>'
      +'<span style="flex:1;min-width:0"><span style="display:block;font-weight:600;font-size:14px">Lịch trực đề</span>'
      +'<span style="display:block;font-size:12.5px;color:var(--muted);margin-top:1px">'+(hasDuty?'<b style="color:var(--bad)">'+Number(l.dutyCount)+' lượt trực đề</b> sẽ bị xóa':'Chưa có lịch trực đề trong đợt này')+'</span></span>'
      +'<input type="checkbox" id="clrDuty" style="width:18px;height:18px;accent-color:var(--bad);flex:none"'+(hasDuty?' checked':' disabled')+'>'
      +'</label>';
    const warn='<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;background:var(--warnbg);color:var(--warn);font-size:13px;margin-top:14px">'
      +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
      +'<span>Dữ liệu bị xóa <b>không thể khôi phục</b>. Hãy chắc chắn trước khi xác nhận.</span></div>';
    openModal({
      title:'Xóa lịch của '+esc(l.name),
      body:'<p style="color:var(--muted);font-size:13.5px;margin-bottom:14px">Chọn loại lịch cần xóa:</p>'
        +'<div style="display:flex;flex-direction:column;gap:10px">'+cardTeach+cardBusy+cardDuty+'</div>'
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
    const doDuty=$('#clrDuty')&&$('#clrDuty').checked;
    if(!doTeach&&!doBusy&&!doDuty){const er=$('#clrErr');if(er)er.textContent='Vui lòng chọn ít nhất một loại lịch để xóa.';return}
    const dot=window.__MA_DOT;
    if(doDuty&&!dot){const er=$('#clrErr');if(er)er.textContent='Chưa chọn được đợt thi để xóa lịch trực đề.';return}
    const what=[doTeach?'lịch dạy':'',doBusy?'lịch bận':'',doDuty?'lịch trực đề':''].filter(Boolean).join(', ');
    try{
      const errs=[];
      if(doTeach){try{await API.replaceTeaching(l.id,[])}catch(e){errs.push('Lịch dạy: '+e.message)}}
      if(doBusy){try{await API.replaceBusy(l.id,[])}catch(e){errs.push('Lịch bận: '+e.message)}}
      if(doDuty){try{await API.clearLecturerDuty(dot,l.id)}catch(e){errs.push('Lịch trực đề: '+e.message)}}
      await refreshLecturers(false);closeModal();render();
      if(errs.length)toast('Xóa một phần. Lỗi: '+errs.join('; '));
      else toast('Đã xóa '+what+' của '+l.name+'.');
    }catch(e){toast(e.message)}
  },

  'clear-all-teaching'(){
    const total=S.lecs.reduce((n,l)=>n+(l.teach&&l.teach.length?l.teach.length:0),0);
    if(!total){toast('Không có lịch dạy nào để xóa.');return}
    openModal({
      title:'Xóa toàn bộ lịch dạy',
      body:'<p style="margin-bottom:14px">Thao tác này sẽ xóa <b>'+total+' ca dạy</b> của <b>tất cả '+S.lecs.filter(l=>l.teach&&l.teach.length).length+' giảng viên</b>.</p>'
        +'<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;background:var(--badbg);color:var(--bad);font-size:13px">'
        +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        +'<span>Dữ liệu bị xóa <b>không thể khôi phục</b>. Toàn bộ lịch dạy của mọi giảng viên sẽ bị xóa vĩnh viễn.</span></div>'
        +'<div class="err" id="clearAllTeachErr" style="margin-top:10px"></div>',
      foot:'<button class="btn" data-act="close">Hủy</button>'
        +'<button style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:0;border-radius:8px;background:var(--bad);color:#fff;font-weight:600;font-size:14px;cursor:pointer" data-act="do-clear-all-teaching">'
        +'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'
        +'Xóa toàn bộ lịch dạy</button>'
    });
  },
  async 'do-clear-all-teaching'(){
    try{
      const r=await API.clearAllTeaching();
      await refreshLecturers(false);closeModal();render();
      toast('Đã xóa '+r.deleted+' ca dạy.');
    }catch(e){const er=$('#clearAllTeachErr');if(er)er.textContent=e.message||'Không xóa được lịch dạy.'}
  },
  'clear-all-busy'(){
    const total=S.lecs.reduce((n,l)=>n+(l.busy&&l.busy.length?l.busy.length:0),0);
    if(!total){toast('Không có lịch bận nào để xóa.');return}
    openModal({
      title:'Xóa toàn bộ lịch bận',
      body:'<p style="margin-bottom:14px">Thao tác này sẽ xóa <b>'+total+' buổi bận</b> của <b>tất cả '+S.lecs.filter(l=>l.busy&&l.busy.length).length+' giảng viên</b>.</p>'
        +'<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;background:var(--warnbg);color:var(--warn);font-size:13px">'
        +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        +'<span>Dữ liệu bị xóa <b>không thể khôi phục</b>. Toàn bộ lịch bận của mọi giảng viên sẽ bị xóa vĩnh viễn.</span></div>'
        +'<div class="err" id="clearAllBusyErr" style="margin-top:10px"></div>',
      foot:'<button class="btn" data-act="close">Hủy</button>'
        +'<button style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:0;border-radius:8px;background:var(--bad);color:#fff;font-weight:600;font-size:14px;cursor:pointer" data-act="do-clear-all-busy">'
        +'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'
        +'Xóa toàn bộ lịch bận</button>'
    });
  },
  async 'do-clear-all-busy'(){
    try{
      const r=await API.clearAllBusy();
      await refreshLecturers(false);closeModal();render();
      toast('Đã xóa '+r.deleted+' buổi bận.');
    }catch(e){const er=$('#clearAllBusyErr');if(er)er.textContent=e.message||'Không xóa được lịch bận.'}
  },

  async 'clear-all-duty'(){
    const dot=window.__MA_DOT;
    if(!dot){toast('Chưa có đợt thi hiện tại để xóa lịch trực đề.');return}
    const total=S.lecs.reduce((n,l)=>n+(Number(l.dutyCount)||0),0);
    if(!total){toast('Đợt thi hiện tại không có lịch trực đề nào để xóa.');return}
    if(!confirm('Xóa toàn bộ '+total+' lượt trực đề của đợt '+dot+'? Lịch của các đợt khác sẽ được giữ nguyên.'))return;
    try{
      const r=await API.clearAllDuty(dot);
      await refreshLecturers(false);render();
      toast('Đã xóa '+r.deleted+' lượt trực đề của đợt '+dot+'.');
    }catch(e){toast(e.message||'Không xóa được lịch trực đề.')}
  },

  'pick-busy-file'(){$('#fileBusy').click()},
  'pick-duty-file'(){const i=document.createElement('input');i.type='file';i.accept='.xlsx,.xls';i.dataset.chg='duty-file';i.hidden=true;document.body.appendChild(i);i.click()},
  async 'apply-duty'(){
    if(!pendDuty||!pendDuty.rows.length||!pendDuty.ma_dot){toast('Chưa có lượt trực hợp lệ hoặc chưa chọn được đợt thi.');return}
    try{
      const result=await API.importDuty(pendDuty.ma_dot,pendDuty.rows,pendDuty.name);
      const added=Number(result.inserted)||0,updated=Number(result.updated)||0,dot=pendDuty.ma_dot;pendDuty=null;closeModal();
      let saved=[];try{const data=await API.dutyAssignments(dot);saved=data.items||[]}catch(e){}
      const dutyCounts=new Map();saved.forEach(x=>dutyCounts.set(String(x.MaGV),(dutyCounts.get(String(x.MaGV))||0)+1));
      S.lecs.forEach(l=>{l.dutyCount=dutyCounts.get(String(l.id))||0});save();render();
      const rows=saved.slice(0,50).map(x=>'<tr><td>'+esc(fmtD(String(x.NgayThi).slice(0,10)))+'</td><td>'+esc(x.TuTiet+' → '+x.DenTiet)+'</td><td><b>'+esc(x.MaHP)+'</b><small style="display:block;color:var(--muted)">'+esc(x.MonThi)+'</small></td><td>'+esc(x.HoTen)+' <small class="muted">'+esc(x.MaGV)+'</small></td></tr>').join('');
      openModal({title:'Đã lưu lịch trực đề',wide:true,body:'<div style="padding:12px 14px;margin-bottom:14px;border-radius:9px;background:var(--okbg);color:var(--ok)">Đã lưu '+added+' lượt mới và cập nhật '+updated+' lượt trong đợt '+esc(dot)+'.</div>'+(saved.length?'<div class="tools"><span class="chip">'+saved.length+' lượt đang lưu trong đợt</span></div><div class="tw" style="max-height:48vh;overflow:auto"><table><thead><tr><th>Ngày thi</th><th>Tiết</th><th>Mã HP / Môn thi</th><th>Giảng viên</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+(saved.length>50?'<p class="hint">Đang hiển thị 50 lượt đầu.</p>':''):'<p class="hint">Dữ liệu đã được gửi tới database. Không tải lại được danh sách vừa lưu.</p>'),foot:'<button class="btn pri" data-act="close">Hoàn tất</button>'});
    }catch(e){toast(e.message||'Không lưu được lịch trực đề vào database.')}
  },
  'cancel-duty'(){pendDuty=null;closeModal()},
  async 'apply-busy'(){
    if(!pendBusy)return;
    try{
      const r=await API.importBusy(pendBusy.rows,pendBusy.name);
      await refreshLecturers(false);
      const n=pendBusy.rows.length;pendBusy=null;render();
      toast('Đã nhập '+n+' dòng lịch bận cho '+r.teachers+' giảng viên.');
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
      const r=await API.importTeaching(pendTeach.rows.map(x=>({name:x.name,date:x.date,start:x.start,end:x.end,room:x.room,line:x.line})),pendTeach.name);
      await refreshLecturers(false);
      const n=pendTeach.rows.length;pendTeach=null;render();toast('Đã nhập '+n+' ca lịch dạy cho '+r.teachers+' giảng viên.');
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
      const examKind=slot.end-slot.start+1===2?'TN':kind;
      const payload={ma_dot:old?old.ma_dot:null,hoc_ky:hk,nam_hoc:yh,ngay_thi:date,tu_tiet:slot.start,den_tiet:slot.end,hinh_thuc_thi:examKind==='TL'?'Tự luận':'Trắc nghiệm',so_gv_can_cap:need};
      if(old) await API.updateExam(old.ma_ca,payload); else await API.createExam(payload);
      closeModal();await refreshExamData(false);render();toast((old?'Đã cập nhật':'Đã lưu')+' ca thi.');
    }catch(e){er.textContent=e.message}
  },
  'clear-all-exams'(){
    if(!S.exams.length){toast('Không có ca thi nào để xóa.');return}
    const total=S.exams.length, asg=S.exams.reduce((n,e)=>n+(e.asg?e.asg.length:0),0);
    openModal({
      title:'Xóa toàn bộ ca thi',
      body:'<p style="margin-bottom:14px">Thao tác này sẽ xóa <b>'+total+' ca thi</b>'+(asg?' và <b>'+asg+' lượt phân công</b> liên quan':'')+'.</p>'
        +'<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;background:var(--badbg);color:var(--bad);font-size:13px">'
        +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        +'<span>Dữ liệu bị xóa <b>không thể khôi phục</b>. Toàn bộ ca thi, phân công, đơn báo bận, đơn đổi ca, thông báo và lịch sử xử lý liên quan sẽ bị xóa.</span></div>'
        +'<div class="err" id="clearAllExamsErr" style="margin-top:10px"></div>',
      foot:'<button class="btn" data-act="close">Hủy</button>'
        +'<button style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:0;border-radius:8px;background:var(--bad);color:#fff;font-weight:600;font-size:14px;cursor:pointer" data-act="do-clear-all-exams">'
        +'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'
        +'Xóa toàn bộ ca thi</button>'
    });
  },
  async 'do-clear-all-exams'(){
    try{
      const r=await API.clearAllExams();
      await refreshExamData(false);closeModal();render();
      toast('Đã xóa '+r.deleted+' ca thi.');
    }catch(e){const er=$('#clearAllExamsErr');if(er)er.textContent=e.message||'Không xóa được ca thi.'}
  },
  async 'del-exam'(t){const e=exm(+t.dataset.id);if(!e)return;if(!confirm('Xóa ca thi này? Phân công, yêu cầu đổi ca và lịch sử đổi ca liên quan cũng sẽ bị xóa. Yêu cầu báo bận được giữ lại nhưng bỏ liên kết với ca này.'))return;try{await API.deleteExam(e.ma_ca);await refreshExamData(false);toast('Đã xóa ca thi.')}catch(x){toast(x.message)}},
  'edit-exam'(t){examForm(exm(+t.dataset.id))},
  async 'do-import-exam'(){
    if(!pend||!pend.rows.length)return;
    try{
      const hk=((S.dots||[])[0]||{}).HocKy||'HK1',yh=((S.dots||[])[0]||{}).NamHoc||((new Date().getFullYear())+'-'+(new Date().getFullYear()+1));
for(const r of pend.rows){const s=parsePeriod(r.period);const duration=s.end-s.start+1;const kind=duration===2?'TN':(r.kind==='TN'?'TN':'TL');await API.createExam({hoc_ky:hk,nam_hoc:yh,ngay_thi:r.date,tu_tiet:s.start,den_tiet:s.end,hinh_thuc_thi:kind==='TN'?'Trắc nghiệm':'Tự luận',so_gv_can_cap:r.need})}
      pend=null;await refreshExamData(false);render();toast('Đã nhập toàn bộ ca thi.');
    }catch(e){toast(e.message)}
  },
  'cancel-import-exam'(){pend=null;render()},
  async 'reset-soft'(){
    const previous=S.soft;
    S.soft=softStateFromConfig({});S.softV=3;save();render();
    try{
      if(window.__MA_DOT){const result=await API.saveSoftRuleConfig(window.__MA_DOT,softRuleFlags());S.soft=softStateFromConfig(result.rules||{});save()}
      toast('Đã khôi phục cấu hình mặc định cho đợt thi đang chọn.');
    }catch(e){S.soft=previous;save();render();toast('Không lưu được cấu hình vào database: '+e.message)}
  },
  precheck(){doPre();render()},
  'schedule-time'(t){
    const value=Number(t.dataset.seconds);if(![30,120,300].includes(value))return;
    S.scheduleTimeLimit=value;save();
    document.querySelectorAll('.sched-time-option').forEach(button=>{
      const active=Number(button.dataset.seconds)===value;
      button.classList.toggle('active',active);
      button.setAttribute('aria-checked',String(active));
    });
  },
  async auto(){await runAuto()},
  async 'force-run'(){await autoRun()},
  pick(t){pick={ex:+t.dataset.ex,q:''};const e=exm(pick.ex);openModal({title:'Chọn giảng viên · '+(e.period||SES[e.ses])+', '+fmtD(e.date),wide:true,body:'<p class="muted">'+LB[e.kind]+' · cần '+e.need+' giảng viên</p><div class="tools" style="margin-top:10px"><div class="grow"><input type="text" data-inp="pick-q" placeholder="Tìm giảng viên" aria-label="Tìm giảng viên"></div><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="lockNew" checked>Khóa phân công này</label></div><div class="pl" id="pickList">'+pickList()+'</div>'})},
  'pick-ok'(t){
    const e=exm(pick.ex),lid=t.dataset.l;if(e.asg.length>=e.need){toast('Ca thi đã đủ giảng viên cần phân công.');return}const issues=hardIssues(e,lid);if(issues.length){toast('Không thể phân công: '+issues.join(', '));return}const lock=$('#lockNew').checked;e.asg.push({l:lid,lock:lock});S.scheduleDraftDirty=true;save();closeModal();render();
  },
  async 'publish-assignments'(){
    const failures=hardConstraintFailures();
    if(failures.length){toast('Chưa lưu được: còn vi phạm ràng buộc cứng — '+failures.map(x=>x.name+' '+x.pct+'%').join(', ')+'. Hãy xếp lại hoặc sửa phân công trước.');return}
    try{await persistAssignments();S.schedulePublished=true;S.scheduleDraftDirty=false;S.exams.forEach(e=>e.so_da_cap=e.asg.length);save();render();toast('Đã lưu thành công, giảng viên có thể xem lịch.')}catch(e){toast('Không lưu được phân công: '+(e.message||e))}
  },
  async 'unpublish-assignments'(){
    const maDot=S.exams.find(e=>e.ma_dot)?.ma_dot||window.__MA_DOT;
    if(!maDot){toast('Chưa xác định được đợt thi cần gỡ lịch.');return}
    if(!confirm('Thu hồi lịch đã công bố của đợt '+maDot+' khỏi lịch giảng viên? Bản phân công trên bảng admin sẽ được giữ lại làm nháp.'))return;
    try{
      const result=await API.removeSavedAssignments(maDot);
      // Chỉ gỡ bản công bố trên máy chủ; giữ nguyên phân công và khóa trên bảng admin.
      S.exams.forEach(e=>{e.so_da_cap=0});
      S.schedulePublished=false;S.scheduleDraftDirty=S.exams.some(e=>e.asg.length>0);
      save();render();
      const deleted=Number(result.assignments_deleted)||0;
      toast(deleted
        ?'Đã thu hồi '+deleted+' phân công khỏi lịch giảng viên. Bản xếp lịch vẫn được giữ trên bảng admin.'
        :'Đợt '+maDot+' không có phân công đã công bố. Nếu lịch vẫn hiện, ca đó có thể thuộc đợt khác.');
    }catch(e){toast('Không gỡ được lịch đã lưu: '+(e.message||e))}
  },
  async 'toggle-schedule-sharing'(){
    if(scheduleSharingEnabled===null){toast('Chưa đọc được trạng thái chia sẻ lịch.');return}
    try{
      const result=await API.setScheduleSharing(!scheduleSharingEnabled);
      scheduleSharingEnabled=!!result.enabled;scheduleSharingError='';updateScheduleSharingControls();
      toast(scheduleSharingEnabled?'Đã cho phép giảng viên xem lịch của nhau.':'Đã tắt quyền xem lịch của nhau.');
    }catch(e){toast('Không cập nhật được quyền xem lịch: '+e.message)}
  },
  'refresh-schedule-sharing'(){loadScheduleSharingStatus(true)},
  lock(t){const e=exm(+t.dataset.ex),a=e.asg.find(x=>String(x.l)===String(t.dataset.l));a.lock=!a.lock;S.scheduleDraftDirty=true;save();render()},
  unasg(t){const e=exm(+t.dataset.ex);e.asg=e.asg.filter(x=>String(x.l)!==String(t.dataset.l));S.scheduleDraftDirty=true;save();render()},
  'clear-unlocked'(){let n=0;S.exams.forEach(e=>{const k=e.asg.filter(a=>a.lock);n+=e.asg.length-k.length;e.asg=k});if(n){S.scheduleDraftDirty=true;save()}render();toast('Đã xóa '+n+' phân công chưa khóa khỏi bảng nháp. Lịch đã công bố chỉ bị gỡ khi dùng “Thu hồi lịch đã công bố”.')},
  'save-hist'(){snapshot('Thủ công');render();toast('Đã lưu bản này vào lịch sử.')},
  tab6(t){tab6=t.dataset.t;render()},
  xmode(t){F.xm=t.dataset.m;render()},
  async xlsx(){
    if(typeof XLSX==='undefined'){toast('Chưa tải được thư viện Excel. Kiểm tra kết nối mạng rồi thử lại.');return}
    const wb=XLSX.utils.book_new(),names={lec:'Theo giảng viên',ses:'Theo ca thi'};let n=0;
    if(S.exams.length){let dutyRows=[];const maDot=window.__MA_DOT;if(maDot){try{const result=await API.dutyAssignments(maDot);dutyRows=Array.isArray(result.items)?result.items:[]}catch(e){console.warn('Không tải được lịch trực đề cho file Excel:',e)}}XLSX.utils.book_append_sheet(wb,assignmentMatrix(dutyRows),'Phân công coi thi');n++}
    ['lec','ses'].forEach(m=>{
      const d=exportData(m);if(!d.rows.length)return;
      const ws=XLSX.utils.aoa_to_sheet([d.head].concat(d.rows));
      ws['!cols']=d.head.map((h,i)=>({wch:Math.min(40,Math.max(String(h).length,...d.rows.map(r=>String(r[i]==null?'':r[i]).length))+2)}));
      XLSX.utils.book_append_sheet(wb,ws,names[m]);n++;
    });
    if(!n){toast('Chưa có dữ liệu để xuất.');return}
    const report=analyze(),s1=report.S1,rb8=report.RB8,score=S.solverPenaltyReport,scoreS1=score?.details?.S1,scoreRB8=score?.details?.RB8,
      rb8Enabled=score?score.penalties?.RB8!=null:rb8.enabled,
      rb8Violations=scoreRB8?.violating_lecturer_days??rb8.violations,
      rb8Penalty=score?score.penalties?.RB8:rb8.penalty,
      s1Enabled=score?score.penalties?.S1!=null:s1.enabled,
      s1Days=scoreS1?.lecturer_days??s1.lecturerDays,
      s1Singletons=scoreS1?.singleton_exam_days??s1.singletonDays,
      s1Penalty=score?score.penalties?.S1:s1.penalty,
      s1Rows=[
      ['Tránh ca tối khi lịch trong ngày đã dày (RB8)',rb8Enabled?'Đang bật':'Đang tắt'],
      ['Số ngày vi phạm RB8',rb8Violations],
      ['Điểm phạt mỗi ngày vi phạm RB8',SOFT_POINTS.RB8],
      ['Điểm phạt RB8',rb8Penalty??'—'],
      ['', ''],
      ['Chỉ số giảm ngày tới trường, tránh ngày chỉ có một ca thi','Giá trị'],
      ['Giảm ngày tới trường, tránh ngày chỉ có một ca thi (S1)',s1Enabled?'Đang bật':'Đang tắt'],
      ['Tổng giảng viên-ngày lên trường',s1Days],
      ['Ngày chỉ có 1 ca coi thi, không lịch dạy/trực đề',s1Singletons],
      ['Điểm mỗi ngày lên trường',SOFT_POINTS.S1.perDay],
      ['Điểm phạt thêm cho ngày chỉ có 1 ca coi thi',SOFT_POINTS.S1.singletonExtra],
      ['Điểm phạt S1',s1Penalty??'—'],
      ['Tỷ lệ cải thiện so với mỗi ca ở ngày riêng',s1.pct==null?'—':s1.pct+'%']
    ];
    const s1Ws=XLSX.utils.aoa_to_sheet(s1Rows);
    s1Ws['!cols']=[{wch:44},{wch:24}];
    XLSX.utils.book_append_sheet(wb,s1Ws,'Ngày tới trường và ca tối');n++;
    if(S.solverPenaltyReport){
      const p=S.solverPenaltyReport,scoreRows=[
        ['Ràng buộc mềm','Đơn vị tính phạt','Điểm mỗi đơn vị','Tổng điểm phạt'],
        ...SOFT.map(rule=>[
          rule.name,
          p.violations?.[rule.id]??'Đã tắt',
          p.weights?.[rule.id]??0,
          p.penalties?.[rule.id]??'—'
        ]),
        ['Tổng điểm phạt','','',p.total??'—']
      ];
      const scoreWs=XLSX.utils.aoa_to_sheet(scoreRows);
      scoreWs['!cols']=[{wch:48},{wch:22},{wch:22},{wch:22}];
      XLSX.utils.book_append_sheet(wb,scoreWs,'Điểm phạt CP-SAT');n++;
    }
    const t=new Date(),pad=x=>String(x).padStart(2,'0');
    XLSX.writeFile(wb,'lich-gac-thi-'+t.getFullYear()+pad(t.getMonth()+1)+pad(t.getDate())+'.xlsx');
    toast('Đã tải file Excel gồm '+n+' trang, có bảng ma trận và thông tin các tiêu chí ngày tới trường, ca tối.');
  },
  copy(){const d=exportData(F.xm);copyText([d.head].concat(d.rows).map(r=>r.join('\t')).join('\n'))},
  restore(t){
    const h=S.hist.find(x=>x.id===+t.dataset.id);if(!h)return;
    h.snap.forEach(p=>{const e=exm(p[0]);if(e)e.asg=p[1].filter(x=>lec(x[0])).map(x=>({l:x[0],lock:!!x[1]}))});
    S.scheduleDraftDirty=true;save();view='sched';render();toast('Đã khôi phục bản xếp lúc '+h.time+' vào bảng nháp.');
  },
  'del-hist'(t){S.hist=S.hist.filter(x=>x.id!==+t.dataset.id);render()}
};
let modalBackdropMouseDown=null;
document.addEventListener('mousedown',e=>{const target=e.target.closest&&e.target.closest('.ov[data-act="ovclose"]');modalBackdropMouseDown=target===e.target?target:null},true);
document.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(!t)return;const f=A[t.dataset.act];if(f)f(t,e)});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('#modal').innerHTML)closeModal();
  if(e.key==='Enter'&&!cur&&(e.target.id==='lu'||e.target.id==='lp'))A.login();
});

