// Copies extension/ to dist/Your-Messenger/, checks every manifest reference exists, and writes the
// beta download: Your-Messenger-<version>.zip (the folder plus the install guide) with SHA256SUMS.txt
// beside it, for testers to check what they install. The folder name has no version: an unpacked
// extension's ID (and its saved Y! ID and settings) follows its folder, so updates replace it.
import {cp,readFile,rm,writeFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';

const root=new URL('../',import.meta.url),src=new URL('extension/',root);
const manifest=JSON.parse(await readFile(new URL('manifest.json',src),'utf8'));
const refs=[manifest.background.service_worker,manifest.action.default_popup,...Object.values(manifest.icons||{}),...manifest.content_scripts.flatMap(c=>[...c.js,...(c.css||[])])];
for(const ref of refs)await stat(new URL(ref,src)).catch(()=>{throw new Error('Missing file in manifest: '+ref);});
const folder='Your-Messenger',name=`${folder}-${manifest.version}`,out=new URL(`dist/${folder}/`,root);
await rm(out,{recursive:true,force:true});
await cp(src,out,{recursive:true});
// The licence travels with every copy (PolyForm: recipients get the terms and the Required Notice).
for(const f of ['LICENSE.md','NOTICE.md'])await cp(new URL(f,root),new URL(f,out));
async function files(dir,prefix=''){const list=[];for(const e of await readdir(dir,{withFileTypes:true})){const rel=prefix+e.name;if(e.isDirectory())list.push(...await files(new URL(e.name+'/',dir),rel+'/'));else list.push(rel);}return list;}
const sha=data=>createHash('sha256').update(data).digest('hex');
const hashes={};
for(const f of (await files(out)).sort())hashes[f]=sha(await readFile(new URL(f,out)));
await writeFile(new URL(`dist/package-manifest-${manifest.version}.json`,root),JSON.stringify({version:manifest.version,files:hashes},null,1));

// Zip (deflate), fixed timestamps so the same sources give the same file and checksum.
const CRC=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=buf=>{let c=0xFFFFFFFF;for(const b of buf)c=CRC[(c^b)&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
function zip(entries){
  const DOS_TIME=0,DOS_DATE=(2026-1980)<<9|1<<5|1,locals=[],centrals=[];let offset=0;
  for(const {path,data} of entries){
    const nameBytes=Buffer.from(path,'utf8'),packed=deflateRawSync(data),crc=crc32(data);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);local.writeUInt16LE(8,8);
    local.writeUInt16LE(DOS_TIME,10);local.writeUInt16LE(DOS_DATE,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(nameBytes.length,26);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x0800,8);central.writeUInt16LE(8,10);
    central.writeUInt16LE(DOS_TIME,12);central.writeUInt16LE(DOS_DATE,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(packed.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(nameBytes.length,28);central.writeUInt32LE(offset,42);
    locals.push(local,nameBytes,packed);centrals.push(central,nameBytes);offset+=30+nameBytes.length+packed.length;
  }
  const dir=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,dir,end]);
}
const entries=[{path:'HUONG-DAN-CAI.md',data:await readFile(new URL('docs/CAI-DAT.md',root))}];
for(const f of Object.keys(hashes))entries.push({path:`${folder}/${f}`,data:await readFile(new URL(f,out))});
const archive=zip(entries),sum=sha(archive);
await writeFile(new URL(`dist/${name}.zip`,root),archive);
await writeFile(new URL('dist/SHA256SUMS.txt',root),`${sum}  ${name}.zip\n`);
console.log(`Packaged ${Object.keys(hashes).length} files → dist/${folder}/ and dist/${name}.zip`);
console.log(`SHA-256 ${sum}`);
