/* ========= Dữ liệu ========= */
function seed(){
  return{
    v:1,logo:LOGO,nid:1,
    users:[{id:1,name:'Quản trị viên',user:'admin',role:ROLES[0],on:true}],
    perms:{[ROLES[0]]:[1,1,1,1,1,1,0]},
    lecs:[],exams:[],dots:[],hist:[],
    soft:{S1:{on:true,w:6},S2:{on:true,w:8,n:80}}
  };
}
function load(){try{const o=JSON.parse(localStorage.getItem(KEY));if(o&&o.v===1&&o.lecs&&o.exams)return o}catch(e){}return null}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
let S=load()||seed();
// Khôi phục phiên Admin từ trang đăng nhập chung để không hiện lại form đăng nhập nội bộ.
const adminSession = sessionStorage.getItem('authRole') === 'admin';
let cur=adminSession?(S.users.find(x=>String(x.user).toLowerCase()==='admin' && x.on) || S.users.find(x=>x.id===1 && x.on) || null):null,view='home',pend=null,pendL=null,pendTeach=null,pendBusy=null,pre=null,pick=null,tab6='quota';
const F={lq:'',ld:'',eq:'',ed:'',sd:'',lack:false,xm:'lec'};
let adminAccounts=[],accountsLoading=false,accountsError='';

