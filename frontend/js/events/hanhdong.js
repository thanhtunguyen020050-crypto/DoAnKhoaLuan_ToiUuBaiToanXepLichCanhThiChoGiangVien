/* ========= Hành động (click) ========= */
function renderTeachingEditor(){
  const l=teachingEdit&&lec(teachingEdit.id);if(!l)return;
  const items=teachingEdit.items||[];
  const rows=items.length?items.map((x,i)=>'<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:var(--card)"><div style="flex:1;min-width:0"><b>'+esc(fmtD(x.date))+' · tiết '+x.start+'–'+x.end+'</b>'+(x.source?'<small style="display:block;color:var(--muted);margin-top:3px">Nguồn: '+esc(x.source)+'</small>':'')+(x.note?'<small style="display:block;color:var(--muted);margin-top:3px">'+esc(x.note)+'</small>':'')+'</div><button type="button" class="btn sm ghost danger icon-delete" data-act="remove-teaching-row" data-index="'+i+'" title="Xóa ca dạy này" aria-label="Xóa ca dạy này">'+IC.trash+'</button></div>').join(''):'<p class="muted" style="padding:12px 0">Chưa có ca dạy. Thêm ngày và khoảng tiết ở bên dưới.</p>';
  openModal({title:(items.length?'Cập nhật':'Thêm')+' lịch dạy · '+l.name,wide:true,body:'<p class="muted" style="margin-bottom:12px">Khai báo ngày và khoảng tiết giảng viên đứng lớp. Các ca này được dùng để tránh phân công coi thi trùng giờ.</p><div style="display:grid;gap:8px;margin-bottom:12px">'+rows+'</div><div class="panel" style="margin:12px 0;padding:14px"><b>Thêm ca dạy</b><div style="display:grid;grid-template-columns:1.3fr 1fr 1fr auto;gap:10px;align-items:end;margin-top:10px"><label class="f" style="margin:0"><span>Ngày dạy</span><input type="date" id="teachDate" required></label><label class="f" style="margin:0"><span>Tiết bắt đầu</span><input type="number" id="teachStart" min="1" max="12" value="1" required></label><label class="f" style="margin:0"><span>Tiết kết thúc</span><input type="number" id="teachEnd" min="1" max="12" value="2" required></label><button type="button" class="btn" data-act="add-teaching-row">Thêm ca</button></div><p class="hint" style="margin:8px 0 0">Tiết hợp lệ từ 1 đến 12. Lịch dạy đã import sẽ được giữ lại khi lưu.</p><div class="err" id="teachErr" role="alert"></div></div>',foot:'<button class="btn" data-act="close">Hủy</button><button class="btn pri" data-act="save-teaching-schedule" data-id="'+esc(l.id)+'">Lưu lịch dạy</button>'});
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
  ovclose(t,e){if(e.target===t)closeModal()},
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
  'teaching-schedule'(t){
    const l=lec(t.dataset.id);if(!l)return;
    teachingEdit={id:l.id,items:(l.teach||[]).map(teachingEntry).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start||a.end-b.end)};
    renderTeachingEditor();
  },
  'add-teaching-row'(){
    if(!teachingEdit)return;
    const date=$('#teachDate').value,start=Number($('#teachStart').value),end=Number($('#teachEnd').value),er=$('#teachErr');
    er.textContent='';
    if(!date){er.textContent='Hãy chọn ngày dạy.';return}
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>12||start>end){er.textContent='Tiết bắt đầu và kết thúc phải nằm trong khoảng 1–12, và tiết bắt đầu không sau tiết kết thúc.';return}
    if(teachingEdit.items.some(x=>x.date===date&&x.start===start&&x.end===end)){er.textContent='Lịch dạy này đã có trong danh sách.';return}
    teachingEdit.items.push({date,start,end,source:null,note:null});
    teachingEdit.items.sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start||a.end-b.end);
    renderTeachingEditor();
  },
  'remove-teaching-row'(t){
    if(!teachingEdit)return;
    teachingEdit.items.splice(Number(t.dataset.index),1);
    renderTeachingEditor();
  },
  async 'save-teaching-schedule'(t){
    if(!teachingEdit)return;
    const l=lec(teachingEdit.id);if(!l)return;
    const items=teachingEdit.items.map(x=>({ngay_day:x.date,tu_tiet:x.start,den_tiet:x.end,nguon_file:x.source??null,ghi_chu:x.note??null}));
    const label=t.textContent;t.disabled=true;t.textContent='Đang lưu…';
    try{
      await API.replaceTeaching(l.id,items);
      teachingEdit=null;await refreshLecturers(false);closeModal();render();toast('Đã lưu lịch dạy. Lịch bận không thay đổi.');
    }catch(e){t.disabled=false;t.textContent=label;const er=$('#teachErr');if(er)er.textContent=e.message}
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
      +'<span style="display:block;font-size:12.5px;color:var(--muted);margin-top:1px">'+(hasTeach?'<b style="color:var(--bad)">'+l.teach.length+' ca dạy</b> sẽ bị xóa':'Chưa có lịch dạy để xóa')+'</span></span>'
      +'<input type="checkbox" id="clrTeach" style="width:18px;height:18px;accent-color:var(--bad);flex:none"'+(hasTeach?' checked':' disabled')+'>'
      +'</label>';
    const cardBusy='<label style="'+cardStyle(hasBusy,hasBusy)+'" id="cardBusy">'
      +'<span style="flex:none;width:40px;height:40px;border-radius:9px;background:'+(hasBusy?'var(--badbg)':'var(--sky)')+';color:'+(hasBusy?'var(--bad)':'var(--muted)')+';display:flex;align-items:center;justify-content:center">'+icoBan+'</span>'
      +'<span style="flex:1;min-width:0"><span style="display:block;font-weight:600;font-size:14px">Lịch bận</span>'
      +'<span style="display:block;font-size:12.5px;color:var(--muted);margin-top:1px">'+(hasBusy?'<b style="color:var(--bad)">'+l.busy.length+' buổi bận</b> sẽ bị xóa':'Chưa có lịch bận để xóa')+'</span></span>'
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

  'pick-busy-file'(){$('#fileBusy').click()},
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
      const r=await API.importTeaching(pendTeach.rows.map(x=>({name:x.name,date:x.date,start:x.start,end:x.end,line:x.line})),pendTeach.name);
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
      const payload={ma_dot:old?old.ma_dot:null,hoc_ky:hk,nam_hoc:yh,ngay_thi:date,tu_tiet:slot.start,den_tiet:slot.end,hinh_thuc_thi:kind==='TL'?'Tự luận':'Lý thuyết',so_gv_can_cap:need};
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
        +'<span>Dữ liệu bị xóa <b>không thể khôi phục</b>. Toàn bộ ca thi, phân công, yêu cầu đổi ca và lịch sử đổi ca liên quan sẽ bị xóa. Yêu cầu báo bận vẫn được giữ nhưng không còn gắn với ca đã xóa.</span></div>'
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
      for(const r of pend.rows){const s=parsePeriod(r.period);await API.createExam({hoc_ky:hk,nam_hoc:yh,ngay_thi:r.date,tu_tiet:s.start,den_tiet:s.end,hinh_thuc_thi:r.kind==='TL'?'Tự luận':'Lý thuyết',so_gv_can_cap:r.need})}
      pend=null;await refreshExamData(false);render();toast('Đã nhập toàn bộ ca thi.');
    }catch(e){toast(e.message)}
  },
  'cancel-import-exam'(){pend=null;render()},
  'reset-soft'(){S.soft={S1:{on:true,w:6},S2:{on:true,w:8,n:80}};render();toast('Đã khôi phục cấu hình mặc định.')},
  precheck(){doPre();render()},
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
    S.scheduleDraftDirty=true;save();view='sched';render();toast('Đã khôi phục bản xếp lúc '+h.time+' vào bảng nháp.');
  },
  'del-hist'(t){S.hist=S.hist.filter(x=>x.id!==+t.dataset.id);render()}
};
document.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(!t)return;const f=A[t.dataset.act];if(f)f(t,e)});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('#modal').innerHTML)closeModal();
  if(e.key==='Enter'&&!cur&&(e.target.id==='lu'||e.target.id==='lp'))A.login();
});

