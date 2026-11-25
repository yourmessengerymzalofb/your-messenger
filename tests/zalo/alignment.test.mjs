import {resolver as __resolver} from '../_root.mjs';const R=__resolver('zalo');
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import postcss from 'postcss';
const root=R(''),read=p=>readFile(R(p),'utf8');
const source=postcss.parse(await read('reference/v2/ym.css')),css=postcss.parse(await read('extension/vendor/v2.css'));
const decl=(ast,selector,key)=>{let value;ast.walkRules(r=>{if(r.selectors.includes(selector))r.walkDecls(key,d=>value=d.value);});return value;};
test('v100 CSS title/menu/cream/purple/fonts/taskbar and conversation geometry are exact',async()=>{
 for(const key of ['--purple','--light','--cream','--edge','--title1','--title2','--title3'])assert.equal(decl(css,'html[data-yzr-active]',key),decl(source,':root',key));
 for(const[selector,keys]of [['.titlebar',['height','background','font-size','padding']],['.menubar',['height','background','font-size']],['.titlebar:before',['height','width','background']],['.messages',['font','line-height']],['.format-options',['height','gap']],['.avatar-column',['border-left']]])for(const key of keys)assert.equal(decl(css,'html[data-yzr-active] '+selector,key),decl(source,selector,key),selector+'/'+key);
 const xp=postcss.parse(await read('reference/v2/xp.css'));for(const key of ['background','border-top','font','color'])assert.equal(decl(css,'html[data-yzr-active] .xp-taskbar',key),decl(xp,'.xp-taskbar',key),'taskbar/'+key);
 const conv=postcss.parse(await read('reference/v2/conversations.css'));for(const[sel,key]of [['.conversation-window','min-height'],['.conversation-window','height'],['.conversation-window .toolbar','height'],['.conversation-window .toolbar img','height'],['.conversation-window .toolbar img','width'],['.conversation-window .avatar-column','width'],['.conversation-window .big-avatar','width']])assert.equal(decl(css,'html[data-yzr-active] '+sel,key),decl(conv,sel,key));
 const body=decl(source,'body','font');assert.match(await read('extension/skin.css'),new RegExp(body.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
test('Source CSS and bundled icons/wallpaper/sounds keep snapshot hashes',async()=>{
 const p=JSON.parse(await read('reference/provenance.json'));assert.equal(p.commit,'21fce76353a607e7e1ce54e8d71d52a6caaa6981');
 for(const[name,hash]of Object.entries(p.css))assert.equal(createHash('sha256').update(await readFile(new URL('reference/v2/'+name,root))).digest('hex'),hash);
 // Left out of Your Messenger on purpose: nothing in the skin uses them (0.3 release clean-up).
 const removed=new Set(['assets/buzz.wav','assets/door.wav','assets/type.wav','icons/app.svg','icons/audible.svg','icons/group.svg']);
 // The snapshot hashed text assets with CRLF line ends; the files are stored with LF, so an SVG may match either form.
 const sha=b=>createHash('sha256').update(b).digest('hex'),crlf=b=>Buffer.from(b.toString('latin1').replace(/\r?\n/g,'\r\n'),'latin1');
 for(const[name,hash]of Object.entries(p.assets))if(!removed.has(name)){const b=await readFile(R('extension/'+name));assert.ok(sha(b)===hash||name.endsWith('.svg')&&sha(crlf(b))===hash,name);}
});
async function boot(html='<section id="panel"><header id="bar"></header><div id="chat-box-input-container-id"><button title="Gửi" id="native">Send</button></div></section>',width=1366,height=768){const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://chat.zalo.me/'}),w=dom.window;Object.defineProperty(w,'innerWidth',{value:width,writable:true});Object.defineProperty(w,'innerHeight',{value:height,writable:true});for(const file of ['windows.js','actions.js','buddies.js'])w.eval(await read('extension/'+file));return {dom,w,root:w.document.querySelector('#panel')};}
function pointer(w,target,type,x,y){const e=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(e,'pointerId',{value:1});target.dispatchEvent(e);}
test('Window manager drag, all 8 resize edges, minimize/restore/maximize and cleanup',async()=>{
 const {dom,w,root}=await boot();const original=root.getAttribute('style'),wm=w.YahooZaloWindows(),bar=root.querySelector('#bar');wm.bind(root,bar,'conversation');
 assert.equal(root.querySelectorAll('.window-resize-handle').length,8);
 const val=k=>parseFloat(root.style.getPropertyValue('--yzr-'+k));const x=val('x');pointer(w,bar,'pointerdown',500,100);pointer(w,bar,'pointermove',520,120);pointer(w,bar,'pointerup',520,120);assert.equal(val('x'),x+20);
 for(const dir of ['n','ne','e','se','s','sw','w','nw']){const handle=root.querySelector('.resize-'+dir);handle.dispatchEvent(new w.KeyboardEvent('keydown',{key:dir.includes('w')?'ArrowLeft':dir.includes('n')?'ArrowUp':'ArrowRight',bubbles:true,cancelable:true}));assert.ok(val('w')>=360);assert.ok(val('h')>=380);}
 wm.minimize(root);assert.ok(root.hasAttribute('data-yzr-minimized'));wm.restore(root);assert.ok(!root.hasAttribute('data-yzr-minimized'));wm.maximize(root);assert.ok(root.classList.contains('maximized'));wm.maximize(root);assert.ok(!root.classList.contains('maximized'));
 wm.dispose();assert.equal(root.querySelectorAll('.yzr-resize').length,0);assert.equal(root.style.getPropertyValue('--yzr-x'),'');dom.window.close();
});
test('375px viewport clamps window geometry without exceeding screen or taskbar',async()=>{
 const {dom,w,root}=await boot(undefined,375,844);const wm=w.YahooZaloWindows();wm.bind(root,root.querySelector('#bar'),'conversation');const r=Object.fromEntries(['x','y','w','h'].map(k=>[k,parseFloat(root.style.getPropertyValue('--yzr-'+k))]));assert.ok(r.x>=0&&r.x+r.w<=375);assert.ok(r.y>=0&&r.y+r.h<=814);wm.dispose();dom.window.close();
});
test('Desktop defaults use v100 placement and remaining-height formulas at 1920 and 1366',async()=>{
 for(const [width,height]of [[1920,945],[1366,768]]){const {dom,w,root}=await boot(undefined,width,height),wm=w.YahooZaloWindows();wm.bind(root,root.querySelector('#bar'),'conversation');const value=k=>parseFloat(root.style.getPropertyValue('--yzr-'+k));assert.equal(value('x'),410);assert.equal(value('y'),60);assert.equal(value('w'),570);assert.equal(value('h'),Math.min(640,height-30-80));wm.dispose();dom.window.close();}
});
test('Native controls require a trusted user click and a complete pointer/mouse sequence',async()=>{
 const {dom,w,root}=await boot();let sent=0;const sequence=[];for(const type of ['pointerdown','mousedown','pointerup','mouseup','click'])root.querySelector('#native').addEventListener(type,()=>sequence.push(type));root.querySelector('#native').onmousedown=()=>sent++;assert.equal(w.YahooZaloActions.resolve(root,'send').id,'native');assert.equal(sent,0);assert.equal(w.YahooZaloActions.invoke(root,'send'),false);assert.equal(w.YahooZaloActions.invoke(root,'send',{type:'click',isTrusted:false}),false);assert.equal(w.YahooZaloActions.invoke(root,'send',{type:'click',isTrusted:true}),true);assert.equal(sent,1);assert.deepEqual(sequence,['pointerdown','mousedown','pointerup','mouseup','click']);
 const duplicate=w.document.createElement('button');duplicate.title='Gửi';root.querySelector('#chat-box-input-container-id').append(duplicate);assert.equal(w.YahooZaloActions.resolve(root,'send'),null);assert.equal(w.YahooZaloActions.invoke(root,'send'),false);duplicate.dataset.yzrOwned='';assert.equal(w.YahooZaloActions.resolve(root,'send').id,'native');root.querySelector('#native').disabled=true;assert.equal(w.YahooZaloActions.resolve(root,'send'),null);assert.equal(w.YahooZaloActions.resolve(root,'video'),null);dom.window.close();
});
test('Group markers classify groups; row status never invents presence',async()=>{
 const {dom,w}=await boot('<div id="panel"><p class="msg-item">Đang online group chat</p></div>');const row=w.document.querySelector('.msg-item');assert.equal(w.YahooZaloBuddy.classify(row),'Friends');row.setAttribute('data-group','true');assert.equal(w.YahooZaloBuddy.classify(row),'Group');row.removeAttribute('data-group');row.setAttribute('data-presence','online');assert.equal(w.YahooZaloBuddy.classify(row),'Friends');const badge=w.document.createElement('span');badge.dataset.presence='online';row.append(badge);assert.equal(w.YahooZaloBuddy.classify(row),'Friends');dom.window.close();
});
