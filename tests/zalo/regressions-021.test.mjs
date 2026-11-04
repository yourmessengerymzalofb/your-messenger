import {resolver as __resolver} from '../_root.mjs';const R=__resolver('zalo');
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import postcss from 'postcss';
const read=p=>readFile(R(''+p),'utf8');
const fixture=await read('demo/index.html');
async function boot(){const dom=new JSDOM(fixture,{url:'https://chat.zalo.me/',runScripts:'outside-only'}),w=dom.window;w.chrome={runtime:{id:'test-extension',getURL:path=>'chrome-extension://test-extension/'+path}};for(const f of ['actions.js','buddies.js','windows.js','transcript.js','chrome.js'])w.eval(await read('extension/'+f));return {dom,w,d:w.document};}
test('No packaged CSS resource resolves against the host page; runtime vars and cross-origin fixture',async()=>{
 for(const path of ['extension/skin.css','extension/vendor/v2.css']){const css=postcss.parse(await read(path));css.walkDecls(d=>{for(const match of d.value.matchAll(/url\(([^)]+)\)/g)){assert.match(match[1].replace(/['"]/g,''),/^(chrome-extension:|data:)/,path+': '+d.value);}});}
 const {dom,w,d}=await boot();const skin=w.YahooZaloChrome({off(){}});skin.sync(d.querySelector('#sidebarNav'),d.querySelector('#chatViewContainer'));
 assert.match(d.documentElement.style.getPropertyValue('--yzr-bliss'),/^url\("chrome-extension:\/\/test-extension\/adapters\/zalo\/assets\/xp\/bliss.jpg"\)$/);
 for(const image of d.querySelectorAll('[data-yzr-owned] img'))if(!image.closest('[data-yzr-peer-avatar],[data-yzr-self-avatar]'))assert.match(image.src,/^chrome-extension:\/\/test-extension\//);
 assert.match(await read('scripts/preview.mjs'),/listen\(4213,'127.0.0.1'/);assert.match(await read('extension/chrome.js'),/http:\/\/127.0.0.1:4213/);
 skin.dispose();dom.window.close();
});
test('Unsupported controls keep aria-disabled; Send uses its native disabled appearance',async()=>{
 const {dom,w,d}=await boot();const skin=w.YahooZaloChrome({off(){}});skin.sync(d.querySelector('#sidebarNav'),d.querySelector('#chatViewContainer'));
 for(const control of d.querySelectorAll('[data-yzr-owned] [aria-disabled=true]')){assert.equal(control.disabled,control.dataset.yzrAction==='send',control.outerHTML);assert.ok(control.title);}
 assert.equal(d.querySelectorAll('.chat-menu .yzr-menu-trigger').length,4);
 assert.ok(d.querySelector('.format-options [data-yzr-action=font][aria-disabled=true]')); // R10: other styles may enter RTF by keyboard even without a native expand button.
 for(const key of ['bold','italic','underline','color','fontSize'])assert.equal(d.querySelector('.format-options [data-yzr-action='+key+']').hasAttribute('aria-disabled'),false);
 assert.match(await read('extension/skin.css'),/\.menubar button\{color:white!important;opacity:1!important/);
 assert.match(await read('extension/skin.css'),/\[aria-disabled=true\]\{cursor:default;opacity:1!important/);
 skin.dispose();dom.window.close();
});
test('Groups use native avatar/community markers; absent avatars have no grey placeholder',async()=>{
 const {dom,w,d}=await boot();const row=d.querySelector('[data-peer="Nhóm bạn 9x"]');assert.equal(w.YahooZaloBuddy.classify(row),'Group');row.querySelector('.zavatar-multi').remove();assert.equal(w.YahooZaloBuddy.classify(row),'Friends');const badge=d.createElement('i');badge.className='community__conv-indicator';row.append(badge);assert.equal(w.YahooZaloBuddy.classify(row),'Group');
 const skin=w.YahooZaloChrome({off(){}});skin.sync(d.querySelector('#sidebarNav'),d.querySelector('#chatViewContainer'));assert.equal(d.querySelectorAll('.yzr-native-list-toggle').length,0);assert.equal(d.querySelectorAll('.yzr-buddy-groups .tiny-avatar').length,0);assert.ok(d.querySelector('.group-actions .classic-button'));assert.equal(d.querySelectorAll('.contact-search input').length,0);assert.equal(d.querySelectorAll('#contact-search-input').length,1);
 assert.equal(d.querySelector('#contact-search').parentElement.hasAttribute('data-yzr-search-chain'),false,'virtual-list parent must not be collapsed');
 skin.dispose();dom.window.close();
});
test('Own avatar requires exactly one signed-in navigation marker, never a contact image or Y! logo',async()=>{
 const {dom,w,d}=await boot(),nav=d.querySelector('#sidebarNav');const fake=d.createElement('img');fake.src='https://example.invalid/fake-contact.png';nav.append(fake);assert.equal(w.YahooZaloActions.ownAvatar(nav),null);
 const container=d.createElement('div');container.className='nav__tabs__zalo';const avatar=d.createElement('span');avatar.className='zavatar-single';const image=d.createElement('img');image.className='a-child';image.src='data:image/png;base64,FAKE';avatar.append(image);container.append(avatar);d.querySelector('#main-tab').append(container);assert.equal(w.YahooZaloActions.ownAvatar(nav),image.src);
 avatar.append(image.cloneNode());assert.equal(w.YahooZaloActions.ownAvatar(nav),null);
 const skin=w.YahooZaloChrome({off(){}});skin.sync(nav,d.querySelector('#chatViewContainer'));for(const n of d.querySelectorAll('[data-yzr-self-avatar]')){assert.ok(n.querySelector('.default-avatar'));assert.equal(n.querySelector('img'),null);}skin.dispose();dom.window.close();
});
test('Deep native scroll chain is constrained without moving scroll nodes; off restores everything',async()=>{
 const {dom,w,d}=await boot(),root=d.querySelector('#chatViewContainer'),scroll=d.querySelector('#messageViewContainer>.transform-gpu'),editor=d.querySelector('#richInput'),parent=scroll.parentNode,style=scroll.getAttribute('style'),t=w.YahooZaloTranscript();
 t.sync(root,'Demo',false);assert.equal(d.querySelectorAll('[data-yzr-history-flow]').length,2);assert.equal(scroll.getAttribute('style'),style);assert.equal(scroll.parentNode,parent);assert.equal(editor,d.querySelector('#richInput'));t.clear();assert.equal(d.querySelectorAll('[data-yzr-history-flow]').length,0);dom.window.close();
});
test('Cached and parked reopen paths use the guarded native row helper, never row.click',async()=>{const buddy=await read('extension/buddies.js'),chrome=await read('extension/chrome.js');assert.match(buddy,/YahooZaloActions\.activateRow/);assert.match(chrome,/buddies\.openName/);assert.doesNotMatch(buddy,/\.click\(/);});test('Native nested search results are exposed in the list slot, not cloned; off restores attributes',async()=>{
 const {dom,w,d}=await boot(),nav=d.querySelector('#sidebarNav'),main=d.querySelector('#chatViewContainer'),input=d.querySelector('#contact-search-input'),skin=w.YahooZaloChrome({off(){}});
 const results=d.createElement('div');results.id='searchResultList';const inner=d.createElement('div');inner.id='searchResultList';results.append(inner);nav.append(results);input.value='Demo';skin.sync(nav,main);
 assert.equal(results.getAttribute('data-yzr-search-results'),'true');assert.equal(inner.hasAttribute('data-yzr-search-results'),false);assert.equal(d.querySelector('#contact-search-input'),input);assert.equal(results.parentElement,nav);
 input.value='';skin.sync(nav,main);assert.equal(results.getAttribute('data-yzr-search-results'),'false');skin.dispose();assert.equal(results.hasAttribute('data-yzr-search-results'),false);assert.equal(input.getAttribute('placeholder'),'Tìm kiếm');dom.window.close();
});
test('Native list AutoSizer ancestors have an explicit slot, never the collapsed search chain',async()=>{
 const {dom,w,d}=await boot(),nav=d.querySelector('#sidebarNav'),list=d.querySelector('#conversationList'),main=d.querySelector('#chatViewContainer');
 const skin=w.YahooZaloChrome({off(){}});skin.sync(nav,main);
 const chain=[];for(let n=list.parentElement;n&&n!==nav&&!n.contains(d.querySelector('#contact-search'));n=n.parentElement)chain.push(n);
 assert.ok(chain.length>=3,'fixture must reproduce the real virtual-list wrapper chain');assert.ok(chain.at(-1).hasAttribute('data-yzr-native-list-shell'));for(const n of chain.slice(0,-1))assert.ok(n.hasAttribute('data-yzr-native-list-flow'));for(const n of chain)assert.equal(n.hasAttribute('data-yzr-search-chain'),false);
 skin.dispose();for(const n of chain)assert.equal(n.hasAttribute('data-yzr-native-list-flow')||n.hasAttribute('data-yzr-native-list-shell'),false);dom.window.close();
});
test('Fixture virtualizer renders zero contacts at height 0 and restores them only at nonzero height',async()=>{
 const {dom,w,d}=await boot();let callback,viewportHeight=0;w.ResizeObserver=class{constructor(fn){callback=fn;}observe(n){n.getBoundingClientRect=()=>({height:viewportHeight});}};w.eval(await read('demo/fixture.js'));
 callback();assert.equal(d.querySelectorAll('#conversationList .msg-item').length,0);viewportHeight=300;callback();assert.equal(d.querySelectorAll('#conversationList .msg-item').length,3);dom.window.close();
});
