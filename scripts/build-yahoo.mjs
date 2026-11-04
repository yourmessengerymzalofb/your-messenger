// Builds the Yahoo Desktop that runs on chat.zalo.me from vendor/yahoo-v2 (pristine) + src/yahoo (port layer).
// Output: extension/yahoo/app/ (ESM, code-split) and extension/yahoo/static/ (images, sounds).
import * as esbuild from 'esbuild';
import {tokenizer,tokTypes as tt} from 'acorn';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import {readFile,rm,cp,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const vendor=path.join(root,'vendor/yahoo-v2'),src=path.join(root,'src/yahoo');
const outApp=path.join(root,'extension/yahoo/app'),outStatic=path.join(root,'extension/yahoo/static');
const slash=p=>p.split(path.sep).join('/');

// Where each vendor asset folder is served from inside extension/yahoo/static/.
const STATIC=[['public/assets/','assets/'],['public/icons/','icons/'],['public/avatars/','avatars/'],['modules/winamp/assets/','winamp/'],['app/assets/','app/']];
function staticPath(vendorRel){for(const[from,to]of STATIC)if(vendorRel.startsWith(from))return to+vendorRel.slice(from.length);return null;}

// ---- CSS: scope every selector under #ym-root and point url()s at packaged assets ----
const scope=selectorParser(selectors=>{
  selectors.each(selector=>{
    let rooted=false;
    selector.each(node=>{
      // Only top-level html/body/:root become the root; nested ones (inside :not() etc.) stay.
      if(node.type==='tag'&&/^(html|body)$/i.test(node.value)||node.type==='pseudo'&&node.value===':root'){node.replaceWith(selectorParser.id({value:'ym-root'}));rooted=true;}
    });
    if(!rooted){selector.prepend(selectorParser.combinator({value:' '}));selector.prepend(selectorParser.id({value:'ym-root'}));}
  });
});
export function scopeCss(css,file){
  const ast=postcss.parse(css,{from:file});
  ast.walkRules(rule=>{
    if(rule.parent?.type==='atrule'&&/keyframes$/i.test(rule.parent.name))return;
    rule.selector=scope.processSync(rule.selector).replace(/#ym-root(\s+#ym-root)+(?![\w-])/g,'#ym-root');
  });
  ast.walkDecls(decl=>{
    decl.value=decl.value.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g,(match,q,url)=>{
      if(/^(data:|https?:|#)/.test(url))return match;
      const target=url.startsWith('/')?'public'+url:slash(path.relative(vendor,path.resolve(path.dirname(file),url)));
      const mapped=staticPath(target);
      if(!mapped)throw new Error(`Unmapped CSS url ${url} in ${slash(path.relative(root,file))}`);
      return `url('__YM_STATIC__${mapped}')`;
    });
  });
  return ast.toString();
}
// globals.css @imports the public stylesheets by site path; inline them in order.
export async function inlineImports(file,seen=new Set()){
  if(seen.has(file))return '';seen.add(file);
  const css=await readFile(file,'utf8');let out='';let last=0;
  for(const m of css.matchAll(/@import\s+(?:url\()?\s*['"]([^'"]+)['"]\s*\)?\s*;/g)){
    out+=scopeCss(css.slice(last,m.index),file);last=m.index+m[0].length;
    const target=m[1].startsWith('/')?path.join(vendor,'public',m[1]):path.resolve(path.dirname(file),m[1]);
    out+='\n'+await inlineImports(target,seen);
  }
  return out+scopeCss(css.slice(last),file);
}

// ---- JS: string literals that name site assets or session media ----
const ASSET=/(?<![\w.\/-])\/(assets|icons|avatars)\//g;
export function rewriteLiterals(code,file){
  const edits=[];
  const visit=(start,end,inTemplate,quote,followedBySubst)=>{
    const raw=code.slice(start,end);
    let next=raw.replace(ASSET,(m,dir)=>inTemplate?'${YM_ASSET}'+dir+'/':quote+'+YM_ASSET+'+quote+dir+'/');
    // "/api/avatars/" + id and "/api/chat-images/" + id are image URLs behind the session cookie.
    if(inTemplate?followedBySubst:true)next=next.replace(/(?<![\w.-])\/api\/(avatars|chat-images)\/$/,(m,dir)=>inTemplate?'${YM_MEDIA}'+dir+'/':quote+'+YM_MEDIA+'+quote+dir+'/');
    if(next!==raw)edits.push([start,end,next]);
  };
  let tokens;try{tokens=[...tokenizer(code,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true})];}catch(error){throw new Error(`Cannot tokenize ${file}: ${error.message}`);}
  tokens.forEach((t,i)=>{
    if(t.type===tt.string)visit(t.start+1,t.end-1,false,code[t.start],false);
    else if(t.type===tt.template)visit(t.start,t.end,true,'',tokens[i+1]?.type===tt.dollarBraceL);
  });
  for(const[s,e,text]of edits.sort((a,b)=>b[0]-a[0]))code=code.slice(0,s)+text+code.slice(e);
  return code;
}

// Small, counted edits to vendor files. Each find string must occur exactly `count` times, so an
// upstream change fails the build instead of silently dropping a patch.
const PATCHES={
  'client/desktop-host.mjs':[
    {find:"import {createDesktop} from './desktop.mjs';",replace:()=>"import {createDesktop} from './desktop.mjs';import {ymDesktopCreated} from "+JSON.stringify(slash(path.join(src,'desktop-bridge.mjs')))+";",count:1},
    {find:' return {winamp,desktop,internet,',replace:()=>' ymDesktopCreated(desktop);return {winamp,desktop,internet,',count:1}
  ],
  // My Y!360 goes through the Yahoo server's /360 (chat.ymvn.site), opened in the desktop's
  // Y! 360° window, not to the blog's own host.
  'app/shell.ts':[
    {find:'href="https://yahoo-360.racingisle5.chatgpt.site/api/connect/start?return=%2F360" target="_blank"',replace:()=>'href="/360" target="_blank"',count:2}
  ],
  // Reader mode asks the Yahoo server, not the page it runs on (chat.zalo.me).
  'modules/internet-explorer/index.mjs':[
    {find:"win.fetch(options.endpoint||'/api/browser/read'",replace:()=>"YM_FETCH(options.endpoint||'/api/browser/read'",count:1}
  ],
  // Push needs Yahoo's service worker, which cannot register on chat.zalo.me: say so plainly.
  'client/ym.js':[
    {find:"popup('Thông báo','<p>Trình duyệt này chưa hỗ trợ thông báo web. Trên iPhone, dùng Safari với iOS 16.4 trở lên và thêm Y! vào Màn hình chính.</p>');",replace:()=>"popup('Thông báo','<p>Thông báo đẩy của Y! không chạy trong Your Messenger trên Zalo: trang Zalo không cho Y! đăng ký service worker.</p><p>Tin mới vẫn hiện trên desktop khi tab Zalo đang mở. Muốn nhận thông báo cả khi đóng tab, hãy bật trên trang YM v2 riêng.</p>');",count:1}
  ]
};
export function applyPatches(code,rel){
  for(const p of PATCHES[rel]||[]){
    const n=code.split(p.find).length-1;
    if(n!==p.count)throw new Error(`Patch for ${rel} expected ${p.count} match(es) of ${JSON.stringify(p.find)}, found ${n}`);
    code=code.split(p.find).join(p.replace());
  }
  return code;
}
const plugin={name:'yahoo-port',setup(build){
  build.onResolve({filter:/^ym-css:globals$/},()=>({path:'globals',namespace:'ym-css'}));
  build.onLoad({filter:/.*/,namespace:'ym-css'},async()=>({contents:'export default '+JSON.stringify(await inlineImports(path.join(vendor,'app/globals.css'))),loader:'js'}));
  // Stylesheets imported by vendor modules become a scoped <style> injected on first import.
  build.onLoad({filter:/\.css$/},async args=>{
    const css=await inlineImports(args.path);const id=slash(path.relative(vendor,args.path));
    return {contents:`import {injectCss} from ${JSON.stringify(slash(path.join(src,'style.mjs')))};injectCss(${JSON.stringify(css)},${JSON.stringify(id)});export default null;`,loader:'js',resolveDir:path.dirname(args.path)};
  });
  build.onLoad({filter:/\.(mjs|js|ts)$/},async args=>{
    if(!slash(args.path).startsWith(slash(vendor)+'/'))return;
    const code=await readFile(args.path,'utf8');
    // shell.ts is a plain template string; strip nothing, the ts loader handles the export.
    return {contents:rewriteLiterals(applyPatches(code,slash(path.relative(vendor,args.path))),args.path),loader:args.path.endsWith('.ts')?'ts':'js'};
  });
}};

// minify: the release package (npm run package); tests read the plain bundle.
export async function buildYahoo({write=true,minify=false}={}){
  if(write){await rm(outApp,{recursive:true,force:true});await rm(outStatic,{recursive:true,force:true});}
  const result=await esbuild.build({
    entryPoints:{boot:path.join(src,'boot.mjs')},bundle:true,format:'esm',splitting:true,platform:'browser',target:'chrome120',
    outdir:outApp,chunkNames:'chunks/[name]-[hash]',write,metafile:true,legalComments:'none',minify,keepNames:minify,charset:'utf8',logLevel:'warning',
    inject:[path.join(src,'env.mjs')],
    define:{'document.body':'YM_ROOT','document.documentElement':'YM_ROOT','document.querySelector':'YM_QUERY','document.querySelectorAll':'YM_QUERY_ALL','document.getElementById':'YM_BY_ID','globalThis.fetch':'YM_FETCH','window.fetch':'YM_FETCH','window.open':'YM_OPEN'},
    plugins:[plugin]
  });
  if(write)for(const[from,to]of STATIC){await mkdir(path.join(outStatic,to),{recursive:true});await cp(path.join(vendor,from),path.join(outStatic,to),{recursive:true});}
  return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const r=await buildYahoo({minify:process.argv.includes('--minify')});
  const outputs=Object.entries(r.metafile.outputs);
  console.log(`Built ${outputs.length} files, ${(outputs.reduce((n,[,o])=>n+o.bytes,0)/1024).toFixed(0)} KB → extension/yahoo/app/`);
}
