import {resolver as __resolver} from '../_root.mjs';const R=__resolver('zalo');
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import postcss from 'postcss';
import {virtual} from './native-virtual-fixture.mjs';
const read=p=>readFile(R(''+p),'utf8'),fixture=await read('demo/index.html'),trusted={type:'click',isTrusted:true};
async function boot(){const dom=new JSDOM(fixture,{url:'https://chat.zalo.me/',runScripts:'outside-only'}),w=dom.window;w.chrome={runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p}};for(const f of ['actions.js','buddies.js','windows.js','transcript.js','chrome.js'])w.eval(await read('extension/'+f));return{dom,w,d:w.document};}
test('R8 #1: native 500ms delayed rendering reaches first 30; no fixed 90ms acknowledgement',async()=>{
 const f=await virtual({renderDelay:500});assert.equal(f.slot.querySelectorAll('.contact-row').length,30);assert.equal(f.slot.querySelector('[role=alert]').hidden,true);const stats=JSON.parse(f.slot.querySelector('.yzr-buddy-groups').dataset.yzrScan);assert.equal(stats.attempt,1);assert.equal(stats.renderTimeout,false);assert.equal(f.top,0);assert.equal(f.opened.length,0);assert.doesNotMatch(await read('extension/buddies.js'),/setTimeout\(resolve,90\)/);f.buddy.clear();f.dom.window.close();
});
test('R8 #1: render timeout counts only after ~2s; entire scan retries automatically once',async()=>{
 const f=await virtual({renderDelay:500,initialRenderDelay:2400});assert.equal(f.slot.querySelectorAll('.contact-row').length,30);const stats=JSON.parse(f.slot.querySelector('.yzr-buddy-groups').dataset.yzrScan);assert.equal(stats.attempt,2);assert.equal(f.slot.querySelector('[role=alert]').hidden,true);assert.equal(f.top,0);f.buddy.clear();f.dom.window.close();
});
test('R8 #1: permanent unrenderable range stops after two attempts; retry error wording matches button',async()=>{
 const f=await virtual({renderDelay:10000});assert.equal(f.slot.querySelector('.yzr-list-footer button').textContent,'Thử tải lại');assert.match(f.slot.querySelector('[role=alert]').textContent,/Thử tải lại/);assert.doesNotMatch(f.slot.querySelector('[role=alert]').textContent,/Bấm Tải thêm/);assert.equal(JSON.parse(f.slot.querySelector('.yzr-buddy-groups').dataset.yzrScan).attempt,2);assert.equal(f.opened.length,0);f.buddy.clear();f.dom.window.close();
});
test('R8 #2: real right-layout icon-only emoji/like wrappers are hidden and restored, handlers and native parent remain',async()=>{
 const {dom,w,d}=await boot(),skin=w.YahooZaloChrome({off(){}}),root=d.querySelector('#chatViewContainer'),nav=d.querySelector('#sidebarNav'),native=[...d.querySelectorAll('.chat-input-container__right-layout > .normal-buttons-group > .z--btn--v2')],parents=native.map(n=>n.parentNode);assert.equal(native.length,2);assert.ok(native[0].querySelector('i.fa.fa-Emoji_24_Line'));assert.ok(native[1].querySelector('.zic_svg-like-emoji-icon'));let clicks=0;native[0].onclick=()=>clicks++;skin.sync(nav,root);for(const n of native){assert.ok(n.hasAttribute('data-yzr-native-proxy'));assert.equal(n.textContent,'');}assert.equal(clicks,0);skin.clear();native.forEach((n,i)=>{assert.equal(n.hasAttribute('data-yzr-native-proxy'),false);assert.equal(n.parentNode,parents[i]);});native[0].click();assert.equal(clicks,1);skin.dispose();dom.window.close();
});
test('R8 #3: only native format-options icon is hidden; Yahoo formatting row and its space remain',async()=>{
 const {dom,w,d}=await boot(),skin=w.YahooZaloChrome({off(){}});skin.sync(d.querySelector('#sidebarNav'),d.querySelector('#chatViewContainer'));assert.ok(d.querySelector('#chatView .format-options.native-format-icon:not([data-yzr-owned])'));assert.ok(d.querySelector('#chatView .format-options[data-yzr-owned]'));const css=postcss.parse(await read('extension/skin.css'));let rule;css.walkRules(r=>{if(r.selectors.includes('html[data-yzr-active] #chatView .format-options:not([data-yzr-owned])'))rule=r;});assert.ok(rule.nodes.some(n=>n.prop==='visibility'&&n.value==='hidden'&&n.important));skin.dispose();dom.window.close();
});
// REVIEW-9 supersedes R8's no-RTF contract: T must enter the native RTF editor.
test('R8/R9: T enters native RTF but reserves the Yahoo format row space',async()=>{
 const {dom,w,d}=await boot();w.history.replaceState({},'', '?rtf=1');w.eval(await read('demo/fixture.js'));const skin=w.YahooZaloChrome({off(){}}),root=d.querySelector('#chatViewContainer');skin.sync(d.querySelector('#sidebarNav'),root);const t=root.querySelector('.format-toolbar [data-yzr-action=format]'),send=root.querySelector('.yzr-sendbar .send');for(let i=0;i<2;i++){assert.equal(await t.onclick(trusted),true);skin.sync(d.querySelector('#sidebarNav'),root);assert.ok(d.querySelector('.input-v4[contenteditable=true]'));assert.equal(root.querySelector('.yzr-sendbar .send'),send);assert.equal(send.hidden,false);assert.equal(root.hasAttribute('data-yzr-format-collapsed'),i===0);}assert.equal(d.querySelector('#chat-box-input-container-id').dataset.demoRtfActivations,'1');const css=postcss.parse(await read('extension/skin.css'));let rule;css.walkRules(r=>{if(r.selector==='html[data-yzr-active] [data-yzr-format-collapsed] .format-options[data-yzr-owned]>*')rule=r;});assert.ok(rule.nodes.some(n=>n.prop==='visibility'&&n.value==='hidden'));assert.ok(!rule.nodes.some(n=>['height','display'].includes(n.prop)));skin.dispose();dom.window.close();
});

test('R8 #5: Send has native disabled state, enables only for nonempty editor AND a unique native send',async()=>{
 const {dom,w,d}=await boot(),skin=w.YahooZaloChrome({off(){}}),root=d.querySelector('#chatViewContainer'),editor=d.querySelector('#richInput'),native=d.querySelector('#send');native.hidden=false;skin.sync(d.querySelector('#sidebarNav'),root);const send=root.querySelector('.yzr-sendbar .send');assert.equal(send.disabled,true);assert.equal(send.getAttribute('aria-disabled'),'true');assert.equal(send.title,'Nhập tin nhắn để gửi');editor.textContent='Nháp fake';skin.sync(d.querySelector('#sidebarNav'),root);assert.equal(send.disabled,false);native.remove();skin.sync(d.querySelector('#sidebarNav'),root);assert.equal(send.disabled,true);editor.textContent='\u200b';skin.sync(d.querySelector('#sidebarNav'),root);assert.equal(send.disabled,true);assert.equal(send.title,'Nhập tin nhắn để gửi');skin.dispose();dom.window.close();
});
test('R8 #6: page-level Bật Yahoo appears only on supported logged-in page while off; draft/editor survive on/off',async()=>{
 const {dom,w,d}=await boot();let message;const stored={yzrEnabled:false};w.chrome.storage={local:{get:async()=>stored,set:async value=>Object.assign(stored,value)},onChanged:{addListener(){}}};w.chrome.runtime.onMessage={addListener:fn=>message=fn};const editor=d.querySelector('#richInput');editor.textContent='Nháp tiếng Việt chưa gửi';w.eval(await read('extension/content.js'));await new Promise(r=>setTimeout(r,0));const tab=d.querySelector('#yzr-controls'),button=tab.querySelector('button');assert.equal(button.textContent,'Bật YM!');assert.equal(tab.hidden,false);button.click();await new Promise(r=>setTimeout(r,0));assert.ok(d.documentElement.hasAttribute('data-yzr-active'));assert.equal(tab.hidden,true);assert.equal(d.querySelector('#richInput'),editor);assert.equal(editor.textContent,'Nháp tiếng Việt chưa gửi');await new Promise(resolve=>message({type:'yzr:set',enabled:false},{},resolve));assert.equal(tab.hidden,false);d.querySelector('#app-page').remove();await new Promise(r=>setTimeout(r,240));assert.equal(tab.hidden,true);assert.equal(d.querySelector('#richInput'),null);dom.window.close();
});
test('Pasted images: Zalo\'s tray (1 ảnh · Xoá tất cả) enables Send with no text and lets the composer grow',async()=>{
 const {dom,w,d}=await boot(),skin=w.YahooZaloChrome({off(){}}),root=d.querySelector('#chatViewContainer'),nav=d.querySelector('#sidebarNav'),native=d.querySelector('#send');native.hidden=false;skin.sync(nav,root);
 const send=root.querySelector('.yzr-sendbar .send');assert.equal(send.disabled,true);assert.ok(!root.hasAttribute('data-yzr-attachments'));
 // Zalo 2026-11 (user DOM dump): the tray inside #chatInput, thumbnails as background images, and the
 // editor locked (contenteditable=false) while it shows.
 const tray=d.createElement('div');tray.className='chat-box-input__bottom';tray.innerHTML='<div class="input-preview-area"><div class="input-preview-area-header"><div class="input-preview-area-header__info"><span class="input-preview-area-header__count">1</span><span>ảnh</span></div><span class="input-preview-area-header__delete-all">Xoá tất cả</span></div><div class="input-preview-area__img-preview"><div class="image-preview-item" style="background-image:url(blob:https://chat.zalo.me/1)"></div></div></div>';
 (d.querySelector('#chatInput')||d.querySelector('#chat-box-input-container-id')).append(tray);d.querySelector('#richInput').setAttribute('contenteditable','false');skin.sync(nav,root);
 assert.ok(root.hasAttribute('data-yzr-attachments'),'the composer is marked to grow');
 assert.equal(send.disabled,false,'Send works for the images alone');assert.notEqual(send.title,'Nhập tin nhắn để gửi');
 const css=postcss.parse(await read('extension/skin.css'));let rule;css.walkRules(r=>{if(r.selectors.includes('html[data-yzr-active] [data-yzr-attachments] #chat-box-input-container-id'))rule=r;});
 assert.ok(rule?.nodes.some(n=>n.prop==='height'&&n.value==='auto'&&n.important),'the fixed 75px height gives way');
 let inner;css.walkRules(r=>{if(r.selectors.includes('html[data-yzr-active] [data-yzr-attachments] #chat-box-input-container-id #chatInput'))inner=r;});
 assert.ok(inner?.nodes.some(n=>n.prop==='height'&&n.value==='auto'&&n.important),'#chatInput (which holds the tray) stops filling the composer');
 native.remove();skin.sync(nav,root);assert.equal(send.disabled,true,'still needs a unique native Send');
 d.body.append(native);tray.remove();skin.sync(nav,root);assert.ok(!root.hasAttribute('data-yzr-attachments'),'Xoá tất cả / sent: back to 75px');
 skin.clear();assert.ok(!root.hasAttribute('data-yzr-attachments'));skin.dispose();dom.window.close();
});
test('The message under the pointer comes to the front, so its reaction button (hanging into the next message) stays reachable',async()=>{
 const css=postcss.parse(await read('extension/skin.css'));let rule;
 css.walkRules(r=>{if(r.selectors.includes('html[data-yzr-active] #messageViewScroll .chat-item:is(:hover,:focus-within)'))rule=r;});
 assert.ok(rule?.nodes.some(n=>n.prop==='z-index'&&Number(n.value)>0&&n.important));
 let hang;css.walkRules(r=>{if(r.selectors.includes('html[data-yzr-active] #messageViewScroll .chat-item .message-reaction-container'))hang=r;});
 assert.ok(hang.nodes.some(n=>n.prop==='bottom'&&n.value==='-11px'),'the button still hangs below its message');
});
