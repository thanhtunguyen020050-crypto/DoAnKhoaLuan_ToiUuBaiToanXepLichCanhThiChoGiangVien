(() => {
  const $ = s => document.querySelector(s);
  const base = window.API_BASE_URL || 'http://127.0.0.1:8000/api';
  const state = {user:null, page:'schedule', busyRequests:[], swaps:[], schedule:[], lecturers:[], notices:[]};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const logoSrc = (() => {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null')?.logo || LOGO; }
    catch { return LOGO; }
  })();
  const logoMark = size => `<div class="logo-wrap"><img src="${esc(logoSrc)}" alt="Logo Trường Đại học Công Thương" style="width:${size}px;height:${size}px;object-fit:contain"></div>`;
  
  async function req(path, opts={}) {
    const token = sessionStorage.getItem('authToken');
    const headers = {'Content-Type':'application/json', ...(opts.headers || {})};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const r = await fetch(base+path,{...opts, headers});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) {
      const msg = typeof d.detail==='string'?d.detail:(d.detail?.message||((d.detail?.violations||[]).join('\n'))||'Yêu cầu không thành công ('+r.status+').');
      throw new Error(msg);
    }
    return d;
  }

  const fmt = d => d ? new Date(d+'T00:00:00').toLocaleDateString('vi-VN') : '';
  const slot = (date,a,b) => `${fmt(date)} · tiết ${a}–${b}`;
  const todayLabel = () => new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
  
  function toast(m){let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',3500)}
  const initialsOf=n=>String(n||'GV').trim().split(/\s+/).slice(-2).map(w=>w[0]).join('').toUpperCase();
  
  function openUserModal(o) {
    const m = $('#modal');
    if (!m) return;
    m.innerHTML = '<div class="ov" id="userOvClose"><div class="md '+(o.wide?'wide':'')+'" role="dialog" aria-modal="true" aria-label="'+esc(o.title)+'"><header><h3>'+esc(o.title)+'</h3><button class="x" id="userModalClose" aria-label="Đóng">'+IC.x+'</button></header><div class="bd">'+o.body+'</div>'+(o.foot?'<footer>'+o.foot+'</footer>':'')+'</div></div>';
    $('#userModalClose').onclick = closeUserModal;
    $('#userOvClose').onclick = e => { if (e.target.id === 'userOvClose') closeUserModal(); };
  }
  function closeUserModal() {
    const m = $('#modal');
    if (m) m.innerHTML = '';
  }

  async function refreshBell(){
    try{
      const r=await req('/user/notifications/'+encodeURIComponent(state.user.ma_gv));
      const n=(r.items||[]).filter(x=>!x.DaDoc).length;
      state.unread=n;
      [['#bellDot',n>9?'9+':n],['#navDot',n]].forEach(([q,v])=>{const e=$(q);if(e){e.textContent=v;e.hidden=!n}});
    }catch(e){}
  }

  function topbar(){
    return `<header class="topbar"><div class="tb-brand">${logoMark(38)}<div><div class="uni">Trường Đại học Công Thương TP.HCM</div><h1>Hệ thống xếp lịch gác thi</h1><div class="sub">Khoa Công nghệ Thông tin · Cổng giảng viên</div></div></div><div class="tb-r"><span class="pillbox">${IC.cal}<span class="hide-sm">${todayLabel()}</span></span><button class="ibtn" id="notifications" title="Thông báo" aria-label="Thông báo">${IC.bell}<span class="dot" id="bellDot" hidden></span></button><div class="tb-user"><div class="tb-av">${esc(initialsOf(state.user.ho_ten))}</div><div><b>${esc(state.user.ho_ten)}</b><span>Giảng viên</span></div><button class="ibtn" id="changePassword" title="Đổi mật khẩu" aria-label="Đổi mật khẩu">${IC.key}</button><button class="ibtn" id="logout" title="Đăng xuất" aria-label="Đăng xuất">${IC.logout}</button></div></div></header>`;
  }

  function shell(content){
    const nav=[
      ['schedule','Lịch gác thi',IC.cal],
      ['busy','Báo bận / Điều chỉnh',IC.clip],
      ['swaps','Nhờ coi thay',IC.swap],
      ['notices','Thông báo',IC.bell],
      ['password','Đổi mật khẩu',IC.key]
    ];
    $('#app').innerHTML=topbar()+`<div class="shell"><aside class="side"><div class="sec">Menu chính</div><nav class="nav">${nav.map(([id,label,ic])=>`<button data-page="${id}" class="${state.page===id?'on':''}"${state.page===id?' aria-current="page"':''}><span class="n">${ic}</span>${label}${id==='notices'?'<span class="nb" id="navDot" hidden></span>':''}</button>`).join('')}</nav><div class="side-foot"><b>HUIT · Khoa CNTT</b><span>Hệ thống nội bộ</span><span>Phiên bản 1.0.0</span></div></aside><main class="main">${content}</main></div>`;
    document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;renderPage()});
    $('#notifications').onclick=()=>{state.page='notices';renderPage()};
    $('#changePassword').onclick=()=>{state.page='password';renderPage()};
    $('#logout').onclick=()=>{state.user=null;sessionStorage.removeItem('authRole');sessionStorage.removeItem('lecturerSession');sessionStorage.removeItem('authToken');sessionStorage.removeItem('mustChangePassword');location.replace('login.html')};
    refreshBell();
  }

  function loginView(){
    $('#app').innerHTML=`<div class="login"><section class="login-art"><div class="lb">${logoMark(72)}<div class="uni">Trường Đại học Công Thương<br>Thành phố Hồ Chí Minh</div></div><div><h2>Hệ thống xếp lịch gác thi</h2><p>Tra cứu lịch gác thi cá nhân, báo bận cho quản trị viên và trao đổi đổi ca.</p></div><div class="mini" aria-hidden="true">${'<i class="a"></i>'.repeat(40)}</div></section><section class="login-form"><div><h1>Đăng nhập giảng viên</h1><p class="muted" style="margin-bottom:18px">Dùng mã giảng viên và mật khẩu do quản trị viên cấp.</p><form id="loginForm"><label class="f"><span>Mã giảng viên</span><input id="maGV" required maxlength="20" autocomplete="username"></label><label class="f"><span>Mật khẩu</span><input id="password" type="password" required autocomplete="current-password"></label><div class="err" id="error"></div><button class="btn pri" type="submit">Đăng nhập</button></form><p class="hint">Lần đầu đăng nhập, mật khẩu tạm là 1 và hệ thống bắt buộc đổi mật khẩu trước khi sử dụng.</p></div></section></div>`;
    $('#loginForm').onsubmit=async e=>{
      e.preventDefault();
      const err=$('#error');
      try{
        const r=await req('/user/login',{method:'POST',body:JSON.stringify({ma_gv:$('#maGV').value.trim(),password:$('#password').value})});
        state.user=r;
        state.user.ma_gv=r.ma_gv;
        if(r.token) sessionStorage.setItem('authToken', r.token);
        if(r.must_change_password){passwordView(true)}else await renderPage();
      }catch(x){err.textContent=x.message}
    };
  }

  function passwordView(required=false){
    $('#app').innerHTML=`<div class="login"><section class="login-art"><div class="lb">${logoMark(72)}<div class="uni">Trường Đại học Công Thương<br>Thành phố Hồ Chí Minh</div></div><div><h2>${required?'Đổi mật khẩu bắt buộc':'Bảo mật tài khoản'}</h2><p>Đặt mật khẩu riêng để bảo vệ tài khoản giảng viên.</p></div></section><section class="login-form"><div><h1>${required?'Đổi mật khẩu lần đầu':'Đổi mật khẩu'}</h1><p class="muted" style="margin-bottom:18px">8–16 ký tự, ít nhất một chữ hoa A–Z và một ký tự đặc biệt.</p><form id="pwForm"><label class="f"><span>Mật khẩu hiện tại</span><input id="oldPw" type="password" required></label><label class="f"><span>Mật khẩu mới</span><input id="newPw" type="password" required minlength="8" maxlength="16"></label><label class="f"><span>Nhập lại mật khẩu mới</span><input id="confirmPw" type="password" required minlength="8" maxlength="16"></label><div class="err" id="error"></div><button class="btn pri" type="submit">Lưu mật khẩu</button>${required?'':' <button class="btn" type="button" id="back">Quay lại</button>'}</form></div></section></div>`;
    if($('#back'))$('#back').onclick=()=>{state.page='schedule';renderPage()};
    $('#pwForm').onsubmit=async e=>{
      e.preventDefault();
      const old=$('#oldPw').value,n=$('#newPw').value,c=$('#confirmPw').value,er=$('#error');
      if(n!==c){er.textContent='Mật khẩu nhập lại không khớp.';return}
      if(n.length<8||n.length>16||!/[A-Z]/.test(n)||! /[^A-Za-z0-9]/.test(n)){
        er.textContent='Mật khẩu phải dài 8–16 ký tự, có ít nhất một chữ hoa và một ký tự đặc biệt.';return
      }
      try{
        await req('/user/change-password',{method:'POST',body:JSON.stringify({ma_gv:state.user.ma_gv,current_password:old,new_password:n})});
        state.user.must_change_password=false;
        sessionStorage.removeItem('mustChangePassword');
        sessionStorage.setItem('lecturerSession',JSON.stringify(state.user));
        state.page='schedule';
        await renderPage();
      }catch(x){er.textContent=x.message}
    };
  }

  async function renderPage(){
    if(!state.user)return loginView();
    try{
      if(state.page==='schedule'){
        const r=await req('/user/schedule/'+encodeURIComponent(state.user.ma_gv));
        state.schedule=r.items;
      }
      if(state.page==='busy'){
        const [br, sc]=await Promise.all([
          req('/user/busy-requests'),
          req('/user/schedule/'+encodeURIComponent(state.user.ma_gv))
        ]);
        state.busyRequests=br.items;
        state.schedule=sc.items;
      }
      if(state.page==='swaps'){
        const id=encodeURIComponent(state.user.ma_gv);
        const [r,l,sc]=await Promise.all([
          req('/user/swaps/'+id),
          req('/user/lecturers/'+id),
          req('/user/schedule/'+id)
        ]);
        state.swaps=r.items;
        state.lecturers=l.items;
        state.schedule=sc.items;
      }
      if(state.page==='notices'){
        const r=await req('/user/notifications/'+encodeURIComponent(state.user.ma_gv));
        state.notices=r.items;
      }
    }catch(e){
      shell(`<div class="crumb">Cổng giảng viên</div><div class="panel"><h2>Chưa tải được dữ liệu</h2><p>${esc(e.message)}</p><p class="hint">Bạn hãy tải lại trang. Nếu vẫn chưa xem được, vui lòng liên hệ quản trị viên.</p></div>`);
      return;
    }
    if(state.page==='schedule')return schedulePage();
    if(state.page==='busy')return busyPage();
    if(state.page==='swaps')return swapsPage();
    if(state.page==='notices')return noticesPage();
    return passwordView(false);
  }

  function schedulePage(){
    const today=new Date().toISOString().slice(0,10),list=state.schedule,up=list.filter(x=>x.NgayThi>=today).length;
    const rows=list.map(x=>{
      const past=x.NgayThi<today;
      return `<tr><td><b>${fmt(x.NgayThi)}</b><br><span class="hint" style="margin:0">${esc(x.Thu||'')}</span></td><td>Tiết ${x.TuTiet}–${x.DenTiet}</td><td>Buổi ${x.Buoi}</td><td>${esc(LB[x.HinhThucThi]||x.HinhThucThi||'—')}</td><td>${esc(x.PhongThi||'—')}</td><td>${esc(x.MaCa)}</td><td><span class="chip ${past?'':'ok'}">${past?'Đã qua':'Sắp tới'}</span></td></tr>`;
    }).join('');
    shell(`<div class="crumb">Trang chủ / Lịch gác thi</div><header class="ph"><div><h1>Lịch gác thi của tôi</h1><p>Các ca bạn được phân công chính thức. Nhấn “Báo bận” nếu bạn có việc đột xuất.</p></div><div class="ph-r"><button class="btn" id="goBusy">${IC.clip} Báo bận ca thi</button><button class="btn" id="refresh">Làm mới</button></div></header><div class="stats"><div class="stat ic"><div class="si">${IC.clip}</div><div><b>${list.length}</b><span>Tổng số ca</span></div></div><div class="stat ic"><div class="si">${IC.cal}</div><div><b>${up}</b><span>Ca sắp tới</span></div></div><div class="stat ic"><div class="si">${IC.ok}</div><div><b>${list.length-up}</b><span>Ca đã qua</span></div></div></div><div class="panel"><div class="tw"><table><thead><tr><th>Ngày thi</th><th>Tiết</th><th>Buổi</th><th>Hình thức</th><th>Phòng</th><th>Mã ca</th><th>Tình trạng</th></tr></thead><tbody>${rows||'<tr><td colspan="7" class="empty">Bạn chưa được phân công ca gác thi nào.</td></tr>'}</tbody></table></div></div>`);
    $('#refresh').onclick=renderPage;
    $('#goBusy').onclick=()=>{state.page='busy';renderPage()};
  }

  // Tiện ích tính giờ theo tiết học
  function tietToTime(tiet, isEnd=false) {
    const times = {
      1: ['07:00','07:50'], 2: ['07:50','08:40'], 3: ['08:50','09:40'], 4: ['09:40','10:30'],
      5: ['10:40','11:30'], 6: ['11:30','12:20'], 7: ['13:00','13:50'], 8: ['13:50','14:40'],
      9: ['14:50','15:40'], 10: ['15:40','16:30'], 11: ['16:40','17:30'], 12: ['17:30','18:20'],
      13: ['18:30','19:15'], 14: ['19:15','20:00'], 15: ['20:00','20:45'], 16: ['20:45','21:30']
    };
    const t = times[tiet] || ['07:00','11:30'];
    return isEnd ? t[1] : t[0];
  }

  // =====================================================================
  // GIAO DIỆN BÁO BẬN / ĐIỀU CHỈNH LỊCH CHO GIẢNG VIÊN (PHƯƠNG ÁN B)
  // =====================================================================
  function busyPage(){
    const list = state.busyRequests || [];
    const pendingCount = list.filter(x=>x.TrangThai==='PENDING').length;
    const approvedCount = list.filter(x=>x.TrangThai==='APPROVED').length;
    const rejectedCount = list.filter(x=>x.TrangThai==='REJECTED').length;

    // Danh sách ca thi đang phân công của GV để chọn
    const activePendingSlots = new Set(list.filter(x=>x.TrangThai==='PENDING'&&x.MaCa).map(x=>x.MaCa));
    
    const shiftOptions = state.schedule.map(x=>{
      const isPending = activePendingSlots.has(x.MaCa);
      const stTime = tietToTime(x.TuTiet, false);
      const enTime = tietToTime(x.DenTiet, true);
      const dtStart = `${x.NgayThi}T${stTime}`;
      const dtEnd = `${x.NgayThi}T${enTime}`;
      return `<label class="u-opt ${isPending?'disabled':''}" style="margin-bottom:8px">
        <input type="radio" name="busyCa" value="${esc(x.MaCa)}"
               data-start="${dtStart}" data-end="${dtEnd}"
               data-label="${esc(x.Thu||'')}, ${fmt(x.NgayThi)} · tiết ${x.TuTiet}–${x.DenTiet} (${esc(x.MaCa)})"
               ${isPending?'disabled':''}>
        <div>
          <b>${esc(x.Thu||'')}, ${fmt(x.NgayThi)} · Tiết ${x.TuTiet}–${x.DenTiet}</b>
          <span>Phòng: ${esc(x.PhongThi||'Chưa xếp')} · Hình thức: ${esc(x.HinhThucThi||'—')} · Mã ca: ${esc(x.MaCa)}${isPending?' (Đã có yêu cầu đang chờ duyệt)':''}</span>
        </div>
      </label>`;
    }).join('') || '<p class="muted">Hiện tại bạn chưa có ca thi nào được phân công.</p>';

    // Bảng danh sách các yêu cầu báo bận đã gửi
    const reqStatusMap = {
      'PENDING': ['Chờ Admin xử lý', 'warn'],
      'APPROVED': ['Đã chấp nhận', 'ok'],
      'REJECTED': ['Đã từ chối', 'bad']
    };

    const tableRows = list.map(x => {
      const st = reqStatusMap[x.TrangThai] || [x.TrangThai, ''];
      const caInfo = x.MaCa ? `<b>Ca: ${esc(x.MaCa)}</b><br><span class="hint" style="margin:0">${fmt(x.NgayThi)} · Tiết ${x.TuTiet}–${x.DenTiet}</span>` : '<span class="muted">Không gắn ca cụ thể</span>';
      const timeRange = `${esc(x.ThoiGianBatDauBan ? x.ThoiGianBatDauBan.replace('T',' ') : '')}<br>đến ${esc(x.ThoiGianKetThucBan ? x.ThoiGianKetThucBan.replace('T',' ') : '')}`;
      
      let updateInfo = '<span class="muted">—</span>';
      if (x.TrangThai === 'APPROVED') {
        updateInfo = `<span style="color:var(--ok);font-weight:600">Đã điều chỉnh lịch</span><br><span class="hint" style="margin:0">GV thay thế: ${esc(x.TenGVThayThe || x.MaGVThayThe || 'Đã phân công lại')}</span>`;
      } else if (x.TrangThai === 'REJECTED') {
        updateInfo = `<span style="color:var(--bad);font-weight:500">Giữ nguyên lịch</span><br><span class="hint" style="margin:0">Lý do: ${esc(x.LyDoTuChoi || 'Không nêu')}</span>`;
      }

      return `<tr>
        <td><b>#${x.MaYeuCau}</b></td>
        <td>${caInfo}</td>
        <td><small>${timeRange}</small></td>
        <td><b>${esc(x.LyDoBaoBan)}</b>${x.GhiChuGV ? `<br><span class="hint" style="margin:0">${esc(x.GhiChuGV)}</span>` : ''}</td>
        <td><span class="chip ${st[1]}">${esc(st[0])}</span></td>
        <td><small>${x.ThoiGianGui ? x.ThoiGianGui.replace('T',' ') : ''}</small></td>
        <td>${updateInfo}</td>
        <td><button class="btn sm" data-view-busy="${x.MaYeuCau}">Chi tiết</button></td>
      </tr>`;
    }).join('');

    shell(`
      <div class="crumb">Trang chủ / Báo bận & Điều chỉnh lịch</div>
      <header class="ph">
        <div>
          <h1>Báo bận / Yêu cầu điều chỉnh lịch coi thi</h1>
          <p>Phương án B: Giảng viên chỉ gửi thông tin bận và lý do; Quản trị viên tự quyết định phương án phân công điều chỉnh lịch.</p>
        </div>
        <div class="ph-r">
          <button class="btn" id="refreshBusy">Làm mới</button>
        </div>
      </header>

      <div class="stats">
        <div class="stat ic"><div class="si">${IC.clip}</div><div><b>${list.length}</b><span>Tổng yêu cầu</span></div></div>
        <div class="stat ic"><div class="si">${IC.warn}</div><div><b>${pendingCount}</b><span>Đang chờ duyệt</span></div></div>
        <div class="stat ic"><div class="si">${IC.ok}</div><div><b>${approvedCount}</b><span>Đã chấp nhận</span></div></div>
        <div class="stat ic"><div class="si">${IC.bad}</div><div><b>${rejectedCount}</b><span>Đã từ chối</span></div></div>
      </div>

      <div class="u-grid">
        <form class="panel" id="busyForm">
          <h2>Gửi yêu cầu báo bận mới</h2>
          <p class="sub">Chọn ca thi bạn gặp việc bận hoặc nhập khoảng thời gian bận để gửi Admin xem xét.</p>
          
          <span class="u-lb">1. Chọn ca coi thi liên quan</span>
          <div class="u-opts" style="max-height:220px;overflow-y:auto;padding-right:4px">
            <label class="u-opt" style="margin-bottom:8px">
              <input type="radio" name="busyCa" value="" checked>
              <div><b>Tự nhập khoảng thời gian (không chọn ca cụ thể)</b><span>Hệ thống sẽ đối chiếu thời gian bận với các ca coi thi của bạn</span></div>
            </label>
            ${shiftOptions}
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            <label class="f">
              <span>2. Thời gian bắt đầu bận <b style="color:var(--bad)">*</b></span>
              <input type="datetime-local" id="busyStart" required>
            </label>
            <label class="f">
              <span>3. Thời gian kết thúc bận <b style="color:var(--bad)">*</b></span>
              <input type="datetime-local" id="busyEnd" required>
            </label>
          </div>

          <label class="f" style="margin-top:8px">
            <span>4. Lý do báo bận <b style="color:var(--bad)">*</b></span>
            <select id="busyReasonSelect">
              <option value="">-- Chọn lý do thường gặp hoặc tự nhập bên dưới --</option>
              <option value="Đi công tác, họp theo quyết định của Trường">Đi công tác, họp theo quyết định của Trường</option>
              <option value="Bận việc gia đình (Hiếu, hỷ)">Bận việc gia đình (Hiếu, hỷ)</option>
              <option value="Sự cố sức khỏe / Bận việc khẩn cấp đột xuất">Sự cố sức khỏe / Bận việc khẩn cấp đột xuất</option>
              <option value="Trùng lịch hội nghị, bảo vệ luận văn / khóa luận">Trùng lịch hội nghị, bảo vệ luận văn / khóa luận</option>
              <option value="Lý do cá nhân đột xuất khác">Lý do cá nhân đột xuất khác</option>
            </select>
          </label>
          <input type="text" id="busyReasonCustom" placeholder="Hoặc nhập lý do chi tiết..." required style="margin-top:6px">

          <label class="f" style="margin-top:8px">
            <span>5. Ghi chú bổ sung cho Admin <small>(không bắt buộc)</small></span>
            <textarea id="busyNote" rows="2" maxlength="500" placeholder="Thông tin chi tiết hỗ trợ Admin sắp xếp phương án thay thế..."></textarea>
          </label>

          <div class="err" id="busyErr" role="alert"></div>
          <button class="btn pri" type="submit" id="btnSubmitBusy" style="margin-top:12px">
            ${IC.send} Gửi yêu cầu báo bận
          </button>
        </form>

        <aside class="panel u-prev" aria-label="Tóm tắt yêu cầu">
          <h2>Tóm tắt yêu cầu</h2>
          <div class="box">
            <small>Ca coi thi liên quan</small>
            <b id="pvBusyShift">Chưa chọn ca</b>
          </div>
          <div class="box" style="margin-top:10px">
            <small>Khoảng thời gian bận</small>
            <b id="pvBusyTime">Chưa chọn thời gian</b>
          </div>
          <div class="box" style="margin-top:10px">
            <small>Lý do</small>
            <b id="pvBusyReason">Chưa nhập lý do</b>
          </div>
          <p class="hint" style="margin-top:14px">
            Sau khi gửi, yêu cầu sẽ chuyển sang trạng thái <b>Chờ Admin xử lý</b>. Lịch chính thức <b>chỉ thay đổi khi Admin chấp nhận</b> và duyệt phương án điều chỉnh.
          </p>
        </aside>
      </div>

      <div class="panel" style="margin-top:18px">
        <h2>Danh sách yêu cầu báo bận đã gửi</h2>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Mã YC</th>
                <th>Ca thi liên quan</th>
                <th>Thời gian bận</th>
                <th>Lý do & Ghi chú</th>
                <th>Trạng thái</th>
                <th>Thời gian gửi</th>
                <th>Kết quả xử lý</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="8" class="empty">Bạn chưa gửi yêu cầu báo bận nào.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `);

    // Sự kiện khi chọn ca thi -> tự động điền giờ
    const form = $('#busyForm');
    const updatePreview = () => {
      const selected = form.querySelector('input[name="busyCa"]:checked');
      if (selected && selected.value) {
        $('#pvBusyShift').textContent = selected.dataset.label;
        if (selected.dataset.start && !$('#busyStart').value) {
          $('#busyStart').value = selected.dataset.start;
        }
        if (selected.dataset.end && !$('#busyEnd').value) {
          $('#busyEnd').value = selected.dataset.end;
        }
      } else {
        $('#pvBusyShift').textContent = 'Tự xác định theo thời gian';
      }

      const st = $('#busyStart').value;
      const en = $('#busyEnd').value;
      if (st && en) {
        $('#pvBusyTime').textContent = `${st.replace('T', ' ')} → ${en.replace('T', ' ')}`;
      } else {
        $('#pvBusyTime').textContent = 'Chưa chọn đủ thời gian';
      }

      const r = $('#busyReasonCustom').value.trim() || $('#busyReasonSelect').value;
      $('#pvBusyReason').textContent = r || 'Chưa nhập lý do';
    };

    form.querySelectorAll('input[name="busyCa"]').forEach(r => {
      r.onchange = () => {
        if (r.checked && r.value) {
          if (r.dataset.start) $('#busyStart').value = r.dataset.start;
          if (r.dataset.end) $('#busyEnd').value = r.dataset.end;
        }
        updatePreview();
      };
    });

    $('#busyReasonSelect').onchange = e => {
      if (e.target.value) {
        $('#busyReasonCustom').value = e.target.value;
      }
      updatePreview();
    };

    $('#busyStart').oninput = updatePreview;
    $('#busyEnd').oninput = updatePreview;
    $('#busyReasonCustom').oninput = updatePreview;

    // Gửi form báo bận
    form.onsubmit = async e => {
      e.preventDefault();
      const errEl = $('#busyErr');
      errEl.textContent = '';

      const selected = form.querySelector('input[name="busyCa"]:checked');
      const maCa = selected ? selected.value : null;
      const st = $('#busyStart').value;
      const en = $('#busyEnd').value;
      const reason = $('#busyReasonCustom').value.trim();
      const note = $('#busyNote').value.trim();

      if (!st || !en) {
        errEl.textContent = 'Vui lòng chọn thời gian bắt đầu và kết thúc bận.';
        return;
      }
      if (new Date(st) >= new Date(en)) {
        errEl.textContent = 'Thời gian bắt đầu bận phải trước thời gian kết thúc bận.';
        return;
      }
      if (!reason) {
        errEl.textContent = 'Vui lòng nhập lý do báo bận.';
        return;
      }

      const btn = $('#btnSubmitBusy');
      btn.disabled = true;
      btn.textContent = 'Đang gửi yêu cầu...';

      try {
        await req('/user/busy-requests', {
          method: 'POST',
          body: JSON.stringify({
            ma_ca: maCa || null,
            thoi_gian_bat_dau: st,
            thoi_gian_ket_thuc: en,
            ly_do: reason,
            ghi_chu: note || null
          })
        });
        toast('Gửi yêu cầu báo bận thành công. Yêu cầu đang chờ Admin xử lý.');
        await renderPage();
      } catch (err) {
        errEl.textContent = err.message;
        btn.disabled = false;
        btn.innerHTML = `${IC.send} Gửi yêu cầu báo bận`;
      }
    };

    // Xem chi tiết yêu cầu
    document.querySelectorAll('[data-view-busy]').forEach(b => {
      b.onclick = async () => {
        const id = b.dataset.viewBusy;
        try {
          const d = await req('/user/busy-requests/' + encodeURIComponent(id));
          const st = reqStatusMap[d.TrangThai] || [d.TrangThai, ''];
          let historyHtml = '';
          if (d.history && d.history.length) {
            historyHtml = `<div class="panel" style="margin-top:12px;background:var(--sub)">
              <b>Lịch sử điều chỉnh lịch coi thi</b>
              ${d.history.map(h => `<div style="font-size:13px;margin-top:6px;padding:6px 0;border-bottom:1px dashed var(--line)">
                <div><b>Hành động:</b> ${esc(h.HanhDong)} (${esc(h.ThoiDiem)})</div>
                <div><b>Trước:</b> ${esc(h.PhanCongTruoc)}</div>
                <div><b>Sau:</b> <span style="color:var(--ok);font-weight:600">${esc(h.PhanCongSau)}</span></div>
                <div><b>Người thực hiện:</b> ${esc(h.NguoiThucHien)}</div>
                ${h.LyDo ? `<div><b>Ghi chú:</b> ${esc(h.LyDo)}</div>` : ''}
              </div>`).join('')}
            </div>`;
          }

          openUserModal({
            title: `Chi tiết yêu cầu báo bận #${d.MaYeuCau}`,
            wide: true,
            body: `
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div>
                  <small class="muted">Trạng thái:</small><br>
                  <span class="chip ${st[1]}">${esc(st[0])}</span>
                </div>
                <div>
                  <small class="muted">Thời gian gửi:</small><br>
                  <b>${esc(d.ThoiGianGui ? d.ThoiGianGui.replace('T',' ') : '—')}</b>
                </div>
              </div>

              <div style="margin-top:12px">
                <small class="muted">Ca thi liên quan:</small><br>
                ${d.MaCa ? `<b>${esc(d.MaCa)}</b> (${fmt(d.NgayThi)}, tiết ${d.TuTiet}–${d.DenTiet}, phòng ${esc(d.PhongThi||'—')})` : '<i>Không gắn ca cụ thể</i>'}
              </div>

              <div style="margin-top:12px">
                <small class="muted">Thời gian bận:</small><br>
                <b>${esc(d.ThoiGianBatDauBan ? d.ThoiGianBatDauBan.replace('T',' ') : '')}</b> đến <b>${esc(d.ThoiGianKetThucBan ? d.ThoiGianKetThucBan.replace('T',' ') : '')}</b>
              </div>

              <div style="margin-top:12px">
                <small class="muted">Lý do báo bận:</small><br>
                <b>${esc(d.LyDoBaoBan)}</b>
              </div>

              ${d.GhiChuGV ? `<div style="margin-top:12px"><small class="muted">Ghi chú của giảng viên:</small><br>${esc(d.GhiChuGV)}</div>` : ''}

              <div style="margin-top:16px;padding:12px;border-radius:8px;background:var(--sub)">
                <b>Kết quả xử lý từ Admin</b><br>
                ${d.TrangThai === 'PENDING' ? '<span class="muted">Yêu cầu đang chờ quản trị viên xem xét và sắp xếp phương án điều chỉnh.</span>' : ''}
                ${d.TrangThai === 'APPROVED' ? `<div style="color:var(--ok);margin-top:6px">
                  <b>ĐÃ CHẤP NHẬN:</b> Ca coi thi đã được điều chỉnh thành công.<br>
                  Người xử lý: <b>${esc(d.NguoiXuLy||'Admin')}</b> lúc ${esc(d.ThoiGianXuLy?d.ThoiGianXuLy.replace('T',' '):'—')}<br>
                  ${d.GhiChuAdmin ? `Ghi chú Admin: <i>${esc(d.GhiChuAdmin)}</i>` : ''}
                </div>` : ''}
                ${d.TrangThai === 'REJECTED' ? `<div style="color:var(--bad);margin-top:6px">
                  <b>ĐÃ TỪ CHỐI:</b> Lịch coi thi hiện tại được giữ nguyên.<br>
                  Lý do từ chối: <b style="color:var(--bad)">${esc(d.LyDoTuChoi||'Không nêu')}</b><br>
                  Người xử lý: <b>${esc(d.NguoiXuLy||'Admin')}</b> lúc ${esc(d.ThoiGianXuLy?d.ThoiGianXuLy.replace('T',' '):'—')}<br>
                  ${d.GhiChuAdmin ? `Ghi chú Admin: <i>${esc(d.GhiChuAdmin)}</i>` : ''}
                </div>` : ''}
              </div>

              ${historyHtml}
            `,
            foot: '<button class="btn pri" id="btnCloseDetail">Đóng</button>'
          });
          $('#btnCloseDetail').onclick = closeUserModal;
        } catch (ex) {
          toast(ex.message);
        }
      };
    });

    $('#refreshBusy').onclick = renderPage;
  }

  function swapsPage(){
    const me=state.user.ma_gv,tab=state.swapTab||'sent';
    const busy=new Set(state.swaps.filter(x=>x.TrangThai==='Pending'&&x.MaGVGui===me).map(x=>x.MaCaGui));
    const free=state.schedule.find(x=>!busy.has(x.MaCa));
    const shifts=state.schedule.map(x=>`<label class="u-opt"><input type="radio" name="ownSlot" value="${esc(x.MaCa)}" data-label="${esc(slot(x.NgayThi,x.TuTiet,x.DenTiet))}" ${busy.has(x.MaCa)?'disabled':''} ${free&&free.MaCa===x.MaCa?'checked':''}><div><b>${esc(x.Thu||'')}, ${fmt(x.NgayThi)}</b><span>Tiết ${x.TuTiet}–${x.DenTiet} · ${esc(x.MaCa)}${busy.has(x.MaCa)?' · đang chờ phản hồi':''}</span></div></label>`).join('')||'<p class="muted">Bạn chưa có ca nào được phân công.</p>';
    const people=state.lecturers.map(x=>`<label class="u-opt" data-q="${esc((x.HoTen+' '+x.MaGV).toLowerCase())}"><input type="radio" name="otherGV" value="${esc(x.MaGV)}" data-name="${esc(x.HoTen)}"><div><span class="u-av">${esc(initialsOf(x.HoTen))}</span><span><b>${esc(x.HoTen)}</b><span>${esc(x.MaGV)}</span></span></div></label>`).join('');
    const pendingIn=state.swaps.filter(x=>x.TrangThai==='Pending'&&x.MaGVNhan===me).length;
    shell(`<div class="crumb">Trang chủ / Nhờ coi thay</div><header class="ph"><div><h1>Nhờ giảng viên coi thay</h1><p>Trao đổi với đồng nghiệp trước, sau đó gửi yêu cầu để họ xác nhận.</p></div></header>
    <div class="u-steps"><div class="u-step on"><i>1</i><div><b>Chọn ca và người nhận</b><span>Người đã đồng ý với bạn</span></div></div><div class="u-step"><i>2</i><div><b>Người nhận xác nhận</b><span>Họ nhận thông báo ngay</span></div></div><div class="u-step"><i>3</i><div><b>Hệ thống chuyển ca</b><span>Chỉ ca được chọn thay đổi</span></div></div></div>
    <div class="u-grid"><form class="panel" id="swapForm"><h2>Tạo yêu cầu nhận coi thay</h2>
      <span class="u-lb">Ca bạn cần người coi thay</span><div class="u-opts">${shifts}</div>
      <span class="u-lb">Giảng viên đã đồng ý nhận ca</span><input type="search" id="gvSearch" placeholder="Tìm theo tên hoặc mã giảng viên" aria-label="Tìm giảng viên"><div class="u-people" id="gvList">${people||'<p class="muted">Chưa có giảng viên khác.</p>'}</div>
      <label class="u-lb" for="message">Lời nhắn <small>(không bắt buộc)</small><span class="u-cnt" id="cnt">0/500</span></label><textarea id="message" maxlength="500" rows="3" placeholder="Ví dụ: Đã trao đổi và thống nhất nhờ coi thay"></textarea>
      <div class="u-chips" id="chips">${['Đã trao đổi và thống nhất','Mình có việc đột xuất','Cảm ơn bạn nhiều'].map(t=>`<button type="button">${t}</button>`).join('')}</div>
      <p class="hint">Chỉ ca được chọn sẽ chuyển sang giảng viên nhận. Các ca còn lại của hai bên không thay đổi.</p><div class="err" id="swapErr" role="alert"></div>
      <button class="btn pri" type="submit" id="swapSend" ${free&&people?'':'disabled'}>${IC.send} Gửi yêu cầu</button></form>
      <aside class="panel u-prev" aria-label="Xem trước"><h2>Xem trước</h2><div class="box"><small>Ca của bạn</small><b id="pvShift">—</b></div><div class="ar">${IC.down}</div><div class="box"><small>Chuyển cho</small><b id="pvName">Chưa chọn giảng viên</b></div><p class="hint">Yêu cầu chỉ có hiệu lực sau khi người nhận bấm xác nhận.</p></aside></div>
    <div class="panel"><h2>Yêu cầu nhờ coi thay</h2><div class="tabs" role="tablist"><button role="tab" data-tab="sent" class="${tab==='sent'?'on':''}">Đã gửi</button><button role="tab" data-tab="recv" class="${tab==='recv'?'on':''}">Đã nhận${pendingIn?` <span class="chip warn">${pendingIn}</span>`:''}</button></div><div class="tw"><table><thead id="swHead"></thead><tbody id="swBody"></tbody></table></div></div>`);
    const form=$('#swapForm'),val=n=>form.querySelector(`input[name=${n}]:checked`);
    const prev=()=>{const a=val('ownSlot'),b=val('otherGV');$('#pvShift').textContent=a?a.dataset.label:'—';$('#pvName').textContent=b?b.dataset.name:'Chưa chọn giảng viên'};
    form.addEventListener('change',prev);prev();
    $('#gvSearch').oninput=e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('#gvList [data-q]').forEach(l=>l.hidden=q&&!l.dataset.q.includes(q))};
    $('#message').oninput=e=>$('#cnt').textContent=e.target.value.length+'/500';
    $('#chips').onclick=e=>{const b=e.target.closest('button');if(b){$('#message').value=b.textContent;$('#cnt').textContent=b.textContent.length+'/500'}};
    const status={Pending:['Đang chờ phản hồi','warn'],Accepted:['Đã nhận coi thay','ok'],Rejected:['Đã từ chối','bad'],Cancelled:['Đã hủy',''],Failed:['Không hoàn tất','bad']};
    function draw(){
      const t=state.swapTab||'sent',mine=t==='sent';
      document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
      $('#swHead').innerHTML=`<tr><th>${mine?'Người nhận':'Người nhờ'}</th><th>Ca cần coi thay</th><th>Lời nhắn</th><th>Trạng thái</th><th>Thao tác</th></tr>`;
      const rows=state.swaps.filter(x=>mine?x.MaGVGui===me:x.MaGVNhan===me).map(x=>{
        const st=status[x.TrangThai]||[x.TrangThai,''],legacy=x.MaCaNhan?` · Yêu cầu cũ có ca đối ứng: ${fmt(x.NgayCaNhan)} · tiết ${x.TuTietNhan}–${x.DenTietNhan} (${x.MaCaNhan})`:'';
        const can=!mine&&x.TrangThai==='Pending';
        const act=can?(x.MaCaNhan?`<button class="btn sm" data-reject="${x.ID}">Từ chối</button>`:`<button class="btn sm pri" data-accept="${x.ID}">Nhận coi thay</button> <button class="btn sm" data-reject="${x.ID}">Từ chối</button>`):'<span class="muted">—</span>';
        return `<tr><td><b>${esc(mine?x.TenNguoiNhan:x.TenNguoiGui)}</b><br><span class="hint" style="margin:0">${x.TaoLuc?new Date(x.TaoLuc).toLocaleString('vi-VN'):''}</span></td><td>${fmt(x.NgayCaGui)} · tiết ${x.TuTietGui}–${x.DenTietGui}<br><span class="hint" style="margin:0">${esc(x.MaCaGui)}</span></td><td>${esc((x.LoiNhan||'—')+legacy)}</td><td><span class="chip ${st[1]}">${esc(st[0])}</span></td><td>${act}</td></tr>`}).join('');
      $('#swBody').innerHTML=rows||`<tr><td colspan="5" class="empty">${mine?'Bạn chưa gửi yêu cầu nào.':'Chưa có yêu cầu nào gửi đến bạn.'}</td></tr>`;
      document.querySelectorAll('[data-accept],[data-reject]').forEach(b=>b.onclick=async()=>{
        const acc=b.hasAttribute('data-accept'),id=b.getAttribute(acc?'data-accept':'data-reject');
        if(acc&&!confirm('Nhận coi thay ca này? Ca sẽ được chuyển sang bạn ngay.'))return;
        b.disabled=true;
        try{await req(`/user/swaps/${id}/respond`,{method:'POST',body:JSON.stringify({ma_gv:me,action:acc?'accept':'reject'})});toast(acc?'Đã nhận coi thay. Lịch của bạn đã cập nhật.':'Đã từ chối yêu cầu.');await renderPage()}catch(e){b.disabled=false;toast(e.message)}});
    }
    document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.swapTab=b.dataset.tab;draw()});draw();
    form.onsubmit=async e=>{e.preventDefault();const er=$('#swapErr'),a=val('ownSlot'),g=val('otherGV'),btn=$('#swapSend');er.textContent='';
      if(!a){er.textContent='Hãy chọn ca cần người coi thay.';return}
      if(!g){er.textContent='Hãy chọn giảng viên đã đồng ý nhận ca.';return}
      btn.disabled=true;btn.lastChild.textContent=' Đang gửi…';
      try{await req('/user/swaps',{method:'POST',body:JSON.stringify({ma_gv:me,ma_ca_gui:a.value,ma_gv_nhan:g.value,loi_nhan:$('#message').value.trim()||null})});state.swapTab='sent';toast('Đã gửi yêu cầu cho '+g.dataset.name+'.');await renderPage()}
      catch(x){er.textContent=x.message;btn.disabled=false;btn.lastChild.textContent=' Gửi yêu cầu'}};
  }

  function noticesPage(){
    const n=state.notices,unread=n.filter(x=>!x.DaDoc).length;
    shell(`<div class="crumb">Trang chủ / Thông báo</div><header class="ph"><div><h1>Thông báo</h1><p>Yêu cầu báo bận, nhận coi thay và kết quả xử lý.</p></div><div class="ph-r">${unread?'<button class="btn" id="readAll">Đánh dấu tất cả đã đọc</button>':''}</div></header><div class="panel"><div class="pcl">${n.map(x=>`<div class="pc notice ${x.DaDoc?'':'unread'}"><div class="t"><b>${esc(x.TieuDe)}</b><span>${esc(x.NoiDung)}</span><span class="hint" style="margin:0">${new Date(x.TaoLuc).toLocaleString('vi-VN')}</span></div>${x.DaDoc?'':`<button class="btn sm" data-read="${x.ID}">Đã đọc</button>`}</div>`).join('')||'<p class="muted">Chưa có thông báo.</p>'}</div></div>`);
    const mark=id=>req(`/user/notifications/${encodeURIComponent(state.user.ma_gv)}/${id}/read`,{method:'POST'});
    document.querySelectorAll('[data-read]').forEach(b=>b.onclick=async()=>{try{await mark(b.dataset.read);await renderPage()}catch(e){toast(e.message)}});
    const all=$('#readAll');if(all)all.onclick=async()=>{try{await Promise.all(n.filter(x=>!x.DaDoc).map(x=>mark(x.ID)));await renderPage()}catch(e){toast(e.message)}};
  }

  window.addEventListener('DOMContentLoaded',()=>{
    if(sessionStorage.getItem('authRole')!=='user'){location.replace('login.html');return;}
    try {
      const saved=JSON.parse(sessionStorage.getItem('lecturerSession')||'null');
      if(!saved || !saved.ma_gv){location.replace('login.html');return;}
      state.user=saved;
      if(sessionStorage.getItem('mustChangePassword')==='1' || saved.must_change_password){passwordView(true);}
      else renderPage();
    } catch(e) { location.replace('login.html'); }
  });
})();
