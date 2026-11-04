// Copies the YM v2 browser client from a checkout (game-spectators-release-20261027, the line after
// game-ui-release-20261027) into vendor/yahoo-v2/
// and records a SHA256 for every file. Vendor files are never edited: the port layer lives in src/yahoo/.
// Usage: node scripts/vendor-yahoo.mjs <path-to-yahoo-v2-checkout>
import {cp,readFile,rm,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const source=path.resolve(process.argv[2]||'../game-spectators-release-20261027');
const out=path.resolve('vendor/yahoo-v2');
// Server code, tests, tooling and docs stay behind; only what the browser loads is copied.
const skip=/(^|\/)(tests?|reports|scripts|server)(\/|$)|\.ts$|(^|\/)(audit\.(html|mjs)|index\.html|standalone\.(css|mjs)|vite\.config\.mjs|package\.json|[A-Z]+\.md)$/;
const trees=['client','modules/activities','modules/board-games','modules/chess','modules/internet-explorer','modules/pool','modules/slideshow','modules/winamp','modules/xiangqi','vendor/chess.js','public/assets','public/icons','public/avatars'];
const single=['app/shell.ts','app/globals.css','app/assets/bliss.webp'];

async function files(dir,prefix=''){const list=[];for(const e of await readdir(dir,{withFileTypes:true})){const rel=prefix+e.name;if(e.isDirectory())list.push(...await files(path.join(dir,e.name),rel+'/'));else list.push(rel);}return list;}
await rm(out,{recursive:true,force:true});
const copied=[];
for(const tree of trees)for(const rel of await files(path.join(source,tree)))if(!skip.test(tree+'/'+rel))copied.push(tree+'/'+rel);
for(const rel of await readdir(path.join(source,'public')))if(rel.endsWith('.css'))copied.push('public/'+rel);
copied.push(...single);
const hashes={};
for(const rel of copied.sort()){
  await mkdir(path.dirname(path.join(out,rel)),{recursive:true});
  await cp(path.join(source,rel),path.join(out,rel));
  hashes[rel]=createHash('sha256').update(await readFile(path.join(out,rel))).digest('hex');
}
let commit='';try{commit=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
await writeFile(path.join(out,'PROVENANCE.json'),JSON.stringify({source:path.basename(source),commit,copied:new Date().toISOString().slice(0,10),files:hashes},null,1)+'\n');
console.log(`Vendored ${copied.length} files from ${commit.slice(0,7)||source}`);
