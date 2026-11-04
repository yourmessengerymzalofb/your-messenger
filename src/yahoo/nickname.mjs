/* One-time nickname change (Yahoo v1 server, docs/nickname-change.md there): PATCH /api/profile
   {nickname}. GET /api/account says whether the account still may (nicknameChangeable). Signed in
   with a guest_ ID, a small "Đổi nick" button sits by the profile name while it may; the change is the user's own
   click and confirmation. Afterwards the plugin's saved Y! ID (quick-id.mjs) follows the new nick,
   so the automatic sign-in keeps working. */
import {ymFetch} from './net.mjs';
import {QUICK_KEY} from './quick-id.mjs';

const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
const NICK=/^[a-z0-9._-]{3,24}$/;
// The server's own rules, checked first so the user sees the reason at once.
export function nickProblem(value){
  const nick=String(value||'').trim().toLowerCase();
  if(!NICK.test(nick))return 'Nick cần 3–24 ký tự: chữ không dấu, số, dấu . _ hoặc -.';
  if(nick.startsWith('guest_'))return 'Nick mới không được bắt đầu bằng "guest_".';
  return '';
}

export function startNicknameChange(root,{store=globalThis.chrome?.storage?.local}={}){
  const name=root.querySelector('#profile-name');if(!name)return null;
  const button=el('button','mini-button ym-nick-change','Đổi nick');button.type='button';button.hidden=true;
  button.title='Đổi nick Y! (chỉ đổi được 1 lần)';name.after(button);
  let current='',checking=0;
  // Signed in: ask the server whether this account still has its one change.
  async function check(){
    const run=++checking;button.hidden=true;
    if(!root.classList.contains('xp-signed-in'))return;
    try{
      const r=await ymFetch('/api/account',{credentials:'same-origin'}),data=await r.json();
      if(run!==checking||!root.classList.contains('xp-signed-in'))return;
      // Only guest_ IDs (the ones the plugin makes by itself) are offered the change.
      current=data?.profile?.nickname||'';button.hidden=!(data?.authenticated&&data.nicknameChangeable===true&&/^guest_/i.test(current));
    }catch{}
  }
  async function rename(nickname){
    try{
      const r=await ymFetch('/api/profile',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname})});
      let data={};try{data=await r.json();}catch{}
      return r.ok&&data.profile?{ok:true,profile:data.profile}:{ok:false,error:data.error||'Máy chủ chưa phản hồi. Thử lại nhé.'};
    }catch{return {ok:false,error:'Máy chủ chưa phản hồi. Thử lại nhé.'};}
  }
  // Yahoo keeps its own copy of the profile: re-saving the current presence through its own control
  // makes it read the profile (with the new nick) from the server's answer.
  function refreshYahoo(){const select=root.querySelector('#presence-select');select?.dispatchEvent(new Event('change',{bubbles:true}));}
  async function follow(before,after){
    try{const saved=(await store?.get?.({[QUICK_KEY]:null}))?.[QUICK_KEY];if(saved&&saved.nickname===before)await store.set({[QUICK_KEY]:{...saved,nickname:after,guest:false}});}catch{}
  }
  function open(){
    const dialog=el('dialog','ym-quick-dialog ym-nick-dialog'),title=el('div','titlebar'),x=el('button','','×');x.type='button';x.setAttribute('aria-label','Đóng');
    title.append(el('span','','Đổi nick Y!'),x);
    const form=el('form','ym-quick-done'),input=el('input');input.maxLength=24;input.spellcheck=false;input.autocapitalize='none';input.value=current;input.setAttribute('aria-label','Nick mới');
    const error=el('p','error');error.setAttribute('role','status');
    const save=el('button','classic-button','Đổi nick'),cancel=el('button','classic-button','Để sau');save.type='submit';cancel.type='button';
    const actions=el('p','ym-quick-actions');actions.append(save,cancel);
    form.append(el('p','','Nick hiện tại: '+current),el('p','','Chỉ đổi được 1 lần. Bạn bè, tin nhắn và mật khẩu giữ nguyên; nick cũ không dùng để đăng nhập được nữa.'),input,error,actions);
    const close=()=>{dialog.close();dialog.remove();};
    x.addEventListener('click',close);cancel.addEventListener('click',close);
    let busy=false;
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(busy)return;
      const nickname=input.value.trim().toLowerCase();
      const problem=nickname===current?'Nick mới đang giống nick hiện tại.':nickProblem(nickname);if(problem){error.textContent=problem;return;}
      busy=true;save.disabled=true;error.textContent='Đang đổi nick…';
      const r=await rename(nickname);busy=false;save.disabled=false;
      if(!r.ok){error.textContent=r.error;if(/một lần/i.test(r.error))button.hidden=true;return;}
      const before=current;current=r.profile.nickname||nickname;button.hidden=true;
      await follow(before,current);refreshYahoo();close();
      const toast=root.querySelector('#toast');if(toast){toast.textContent='Đã đổi nick thành '+current+'.';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3500);}
    });
    dialog.append(title,form);root.append(dialog);dialog.showModal();input.focus();input.select();
  }
  button.addEventListener('click',e=>{if(e.isTrusted)open();});
  let signed=null;
  const watch=new MutationObserver(()=>{const now=root.classList.contains('xp-signed-in');if(now!==signed){signed=now;void check();}});
  watch.observe(root,{attributes:true,attributeFilter:['class']});
  signed=root.classList.contains('xp-signed-in');void check();
  return {button,check,open,destroy(){watch.disconnect();button.remove();}};
}
