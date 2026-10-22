(() => {
  const $ = s => document.querySelector(s);
  const base = window.API_BASE_URL || 'http://127.0.0.1:8000/api';
  const state = {user:null, page:'schedule', swaps:[], schedule:[], lecturers:[], notices:[]};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const logoSrc = (() => {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null')?.logo || LOGO; }
    catch { return LOGO; }
  })();
  const logoMark = size => `<div class="logo-wrap"><img src="${esc(logoSrc)}" alt="Logo Trường Đại học Công Thương" style="width:${size}px;height:${size}px;object-fit:contain"></div>`;
  async function req(path, opts={}) {
    const r = await fetch(base+path,{headers:{'Content-Type':'application/json'},...opts});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(typeof d.detail==='string'?d.detail:'Yêu cầu không thành công ('+r.status+').');
    return d;
  }
  const fmt = d => d ? new Date(d+'T00:00:00').toLocaleDateString('vi-VN') : '';
  const slot = (date,a,b) => `${fmt(date)} · tiết ${a}–${b}`;
  const todayLabel = () => new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
  function toast(m){let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',3500)}
  const initialsOf=n=>String(n||'GV').trim().split(/\s+/).slice(-2).map(w=>w[0]).join('').toUpperCase();
  async function refreshBell(){
    try{const r=await req('/user/notifications/'+encodeURIComponent(state.user.ma_gv));const n=(r.items||[]).filter(x=>!x.DaDoc).length;state.unread=n;
      [['#bellDot',n>9?'9+':n],['#navDot',n]].forEach(([q,v])=>{const e=$(q);if(e){e.textContent=v;e.hidden=!n}})}catch(e){}
  }
  function topbar(){
    return `<header class="topbar"><div class="tb-brand">${logoMark(38)}<div><div class="uni">Trường Đại học Công Thương TP.HCM</div><h1>Hệ thống xếp lịch gác thi</h1><div class="sub">Khoa Công nghệ Thông tin · Cổng giảng viên</div></div></div><div class="tb-r"><span class="pillbox">${IC.cal}<span class="hide-sm">${todayLabel()}</span></span><button class="ibtn" id="notifications" title="Thông báo" aria-label="Thông báo">${IC.bell}<span class="dot" id="bellDot" hidden></span></button><div class="tb-user"><div class="tb-av">${esc(initialsOf(state.user.ho_ten))}</div><div><b>${esc(state.user.ho_ten)}</b><span>Giảng viên</span></div><button class="ibtn" id="changePassword" title="Đổi mật khẩu" aria-label="Đổi mật khẩu">${IC.key}</button><button class="ibtn" id="logout" title="Đăng xuất" aria-label="Đăng xuất">${IC.logout}</button></div></div></header>`
  }
  function shell(content){
    const nav=[['schedule','Lịch gác thi',IC.cal],['swaps','Nhờ coi thay',IC.swap],['notices','Thông báo',IC.bell],['password','Đổi mật khẩu',IC.key]];
    $('#app').innerHTML=topbar()+`<div class="shell"><aside class="side"><div class="sec">Menu chính</div><nav class="nav">${nav.map(([id,label,ic])=>`<button data-page="${id}" class="${state.page===id?'on':''}"${state.page===id?' aria-current="page"':''}><span class="n">${ic}</span>${label}${id==='notices'?'<span class="nb" id="navDot" hidden></span>':''}</button>`).join('')}</nav><div class="side-foot"><b>HUIT · Khoa CNTT</b><span>Hệ thống nội bộ</span><span>Phiên bản 1.0.0</span></div></aside><main class="main">${content}</main></div>`;
    document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;renderPage()});
    $('#notifications').onclick=()=>{state.page='notices';renderPage()};
    $('#changePassword').onclick=()=>{state.page='password';renderPage()};
    $('#logout').onclick=()=>{state.user=null;sessionStorage.removeItem('authRole');sessionStorage.removeItem('lecturerSession');sessionStorage.removeItem('mustChangePassword');location.replace('login.html')};
    refreshBell();
  }
  function loginView(){ $('#app').innerHTML=`<div class="login"><section class="login-art"><div class="lb">${logoMark(72)}<div class="uni">Trường Đại học Công Thương<br>Thành phố Hồ Chí Minh</div></div><div><h2>Hệ thống xếp lịch gác thi</h2><p>Tra cứu lịch gác thi cá nhân, trao đổi đổi ca và nhận thông báo.</p></div><div class="mini" aria-hidden="true">${'<i class="a"></i>'.repeat(40)}</div></section><section class="login-form"><div><h1>Đăng nhập giảng viên</h1><p class="muted" style="margin-bottom:18px">Dùng mã giảng viên và mật khẩu do quản trị viên cấp.</p><form id="loginForm"><label class="f"><span>Mã giảng viên</span><input id="maGV" required maxlength="20" autocomplete="username"></label><label class="f"><span>Mật khẩu</span><input id="password" type="password" required autocomplete="current-password"></label><div class="err" id="error"></div><button class="btn pri" type="submit">Đăng nhập</button></form><p class="hint">Lần đầu đăng nhập, mật khẩu tạm là 1 và hệ thống bắt buộc đổi mật khẩu trước khi sử dụng.</p></div></section></div>`;
    $('#loginForm').onsubmit=async e=>{e.preventDefault();const err=$('#error');try{const r=await req('/user/login',{method:'POST',body:JSON.stringify({ma_gv:$('#maGV').value.trim(),password:$('#password').value})});state.user=r;state.user.ma_gv=r.ma_gv;if(r.must_change_password){passwordView(true)}else await renderPage()}catch(x){err.textContent=x.message}};
  }
  function passwordView(required=false){$('#app').innerHTML=`<div class="login"><section class="login-art"><div class="lb">${logoMark(72)}<div class="uni">Trường Đại học Công Thương<br>Thành phố Hồ Chí Minh</div></div><div><h2>${required?'Đổi mật khẩu bắt buộc':'Bảo mật tài khoản'}</h2><p>Đặt mật khẩu riêng để bảo vệ tài khoản giảng viên.</p></div></section><section class="login-form"><div><h1>${required?'Đổi mật khẩu lần đầu':'Đổi mật khẩu'}</h1><p class="muted" style="margin-bottom:18px">8–16 ký tự, ít nhất một chữ hoa A–Z và một ký tự đặc biệt.</p><form id="pwForm"><label class="f"><span>Mật khẩu hiện tại</span><input id="oldPw" type="password" required></label><label class="f"><span>Mật khẩu mới</span><input id="newPw" type="password" required minlength="8" maxlength="16"></label><label class="f"><span>Nhập lại mật khẩu mới</span><input id="confirmPw" type="password" required minlength="8" maxlength="16"></label><div class="err" id="error"></div><button class="btn pri" type="submit">Lưu mật khẩu</button>${required?'':' <button class="btn" type="button" id="back">Quay lại</button>'}</form></div></section></div>`;
    if($('#back'))$('#back').onclick=()=>{state.page='schedule';renderPage()};
    $('#pwForm').onsubmit=async e=>{e.preventDefault();const old=$('#oldPw').value,n=$('#newPw').value,c=$('#confirmPw').value,er=$('#error');if(n!==c){er.textContent='Mật khẩu nhập lại không khớp.';return}if(n.length<8||n.length>16||!/[A-Z]/.test(n)||! /[^A-Za-z0-9]/.test(n)){er.textContent='Mật khẩu phải dài 8–16 ký tự, có ít nhất một chữ hoa và một ký tự đặc biệt.';return}try{await req('/user/change-password',{method:'POST',body:JSON.stringify({ma_gv:state.user.ma_gv,current_password:old,new_password:n})});state.user.must_change_password=false;sessionStorage.removeItem('mustChangePassword');sessionStorage.setItem('lecturerSession',JSON.stringify(state.user));state.page='schedule';await renderPage()}catch(x){er.textContent=x.message}};
  }
  async function renderPage(){if(!state.user)return loginView();try{
    if(state.page==='schedule'){const r=await req('/user/schedule/'+encodeURIComponent(state.user.ma_gv));state.schedule=r.items}
    if(state.page==='swaps'){const id=encodeURIComponent(state.user.ma_gv);const [r,l,sc]=await Promise.all([req('/user/swaps/'+id),req('/user/lecturers/'+id),req('/user/schedule/'+id)]);state.swaps=r.items;state.lecturers=l.items;state.schedule=sc.items}
    if(state.page==='notices'){const r=await req('/user/notifications/'+encodeURIComponent(state.user.ma_gv));state.notices=r.items}
  }catch(e){shell(`<div class="crumb">Cổng giảng viên</div><div class="panel"><h2>Chưa tải được dữ liệu</h2><p>${esc(e.message)}</p><p class="hint">Bạn hãy tải lại trang. Nếu vẫn chưa xem được, vui lòng liên hệ quản trị viên.</p></div>`);return}
  if(state.page==='schedule')return schedulePage();
  if(state.page==='swaps')return swapsPage();
  if(state.page==='notices')return noticesPage();
  return passwordView(false);
  }
  function schedulePage(){
    const today=new Date().toISOString().slice(0,10),list=state.schedule,up=list.filter(x=>x.NgayThi>=today).length;
    const rows=list.map(x=>{const past=x.NgayThi<today;return `<tr><td><b>${fmt(x.NgayThi)}</b><br><span class="hint" style="margin:0">${esc(x.Thu||'')}</span></td><td>Tiết ${x.TuTiet}–${x.DenTiet}</td><td>Buổi ${x.Buoi}</td><td>${esc(LB[x.HinhThucThi]||x.HinhThucThi||'—')}</td><td>${esc(x.PhongThi||'—')}</td><td>${esc(x.MaCa)}</td><td><span class="chip ${past?'':'ok'}">${past?'Đã qua':'Sắp tới'}</span></td></tr>`}).join('');
    shell(`<div class="crumb">Trang chủ / Lịch gác thi</div><header class="ph"><div><h1>Lịch gác thi của tôi</h1><p>Các ca bạn được phân công. Nhấn “Làm mới” để cập nhật.</p></div><div class="ph-r"><button class="btn" id="refresh">Làm mới</button></div></header><div class="stats"><div class="stat ic"><div class="si">${IC.clip}</div><div><b>${list.length}</b><span>Tổng số ca</span></div></div><div class="stat ic"><div class="si">${IC.cal}</div><div><b>${up}</b><span>Ca sắp tới</span></div></div><div class="stat ic"><div class="si">${IC.ok}</div><div><b>${list.length-up}</b><span>Ca đã qua</span></div></div></div><div class="panel"><div class="tw"><table><thead><tr><th>Ngày thi</th><th>Tiết</th><th>Buổi</th><th>Hình thức</th><th>Phòng</th><th>Mã ca</th><th>Tình trạng</th></tr></thead><tbody>${rows||'<tr><td colspan="7" class="empty">Bạn chưa được phân công ca gác thi nào.</td></tr>'}</tbody></table></div></div>`);
    $('#refresh').onclick=renderPage}
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
    shell(`<div class="crumb">Trang chủ / Thông báo</div><header class="ph"><div><h1>Thông báo</h1><p>Yêu cầu nhận coi thay và kết quả xử lý.</p></div><div class="ph-r">${unread?'<button class="btn" id="readAll">Đánh dấu tất cả đã đọc</button>':''}</div></header><div class="panel"><div class="pcl">${n.map(x=>`<div class="pc notice ${x.DaDoc?'':'unread'}"><div class="t"><b>${esc(x.TieuDe)}</b><span>${esc(x.NoiDung)}</span><span class="hint" style="margin:0">${new Date(x.TaoLuc).toLocaleString('vi-VN')}</span></div>${x.DaDoc?'':`<button class="btn sm" data-read="${x.ID}">Đã đọc</button>`}</div>`).join('')||'<p class="muted">Chưa có thông báo.</p>'}</div></div>`);
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
