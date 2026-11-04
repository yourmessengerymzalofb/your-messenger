import http from 'node:http';
import {readFile} from 'node:fs/promises';
const routes={'/':'demo/index.html','/demo/base.css':'demo/base.css','/demo/fixture.js':'demo/fixture.js','/extension/content.js':'extension/content.js','/extension/skin.css':'extension/skin.css'};
http.createServer(async(req,res)=>{
  if(req.headers.host!=='127.0.0.1:4212'){res.writeHead(403).end();return;}
  const pathname=new URL(req.url,'http://127.0.0.1:4212').pathname;
  let file=routes[pathname];
  if(pathname==='/v2-reference.html')file='demo/v2-reference.html';
  if(/^\/reference\/v2\/[a-z-]+\.css$/.test(pathname))file=pathname.slice(1);
  // Assets deliberately do NOT exist on the page origin: regressions must 404 here.
  if(!file&&/^\/extension\/(?:[a-z-]+\.js|vendor\/v2\.css)$/.test(pathname))file=pathname.slice(1);
  if(!file){res.writeHead(404).end();return;}
  try{const bytes=await readFile(new URL('../'+file,import.meta.url));const ext=file.split('.').pop();const types={js:'text/javascript',css:'text/css',png:'image/png',jpg:'image/jpeg',svg:'image/svg+xml',gif:'image/gif',wav:'audio/wav'};res.writeHead(200,{'Content-Type':types[ext]||'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; connect-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src http://127.0.0.1:4213 data:; frame-ancestors 'none'"});res.end(bytes);}catch{res.writeHead(500).end();}
}).listen(4212,'127.0.0.1',()=>console.log('Synthetic demo: http://127.0.0.1:4212/'));
http.createServer(async(req,res)=>{
 if(req.headers.host!=='127.0.0.1:4213'){res.writeHead(403).end();return;}
 const path=new URL(req.url,'http://127.0.0.1:4213').pathname;
 if(!/^\/(?:icons\/[a-z-]+\.svg|assets\/(?:xp\/)?[a-z-]+\.(?:png|jpg|gif|svg|wav))$/.test(path)){res.writeHead(404).end();return;}
 try{const data=await readFile(new URL('../extension'+path,import.meta.url));const ext=path.split('.').pop();res.writeHead(200,{'Content-Type':{png:'image/png',jpg:'image/jpeg',gif:'image/gif',svg:'image/svg+xml',wav:'audio/wav'}[ext],'Cache-Control':'no-store'}).end(data);}catch{res.writeHead(404).end();}
}).listen(4213,'127.0.0.1',()=>console.log('Packaged assets (different origin): http://127.0.0.1:4213/'));
