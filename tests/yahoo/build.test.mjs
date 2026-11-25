import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readdir,readFile} from 'node:fs/promises';
import postcss from 'postcss';
import {scopeCss,rewriteLiterals,inlineImports,buildYahoo,applyPatches} from '../../scripts/build-yahoo.mjs';

const vendor=path.resolve('vendor/yahoo-v2');
const unscoped=css=>{const bad=[];postcss.parse(css).walkRules(r=>{if(r.parent?.type==='atrule'&&/keyframes$/.test(r.parent.name))return;for(const s of r.selectors)if(!/^#ym-root(?![\w-])/.test(s))bad.push(s);});return bad;};

test('CSS is scoped under #ym-root and asset urls point at the packaged copies',()=>{
  const file=path.join(vendor,'public/ym.css');
  const out=scopeCss(`html,body{margin:0}:root{--a:1}*{box-sizing:border-box}body.login-screen main{x:1}html body .w{y:1}[hidden]{display:none}.window .titlebar{z:1}
@keyframes f{from{opacity:0}to{opacity:1}}.a{background:url('/assets/xp/bliss.jpg')}.b{background:url(data:image/png;base64,AA)}`,file);
  assert.deepEqual(unscoped(out),[]);
  for(const s of ['#ym-root,#ym-root{','#ym-root{--a:1}','#ym-root *{','#ym-root.login-screen main{','#ym-root .w{','#ym-root [hidden]{','#ym-root .window .titlebar{','from{opacity:0}'])assert.ok(out.includes(s),s);
  assert.ok(out.includes("url('__YM_STATIC__assets/xp/bliss.jpg')"));assert.ok(out.includes('url(data:image/png;base64,AA)'));
});

test('Every Yahoo stylesheet the desktop loads is fully scoped',async()=>{
  const sheets=[path.join(vendor,'app/globals.css')];
  async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.css')&&!p.includes(path.join('public','')+'')||p.endsWith('.css')&&/(client|modules)/.test(p))sheets.push(p);}}
  await walk(path.join(vendor,'client'));await walk(path.join(vendor,'modules'));
  for(const s of sheets){const css=await inlineImports(s);assert.deepEqual(unscoped(css),[],path.relative(vendor,s));assert.ok(!/url\(['"]?\//.test(css),'no root-relative url in '+s);}
});

test('Asset and session-media literals are rewritten; API calls are not',()=>{
  const code=String.raw`a='/assets/x.gif';b="<img src=\"/icons/y.svg\">";c=`+"`"+String.raw`<img src="/avatars/z.png">`+"`"+String.raw`;d='/api/avatars/'+id;e=`+"`"+String.raw`<img src="/api/avatars/${"${"}id}">`+"`"+String.raw`;
f='/api/chat-images/'+id;g='/api/chat-images/upload?peer='+p;h='/api/account';i=/\/assets\//;k='https://x.example/assets/a.png'`;
  const out=rewriteLiterals(code,'t.mjs');
  assert.ok(out.includes(`a=''+YM_ASSET+'assets/x.gif'`));
  assert.ok(out.includes(String.raw`b="<img src=\""+YM_ASSET+"icons/y.svg\">"`));
  assert.ok(out.includes('c=`<img src="${YM_ASSET}avatars/z.png">`'));
  assert.ok(out.includes(`d=''+YM_MEDIA+'avatars/'+id`));
  assert.ok(out.includes('e=`<img src="${YM_MEDIA}avatars/${id}">`'));
  assert.ok(out.includes(`f=''+YM_MEDIA+'chat-images/'+id`));
  assert.ok(out.includes(`g='/api/chat-images/upload?peer='+p`),'fetch paths stay for the proxy');
  assert.ok(out.includes(`h='/api/account'`));assert.ok(out.includes(String.raw`i=/\/assets\//`),'regex literals untouched');
  assert.ok(out.includes(`k='https://x.example/assets/a.png'`));
  assert.doesNotThrow(()=>new Function(out.replace(/YM_ASSET|YM_MEDIA/g,'""').replace(/\bid\b|\bp\b/g,'1')));
});

test('The bundle has no root-relative asset paths, node imports or blocked YouTube script',async()=>{
  const r=await buildYahoo({write:false});
  const js=r.outputFiles.filter(f=>f.path.endsWith('.js')).map(f=>f.text).join('\n');
  assert.ok(r.outputFiles.some(f=>f.path.endsWith('boot.js')));
  assert.equal(/["'`(=]\/(assets|icons|avatars)\//.test(js),false);
  assert.equal(/from\s*["']node:|import\(["']node:/.test(js),false);
  assert.equal(/navigator\.serviceWorker\.register/.test(js)&&!/YM_ROOT|navigator2|ymFetch/.test(js),false);
  assert.equal(/["'`]\/api\/(avatars|chat-images)\/["'`]\s*\+/.test(js),false,'session image URLs are built from YM_MEDIA');
  assert.match(js,/YM_FETCH\(options\.endpoint \|\| "\/api\/browser\/read"/,'IE reader mode asks the Yahoo server through the proxy');
  assert.equal(/win\.fetch\(/.test(js),false);
  assert.match(js,/Thông báo đẩy của Y! không chạy trong Your Messenger trên Zalo/);
  assert.doesNotMatch(js,/Yahoo! Messenger|"Yahoo!"/,'the bundle uses YM! and Y!, as YM v2 does');
  assert.doesNotMatch(js,/href=\\?"https:\/\/[^"]*chatgpt\.site/,'links go to chat.ymvn.site (My Y!360 opens /360)');
  assert.equal((js.match(/chatgpt\.site/g)||[]).length,1,'only bot-links still knows the old blog host, to turn its links into /360');
  assert.match(js,/d\.open = groupState\[title\] \?\? title !== "Offline"/,'the Offline group starts collapsed');
});

test('Vendor patches apply exactly once or the build stops',()=>{
  const code="import {createDesktop} from './desktop.mjs'; x(); const y360=createY360Desktop({desktop,notify}); return {winamp,desktop,internet,a};";
  const out=applyPatches(code,'client/desktop-host.mjs');
  assert.ok(out.includes('ymDesktopCreated(desktop);return {winamp,desktop,internet,'));
  assert.ok(out.includes('const y360={session(){},destroy(){}};'),'the plugin keeps its own Y! 360° window');
  assert.throws(()=>applyPatches('changed upstream','client/desktop-host.mjs'),/expected 1 match/);
  assert.equal(applyPatches('untouched','client/other.mjs'),'untouched');
});
