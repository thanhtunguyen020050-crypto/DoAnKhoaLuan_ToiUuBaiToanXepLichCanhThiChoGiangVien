/* ========= Tiện ích ========= */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const half=s=>s<=2?'S':'C';
const fmtD=d=>{const p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0]};
const wd=d=>{const p=d.split('-').map(Number);return WD[new Date(p[0],p[1]-1,p[2]).getDay()]};
const lec=id=>S.lecs.find(l=>String(l.id)===String(id));
const exm=id=>S.exams.find(e=>e.id===id);
const cmpEx=(a,b)=>a.date.localeCompare(b.date)||rangeFor(a)[0]-rangeFor(b)[0]||rangeFor(a)[1]-rangeFor(b)[1]||String(a.room).localeCompare(String(b.room));
const depts=()=>[...new Set(S.lecs.map(l=>l.dept).concat(S.exams.map(e=>e.dept)).filter(Boolean))].sort();
function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',3200)}
function openModal(o){
  $('#modal').innerHTML='<div class="ov" data-act="ovclose"><div class="md '+(o.wide?'wide':'')+'" role="dialog" aria-modal="true" aria-label="'+esc(o.title)+'"><header><h3>'+esc(o.title)+'</h3><button class="x" data-act="close" aria-label="Đóng">'+IC.x+'</button></header><div class="bd">'+o.body+'</div>'+(o.foot?'<footer>'+o.foot+'</footer>':'')+'</div></div>';
  const f=$('#modal input[type=text],#modal input[type=number]');if(f)f.focus();
}
const closeModal=()=>{$('#modal').innerHTML='';pick=null};
function logoHTML(px){
  const inner=S.logo?'<img src="'+S.logo+'" alt="Logo Trường Đại học Công Thương" style="width:'+px+'px;height:'+px+'px">':'<div class="logo-ph" style="width:'+px+'px;height:'+px+'px;font-size:'+Math.round(px/4)+'px">HUIT</div>';
  return '<button class="logo-btn" data-act="logo" title="Bấm để thay bằng logo của trường" aria-label="Thay logo trường"><div class="logo-wrap">'+inner+'</div></button>';
}
// Chuyển đổi Excel date serial (số nguyên như 46034) thành chuỗi 'yyyy-mm-dd'.
// Excel dùng mốc 1/1/1900 (Windows datemode=0). Nếu serial không phải ngày hợp lệ, trả về null.
function excelSerialToDate(serial){
  // Chỉ xử lý serial hợp lý: từ 1/1/1990 (~32874) đến 31/12/2099 (~73050)
  const n=Number(serial);
  if(!Number.isFinite(n)||n<32874||n>73050)return null;
  // Mốc Excel: ngày 0 = 0/1/1900, nhưng Excel có lỗi tháng 2/1900 (serial 60),
  // nên cộng thêm offset cho đúng: dùng Date(1899,11,30) làm mốc
  const ms=(n-1)*86400000; // ms kể từ 31/12/1899
  const epoch=new Date(1899,11,30);
  const d=new Date(epoch.getTime()+ms);
  if(isNaN(d.getTime()))return null;
  return validDate(d.getFullYear(),d.getMonth()+1,d.getDate());
}
function readTable(f){return new Promise((res,rej)=>{
  const r=new FileReader();
  r.onerror=()=>rej(new Error('Không đọc được file.'));
  if(/\.xlsx?$/i.test(f.name)){
    if(typeof XLSX==='undefined'){rej(new Error('Chưa tải được thư viện đọc Excel. Hãy lưu file dạng CSV rồi thử lại.'));return}
    r.onload=()=>{try{const wb=XLSX.read(r.result,{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];res(XLSX.utils.sheet_to_json(ws,{header:1,raw:false,dateNF:'dd/mm/yyyy',blankrows:false}))}catch(e){rej(new Error('File Excel không hợp lệ.'))}};
    r.readAsArrayBuffer(f);
  }else{
    r.onload=()=>{const t=String(r.result).replace(/^\uFEFF/,'');const lines=t.split(/\r?\n/).filter(x=>x.trim());const sep=t.indexOf('\t')>=0?'\t':(t.indexOf(';')>=0?';':',');res(lines.map(l=>l.split(sep).map(x=>x.trim().replace(/^"|"$/g,''))))};
    r.readAsText(f);
  }
})}
function validDate(y,m,d){const dt=new Date(y,m-1,d);if(dt.getFullYear()!==y||dt.getMonth()!==m-1||dt.getDate()!==d)return null;return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
function parseDate(v){
  if(v instanceof Date && !isNaN(v.getTime())) return validDate(v.getFullYear(),v.getMonth()+1,v.getDate());
  v=String(v==null?'':v).trim();
  // ISO date/datetime from Excel or API
  let m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T|\s)/);
  if(m)return validDate(+m[1],+m[2],+m[3]);
  // Vietnamese dd/mm/yyyy; allow 2-digit years and common separators.
  m=v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if(m){
    let a=+m[1],b=+m[2],y=+m[3];if(y<100)y+=2000;
    return validDate(y,b,a)||validDate(y,a,b);
  }
  // Excel date serial: số thuần (ví dụ "46034" hoặc "46034.0") khi SheetJS không format được cell ngày.
  // Dùng khoảng 32874 (~01/01/1990) đến 73050 (~31/12/2099) để tránh nhầm với STT nhỏ.
  m=v.match(/^(\d{5,}(?:\.\d*)?)$/);
  if(m){const d=excelSerialToDate(parseFloat(m[1]));if(d)return d;}
  return null;
}
function plain(v){return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[\u00a0\u200b\ufeff]/g,' ').replace(/\s+/g,' ').trim()}
function parsePeriod(v){const m=String(v||'').match(/(\d{1,2})\s*[→>-]\s*(\d{1,2})/);return m&&+m[1]<+m[2]&&+m[1]>=1&&+m[2]<=12?{start:+m[1],end:+m[2],key:+m[1]+'-'+(+m[2])}:null}
function parseExamSlot(v){const r=parsePeriod(v);if(r){const x=EXAM_SLOTS.find(s=>s[1]===r.start&&s[2]===r.end);return{start:r.start,end:r.end,label:x?x[0]:r.start+' → '+r.end}}const m=plain(v).match(/(?:ca\s*)?([1-4])(?:\D|$)/);if(!m)return null;const x=EXAM_SLOTS[[0,2,5,7][+m[1]-1]];return{start:x[1],end:x[2],label:x[0]}}
function teachName(rows,key){const r=rows.find(x=>x.name.trim().toLocaleLowerCase('vi')===key);return r?r.name:key}

