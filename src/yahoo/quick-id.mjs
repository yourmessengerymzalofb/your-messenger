/* Y! ID in one click. Signed out, the Yahoo list (in the guest YM! window, boot.mjs)
   holds this prompt: a suggested nick and a button that creates the account with a generated
   password, then signs in through Yahoo's own form (so the client's prefs and hand-off stay as
   they are). The register call goes out directly: Yahoo's form always sends an e-mail field, and
   the live server refuses an empty one while it accepts none at all.
   The password stays in chrome.storage.local (key ymQuickId), never in Zalo's page storage; it is
   shown once to copy and signs the user in again when the session ends. Nothing from Zalo or
   Facebook is used for the nick.
   Guest ID: signed out with no saved ID (a first load of the plugin, say), the plugin makes one by
   itself (guest_ and six digits) and signs in, so BUZZ, games and Y! friends work at once. On by
   default (chrome.storage.local ymAutoGuest false turns it off). Never for a browser that already has
   an ID (a remembered nick in Yahoo's form, whose session simply ended), nor after Đăng xuất of a
   saved one: those keep Yahoo's sign-in and the quick button.
   Renaming it needs a nickname-change API on the YM v2 server, which does not exist yet. */
import {ymFetch} from './net.mjs';
export const QUICK_KEY='ymQuickId';
const KEY=QUICK_KEY;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
const WORDS=['meo','gau','tho','cun','sao','may','gio','nang','mua','bong','keo','buzz'];
const MOODS=['hoainiem','vuive','dethuong','xinhxan','tinhnghich','lamlinh','ngaytho','buzz'];
const NICK=/^[a-z0-9._-]{3,24}$/i,GUEST_TRIES=3;
const pick=(list,rand)=>list[rand(list.length)];
const randomInt=n=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%n;};
export function suggestNick(rand=randomInt){return pick(WORDS,rand)+'_'+pick(MOODS,rand)+String(10+rand(90));}
export function guestNick(rand=randomInt){return 'guest_'+String(100000+rand(900000));}
// 16 characters without look-alikes (0/O, 1/l/I), for when the user copies it by hand.
export function makePassword(rand=randomInt){const a='abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<16;i++)s+=a[rand(a.length)];return s;}

export function startQuickId(root,{store=globalThis.chrome?.storage?.local,rand=randomInt,timeout=30000}={}){
  const $=s=>root.querySelector(s),screen=$('#auth-screen'),form=$('#auth-form'),boot=$('#boot');
  if(!screen||!form||!boot||!store)return null;
  const read=async()=>{try{return (await store.get({[KEY]:null}))?.[KEY]||null;}catch{return null;}};
  const save=v=>{try{return store.set({[KEY]:v});}catch{}};
  const signedIn=()=>root.classList.contains('xp-signed-in');
  const autoOn=async()=>{try{return (await store.get({ymAutoGuest:true}))?.ymAutoGuest!==false;}catch{return false;}};
  // Yahoo's form shows the remembered nick: this browser already has an ID.
  const hasId=()=>!!$('#auth-nick')?.value.trim();
  const loginShown=()=>!signedIn()&&boot.hidden&&(screen.dataset.mode||'login')==='login';

  const prompt=el('section','ym-yahoo-join');prompt.setAttribute('aria-label','Đăng ký Y! ID');
  const card=el('div','ym-quick-id');card.hidden=true;
  const nick=el('input');nick.maxLength=24;nick.spellcheck=false;nick.autocapitalize='none';nick.setAttribute('aria-label','Y! ID muốn tạo');
  const dice=el('button','classic-button','🎲');dice.type='button';dice.title='Gợi ý nick khác';
  const create=el('button','classic-button ym-quick-create','Tạo Y! ID');create.type='button';
  const row=el('div','ym-quick-row');row.append(nick,dice);
  card.append(row,create,el('small','','Mật khẩu được tạo tự động, lưu trong plugin trên máy này để tự đăng nhập. Bạn sẽ thấy nó một lần để chép lại.'));
  // A saved ID (after Đăng xuất, or a failed automatic sign-in): one click back in.
  const quick=el('button','classic-button ym-quick-login');quick.type='button';quick.hidden=true;
  const error=el('p','error');error.setAttribute('role','status');
  const login=el('button','login-link ym-join-login','Đã có Y! ID? Đăng nhập');login.type='button';
  prompt.append(el('b','','YM!'),
    el('p','','Zalo và Facebook dùng được ngay. Đăng ký Y! ID để BUZZ!!!, chơi game, gọi webcam và chat với bạn bè Y!'),
    card,quick,error,login,
    el('small','ym-join-note','Your Messenger · dự án hoài niệm phi thương mại, không liên kết với Yahoo, Zalo hay Meta.'));
  // Yahoo's sign-in window is hidden while the guest window shows; "Để sau" hides it again.
  login.addEventListener('click',()=>{root.dataset.ymAuth='open';$('#auth-nick')?.focus();});
  const later=el('button','login-link ym-auth-later','Để sau');later.type='button';
  later.addEventListener('click',()=>delete root.dataset.ymAuth);
  $('.login-links')?.append(later);

  nick.value=suggestNick(rand);
  dice.addEventListener('click',()=>{nick.value=suggestNick(rand);error.textContent='';});

  // Sign in with Yahoo's own form: same request, prefs and hand-off as a typed sign-in.
  function submit(nickname,password){
    const tab=$('#login-tab');
    if((screen.dataset.mode||'login')!=='login'&&tab&&!tab.hidden)tab.click();
    $('#auth-nick').value=nickname;$('#auth-password').value=password;$('#auth-confirm').value='';
    for(const[id,on]of[['#auth-remember',true],['#auth-auto',true],['#auth-invisible',false]]){const box=$(id);if(box)box.checked=on;}
    $('#auth-error').textContent='';form.requestSubmit();
    return outcome();
  }
  // A new ID without an e-mail field (none to recover with: the plugin keeps the password).
  async function register(nickname,password){
    try{
      const r=await ymFetch('/api/auth/register',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname,password,remember:true,invisible:false})});
      let value={};try{value=await r.json();}catch{}
      return r.ok?{ok:true}:{ok:false,error:value.error||'Máy chủ chưa phản hồi. Thử lại nhé.'};
    }catch{return {ok:false,error:'Máy chủ chưa phản hồi. Thử lại nhé.'};}
  }
  // Signed in, or the form's error line: whichever comes first.
  function outcome(){
    return new Promise(resolve=>{
      const message=$('#auth-error');let timer=0;
      const done=r=>{clearTimeout(timer);watch.disconnect();resolve(r);};
      const check=()=>{if(signedIn())done({ok:true});else if(message.textContent.trim())done({ok:false,error:message.textContent.trim()});};
      const watch=new MutationObserver(check);
      watch.observe(root,{attributes:true,attributeFilter:['class']});watch.observe(message,{childList:true,characterData:true,subtree:true});
      timer=setTimeout(()=>done({ok:false,error:'Máy chủ chưa phản hồi. Thử lại nhé.'}),timeout);check();
    });
  }
  let busy=false;
  async function signIn(saved){
    if(busy)return;busy=true;error.textContent='Đang đăng nhập '+saved.nickname+'…';
    const r=await submit(saved.nickname,saved.password);busy=false;
    error.textContent=r.ok?'':r.error;
  }
  // Creates nickname with a generated password and signs in. auto: the guest ID the plugin makes by itself.
  async function make(nickname,{auto=false}={}){
    busy=true;create.disabled=true;error.textContent=auto?'Đang tạo Y! ID khách '+nickname+'…':'Đang tạo Y! ID…';
    const password=makePassword(rand);
    // Saved first: if the reply is lost after the server made the ID, the password is not.
    await save({nickname,password,created:Date.now(),pending:true,...auto?{guest:true}:{}});
    const made=await register(nickname,password);
    if(!made.ok){busy=false;create.disabled=false;try{await store.remove?.(KEY);}catch{}return made;}
    // The ID exists and its password is saved: keep it even if opening the desktop fails.
    await save({nickname,password,created:Date.now(),...auto?{guest:true}:{}});
    error.textContent='Đã tạo '+nickname+', đang mở YM!…';
    const r=await submit(nickname,password);
    busy=false;create.disabled=false;
    if(r.ok){error.textContent='';reveal(nickname,password,{auto});return {ok:true};}
    // From now on the quick button signs in with it.
    card.hidden=true;quick.hidden=false;quick.textContent='Đăng nhập nhanh: '+nickname;
    error.textContent='Đã tạo '+nickname+' nhưng chưa đăng nhập được: '+r.error;
    return {ok:true};
  }
  create.addEventListener('click',async()=>{
    const nickname=nick.value.trim().toLowerCase();
    if(!NICK.test(nickname)){error.textContent='Nick cần 3–24 ký tự: chữ không dấu, số, dấu . _ hoặc -.';return;}
    if(busy)return;
    const made=await make(nickname);
    if(!made.ok){
      error.textContent=made.error;
      if(/đã có người dùng/i.test(made.error)){nick.value=suggestNick(rand);error.textContent=made.error+' Mình gợi ý nick khác, bấm Tạo lần nữa nhé.';}
    }
  });
  // The guest ID: a few tries past taken numbers; on failure the create card stays for the user.
  async function autoGuest(){
    for(let i=0;i<GUEST_TRIES;i++){
      const made=await make(guestNick(rand),{auto:true});
      if(made.ok||!/đã có người dùng/i.test(made.error||'')){if(!made.ok)error.textContent=made.error;return;}
    }
    error.textContent='Chưa tạo được Y! ID khách. Bạn bấm Tạo Y! ID nhé.';
  }
  quick.addEventListener('click',async()=>{const s=await read();if(s?.password){await save({...s,out:false});void signIn(s);}});

  // The new password, once, in a dialog of our own: Yahoo closes and reuses its #dialog while the
  // desktop opens.
  function reveal(nickname,password,{auto=false}={}){
    const dialog=el('dialog','ym-quick-dialog'),title=el('div','titlebar'),x=el('button','','×');x.type='button';x.setAttribute('aria-label','Đóng');
    title.append(el('span','','Y! ID của bạn'),x);
    const body=el('div','ym-quick-done'),code=el('code','ym-quick-password',password),copy=el('button','classic-button','Chép mật khẩu'),ok=el('button','classic-button','Đã lưu');
    copy.type=ok.type='button';
    copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(password);copy.textContent='Đã chép';}catch{getSelection()?.selectAllChildren(code);copy.textContent='Bấm Ctrl+C để chép';}});
    const close=()=>{dialog.close();dialog.remove();};
    ok.addEventListener('click',close);x.addEventListener('click',close);
    const id=el('p');id.append('Y! ID: ',el('b','',nickname));
    const actions=el('p','ym-quick-actions');actions.append(copy,ok);
    body.append(...auto?[el('p','','Plugin đã tự tạo Y! ID khách cho bạn để BUZZ!!!, chơi game và chat với bạn bè Y! ngay.')]:[],id,el('p','','Mật khẩu (plugin đã lưu trên máy này để tự đăng nhập; chép lại nếu muốn đăng nhập ở máy khác hoặc trên web YM v2):'),code,actions);
    dialog.append(title,body);root.append(dialog);dialog.showModal();
  }

  // Signed out: the create card, or the quick button for a saved ID; one automatic sign-in per page
  // with a saved ID, unless the user signed out of it.
  let first=true,wasIn=false,deciding=false;
  async function update(){
    if(signedIn()){wasIn=true;first=false;return;}
    if(wasIn){wasIn=false;const s=await read();if(s)await save({...s,out:true});}
    if(!loginShown()||deciding||busy)return;
    deciding=true;const saved=await read();deciding=false;
    if(signedIn()||!loginShown())return;
    card.hidden=!!saved?.password;quick.hidden=!saved?.password;if(saved)quick.textContent='Đăng nhập nhanh: '+saved.nickname;
    if(first){first=false;
      if(saved?.password&&!saved.out)void signIn(saved);
      // No ID yet, none half-made and no remembered nick: the guest ID (unless turned off).
      else if(!saved&&!hasId()&&await autoOn()&&!signedIn()&&loginShown()&&!busy)void autoGuest();}
  }
  const watch=new MutationObserver(()=>void update());
  watch.observe(root,{attributes:true,attributeFilter:['class']});
  watch.observe(boot,{attributes:true,attributeFilter:['hidden']});
  watch.observe(screen,{attributes:true,attributeFilter:['data-mode']});
  void update();
  return {prompt,card,quick,update};
}
