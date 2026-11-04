import {resolver as __resolver} from '../_root.mjs';const R=__resolver('zalo');
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {virtual} from './native-virtual-fixture.mjs';
const read=p=>readFile(R(''+p),'utf8'),fixture=await read('demo/index.html'),trusted={type:'click',isTrusted:true};
async function boot(query=''){const dom=new JSDOM(fixture,{url:'https://chat.zalo.me/?'+query,runScripts:'outside-only'}),w=dom.window,d=w.document;w.chrome={runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p}};for(const f of ['actions.js','buddies.js','windows.js','transcript.js','chrome.js'])w.eval(await read('extension/'+f));if(query)w.eval(await read('demo/fixture.js'));return{dom,w,d,root:d.querySelector('#chatViewContainer')};}

test('R10 #1: missing expand button uses Ctrl+Shift+X on focused composer; empty B becomes pressed without typing',async()=>{
 const {dom,w,d,root}=await boot('rtf=keyboard&documents=1'),skin=w.YahooZaloChrome({off(){}});skin.sync(d.querySelector('#sidebarNav'),root);assert.equal(w.YahooZaloActions.resolve(root,'expand'),null);const b=root.querySelector('.format-options [data-yzr-action=bold]');assert.equal(b.hasAttribute('aria-disabled'),false);assert.equal(await b.onclick(trusted),true);const editor=w.YahooZaloActions.activeEditor(root);assert.ok(editor.matches('.input-v4'));assert.equal(editor.textContent,'');assert.equal(editor.style.fontWeight,'500');assert.equal(b.getAttribute('aria-pressed'),'true');assert.equal(d.querySelector('#chat-box-input-container-id').dataset.demoKeyboardEntries,'1');assert.equal(JSON.parse(root.dataset.yzrFormatDiagnostic).phase,'applied');assert.equal(d.querySelectorAll('.chat-item').length,48);skin.dispose();dom.window.close();
});

test('R10 #1: collapsed native toggle applies only newly typed text, never the preceding word',async()=>{
 const {dom,w,d,root}=await boot('rtf=1&documents=1');await w.YahooZaloActions.richEditorReady(root,trusted);const editor=w.YahooZaloActions.activeEditor(root);editor.textContent='abc';editor.focus();const range=d.createRange();range.selectNodeContents(editor);range.collapse(false);w.getSelection().removeAllRanges();w.getSelection().addRange(range);let commands=0;d.execCommand=()=>{commands++;throw Error('Browser command must not drive the native model');};assert.equal(await w.YahooZaloActions.formatRich(root,'bold',trusted),true);assert.equal(editor.textContent,'abc');assert.equal(editor.getAttribute('style'),null);assert.equal(w.YahooZaloActions.formatPressed(root,'bold'),true);
 editor.dispatchEvent(new w.InputEvent('beforeinput',{bubbles:true,inputType:'insertText',data:'def'}));const text=d.createTextNode('def'),insert=w.getSelection().getRangeAt(0);insert.insertNode(text);insert.setStartAfter(text);insert.collapse(true);w.getSelection().removeAllRanges();w.getSelection().addRange(insert);editor.dispatchEvent(new w.InputEvent('input',{bubbles:true,inputType:'insertText',data:'def'}));assert.equal(await w.YahooZaloActions.flushFormatting(root),true);assert.equal(editor.textContent,'abcdef');assert.equal(editor.firstChild.textContent,'abc');assert.equal(editor.querySelector('span').textContent,'def');assert.equal(editor.querySelector('span').style.fontWeight,'500');assert.equal(w.YahooZaloActions.selectionBookmark(editor).start,6);assert.equal(commands,0);dom.window.close();
});

test('R10 #1: caret and nonempty selection survive keyboard RTF replacement without draft mutation',async()=>{
 for(const [start,end]of [[1,1],[1,3]]){const {dom,w,d,root}=await boot('rtf=keyboard'),editor=d.querySelector('#richInput');editor.textContent='abcd';editor.focus();const r=d.createRange();r.setStart(editor.firstChild,start);r.setEnd(editor.firstChild,end);w.getSelection().removeAllRanges();w.getSelection().addRange(r);const rich=await w.YahooZaloActions.richEditorReady(root,trusted);assert.equal(rich.textContent,'abcd');const bookmark=w.YahooZaloActions.selectionBookmark(rich);assert.equal(bookmark.start,start);assert.equal(bookmark.length,end-start);assert.equal(w.getSelection().toString(),'abcd'.slice(start,end));dom.window.close();}
});

test('R10 #1: native colour and size commands can be chosen before typing, after keyboard RTF entry',async()=>{
 for(const[key,prop,value]of [['color','color','rgb(170, 0, 0)'],['fontSize','fontSize','20px']]){const {dom,w,d,root}=await boot('rtf=keyboard'),skin=w.YahooZaloChrome({off(){}});skin.sync(d.querySelector('#sidebarNav'),root);assert.equal(await root.querySelector('.format-options [data-yzr-action='+key+']').onclick(trusted),true);const editor=w.YahooZaloActions.activeEditor(root);assert.equal(editor.textContent,'');assert.equal(editor.style[prop],value);assert.ok(root.querySelector('.yzr-sendbar .send'));skin.dispose();dom.window.close();}
});

test('R10 #1: composer native500 is visually700, retains inline style and restores on off',async()=>{
 const {dom,w,d,root}=await boot(),editor=d.querySelector('#richInput'),span=d.createElement('span');span.style.cssText='font-weight:500;font-style:italic;text-decoration:underline;color:red';span.textContent='Fake';editor.append(span);const t=w.YahooZaloTranscript();t.sync(root,'Fake',false);assert.ok(span.hasAttribute('data-yzr-semibold'));assert.equal(span.style.fontWeight,'500');t.clear();assert.equal(span.hasAttribute('data-yzr-semibold'),false);assert.equal(span.style.fontStyle,'italic');assert.equal(span.style.color,'red');assert.match(await read('extension/skin.css'),/#chat-box-input-container-id \[data-yzr-semibold\]\{font-weight:700!important/);dom.window.close();
});

test('R10 #2: native own/peer multiline text wrappers are inline only through first DIV, without reparenting',async()=>{
 const {dom,w,d,root}=await boot();const history=d.querySelector('#messageViewScroll');for(const own of [true,false]){const row=d.createElement('div');row.className='chat-item'+(own?' me':'');row.innerHTML='<div class="message-content-render"><div class="card message-frame"><div class="text-message__container"><div><span-15><div class="editor-input"><div><span>First</span></div><div><span>Second</span></div></div></span-15></div></div><div class="card-send-time">00:00</div></div></div>';const text=row.querySelector('.editor-input'),parent=text.parentElement;history.append(row);const t=w.YahooZaloTranscript();t.sync(root,'Peer',false);assert.equal(row.getAttribute('data-yzr-sender'),own?'Bạn:':'Peer:');for(let n=text;n&&n!==row;n=n.parentElement)assert.ok(n.hasAttribute('data-yzr-inline-flow'));assert.ok(text.firstElementChild.hasAttribute('data-yzr-first-text-line'));assert.equal(text.lastElementChild.hasAttribute('data-yzr-first-text-line'),false);assert.equal(text.parentElement,parent);assert.equal(row.querySelector('.card-send-time').hasAttribute('data-yzr-inline-flow'),false);t.clear();assert.equal(text.parentElement,parent);assert.equal(text.hasAttribute('data-yzr-inline-flow'),false);}dom.window.close();
});

// Current chat.zalo.me markup (fake text): no .editor-input, a message-text-content block instead.
test('Real Zalo regression: current text markup keeps the nick on the same line as the message',async()=>{
 const {dom,w,d,root}=await boot();const history=d.querySelector('#messageViewScroll'),row=d.createElement('div');row.className='chat-item flx';
 row.innerHTML='<div class="chat-content flx flx-col"><div class="chat-message" data-component="bubble-message"><div class="message-content-render"><div class="card message-frame" data-component="message-content-view"><div><div class="message-action"><div class="text-message__container"><div><div class="overflow-hidden" data-component="message-text-content"><span-15 data-component="text-container">Có a</span-15></div></div></div></div></div><div class="card-send-time">15:42</div></div></div></div></div>';
 history.append(row);const text=row.querySelector('[data-component="message-text-content"]'),t=w.YahooZaloTranscript();t.sync(root,'Toan Laz',false);
 assert.equal(row.querySelector('.yzr-inline-sender').textContent,'Toan Laz:');
 for(let n=text;n&&n!==row;n=n.parentElement)assert.ok(n.hasAttribute('data-yzr-inline-flow'),n.className);
 assert.equal(row.querySelector('.card-send-time').hasAttribute('data-yzr-inline-flow'),false);
 t.clear();assert.equal(row.querySelector('.yzr-inline-sender'),null);assert.equal(text.hasAttribute('data-yzr-inline-flow'),false);dom.window.close();
});

test('R10 #3: free-slot check rejects info/file/cursor-pointer rows in both real viewport sizes, or hides safely',async()=>{
 for(const[width,height]of [[2133,1050],[1270,731]])for(const markup of ['<div class="cb-info-file-item"><div class="file-layout__bot-container"></div></div>','<div class="media-item library-media"></div>','<div class="some-clickable-row"></div>','<aside id="chatInfoGeneral"><div></div></aside>','<div style="cursor:pointer"></div>']){const{dom,w,d}=await boot();Object.defineProperty(w,'innerWidth',{value:width});Object.defineProperty(w,'innerHeight',{value:height});const box=d.createElement('div');box.innerHTML=markup;d.body.append(box);const file=box.firstElementChild;d.elementsFromPoint=()=>[file.firstElementChild||file,d.body];w.chrome.storage={local:{get:async()=>({yzrEnabled:false}),set:async()=>{}},onChanged:{addListener(){}}};w.chrome.runtime.onMessage={addListener(){}};w.eval(await read('extension/content.js'));await new Promise(r=>setTimeout(r,0));assert.equal(d.querySelector('#yzr-controls').hidden,true,markup);assert.equal(d.querySelector('#yzr-controls').dataset.yzrPlacement,'no-empty-slot');dom.window.close();}
});

test('R10 watch: My Documents deduplicates on reorder scan, even with whitespace/case changes',async()=>{
 const f=await virtual({count:10});f.records[0].name='My Documents';f.records[4].name=' My  Documents ';f.render();const deadline=Date.now()+4000;while(![...f.slot.querySelectorAll('.contact-row b')].some(n=>n.textContent==='My Documents')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,30));await f.buddy.whenIdle();const names=[...f.slot.querySelectorAll('.contact-row b')].map(n=>n.textContent.trim().replace(/\s+/g,' ').toLowerCase());assert.equal(names.filter(n=>n==='my documents').length,1);assert.equal(f.opened.length,0);f.buddy.clear();f.dom.window.close();
});

test('R10 #1: Ctrl+B-only native entry fallback in empty editor is not toggled twice',async()=>{
 const{dom,w,d,root}=await boot(),keys=[],composer=d.querySelector('#chat-box-input-container-id');composer.addEventListener('keydown',e=>{if(!e.ctrlKey)return;keys.push(e.key);if(e.key==='b'){const editor=d.querySelector('#richInput'),rich=d.createElement('div');rich.className='input-v4';rich.setAttribute('contenteditable','true');rich.style.fontWeight='500';editor.replaceWith(rich);e.preventDefault();}});assert.equal(await w.YahooZaloActions.formatRich(root,'bold',trusted),true);assert.deepEqual(keys,['X','b']);assert.equal(w.YahooZaloActions.activeEditor(root).textContent,'');assert.equal(JSON.parse(root.dataset.yzrFormatDiagnostic).phase,'applied');dom.window.close();
});

test('R10 #2: native .card.me marks own nick even when row lacks me; metadata sender is removed on cleanup',async()=>{
 const{dom,w,d,root}=await boot(),row=d.createElement('div');row.className='chat-item';row.innerHTML='<div class="card me"><div class="text-message__container"><div class="editor-input"><div>Own fake text</div></div></div></div>';d.querySelector('#messageViewScroll').append(row);const native=row.firstChild,t=w.YahooZaloTranscript();t.sync(root,'Peer',false);assert.equal(row.getAttribute('data-yzr-own'),'true');assert.equal(row.querySelector('.yzr-inline-sender').textContent,'Bạn:');assert.equal(native.parentNode,row);t.clear();assert.equal(row.querySelector('.yzr-inline-sender'),null);assert.equal(row.getAttribute('data-yzr-own'),null);assert.equal(native.parentNode,row);dom.window.close();
});

test('Real Zalo regression: native RTF focused class controls B state, browser pending command is ignored',async()=>{
 const{dom,w,d,root}=await boot('rtf=1');await w.YahooZaloActions.richEditorReady(root,trusted);const button=d.querySelector('[data-id=btn_RTF_Bold]');button.removeAttribute('aria-pressed');button.className='z--btn--v2 rtf-tool-button focused';d.queryCommandState=()=>false;assert.equal(w.YahooZaloActions.formatPressed(root,'bold'),true);button.classList.remove('focused');assert.equal(w.YahooZaloActions.formatPressed(root,'bold'),false);dom.window.close();
});

test('Real Zalo regression: closing a window clears pending typing and never applies a late native format',async()=>{
 const{dom,w,d,root}=await boot('rtf=1');await w.YahooZaloActions.richEditorReady(root,trusted);const editor=w.YahooZaloActions.activeEditor(root);editor.textContent='abc';const range=d.createRange();range.selectNodeContents(editor);range.collapse(false);w.getSelection().removeAllRanges();w.getSelection().addRange(range);const controller=new w.AbortController();await w.YahooZaloActions.formatRich(root,'bold',trusted,{signal:controller.signal});controller.abort();editor.dispatchEvent(new w.InputEvent('beforeinput',{bubbles:true,inputType:'insertText',data:'def'}));editor.append(d.createTextNode('def'));editor.dispatchEvent(new w.InputEvent('input',{bubbles:true,inputType:'insertText',data:'def'}));await w.YahooZaloActions.flushFormatting(root);assert.equal(editor.textContent,'abcdef');assert.equal(editor.querySelector('span'),null);dom.window.close();
});

// Current group markup (fake names): the sender sits in .message-sender-name-wrapper on the first of a run.
test('Zalo group: each text line carries its sender, also after the first of a run; own lines break the run',async()=>{
 const {dom,w,d,root}=await boot();const history=d.querySelector('#messageViewScroll');
 const text=(name,body,own)=>{const row=d.createElement('div');row.className='chat-item flx'+(own?' me':'');row.innerHTML=(name?'<div class="message-sender-name-wrapper message-sender-name-wrapper--fit-width"><div class="opacity-0">a</div><div class="message-sender-name-bubble"><div class="message-sender-name-content-wrapper"><div class="message-sender-name-content clickable"><div class="truncate">'+name+'</div></div></div></div></div>':'')+'<div class="text-message__container"><div data-component="message-text-content"><span-15>'+body+'</span-15></div></div><div class="card-send-time">22:16</div>';history.append(row);return row;};
 const rows=[text('Lan','một'),text('','hai'),text('','của tôi',true),text('','ba')];
 const t=w.YahooZaloTranscript();t.sync(root,'Nhóm giả',true);
 assert.deepEqual(rows.map(r=>r.querySelector('.yzr-inline-sender')?.textContent??null),['Lan:','Lan:','Bạn:',null]);
 const css=await read('extension/skin.css');
 assert.match(css,/#messageViewScroll \.message-sender-name-wrapper,[^{]*\{display:none!important/);
 t.clear();dom.window.close();
});

test('Zalo reactions stay at their own message, inside the window, including under the last one',async()=>{
 const css=await read('extension/skin.css');
 assert.match(css,/#messageViewScroll \.chat-item\{display:block!important;position:relative!important;padding-right:34px!important/,'each line is the reactions\' box, with a right gutter for them');
 assert.match(css,/#messageViewScroll \.chat-item \.message-reaction-container\{top:auto!important;bottom:-11px!important;right:4px!important\}/);
 assert.match(css,/#messageViewScroll \.chat-item div:has\(> \.message-reaction-container\)\{position:static!important\}/,'album reactions stay inside the window');
 assert.match(css,/#messageViewScroll\{padding:10px 10px 24px!important\}/,'room under the last message');
 assert.match(css,/\[data-yzr-has-typing=true\] #messageViewScroll\{padding-bottom:44px!important\}/);
});
