// Draws the Your Messenger icon (our own artwork, not a Yahoo logo) as PNGs for the manifest:
// a purple rounded square with a white chat bubble and a smile. No dependencies: shapes are
// sampled 4×4 per pixel and written with node:zlib.
import {writeFile,mkdir} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';

const out=new URL('../extension/icons/',import.meta.url);
const PURPLE=[106,53,178],DEEP=[80,36,140],WHITE=[255,255,255];
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function color(x,y){ // x, y in [0,1); null = transparent
  const r=0.22,cx=Math.min(Math.max(x,r),1-r),cy=Math.min(Math.max(y,r),1-r);
  if((x-cx)**2+(y-cy)**2>r*r)return null;
  const bg=mix([139,85,203],DEEP,y);
  const inEllipse=((x-0.5)/0.34)**2+((y-0.46)/0.28)**2<=1;
  const tail=y>=0.62&&y<=0.86&&x>=0.22&&x<=0.46&&(x-0.22)/(0.46-0.22)>=(y-0.62)/(0.86-0.62)*0.55&&x<=0.46-(y-0.62)*0.6;
  if(!inEllipse&&!tail)return bg;
  const eye=(ex)=>(x-ex)**2+(y-0.41)**2<=0.048**2;
  const d=Math.hypot(x-0.5,y-0.44);
  const smile=d>=0.13&&d<=0.175&&y>0.47&&Math.abs(x-0.5)<0.14;
  return eye(0.39)||eye(0.61)||smile?PURPLE:WHITE;
}
const CRC=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
const crc=buf=>{let c=0xFFFFFFFF;for(const b of buf)c=CRC[(c^b)&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const body=Buffer.concat([Buffer.from(type,'ascii'),data]);const sum=Buffer.alloc(4);sum.writeUInt32BE(crc(body));return Buffer.concat([len,body,sum]);}
function png(size){
  const rows=Buffer.alloc(size*(size*4+1)),S=4;
  for(let py=0;py<size;py++){
    rows[py*(size*4+1)]=0;
    for(let px=0;px<size;px++){
      let rgb=[0,0,0],alpha=0;
      for(let sy=0;sy<S;sy++)for(let sx=0;sx<S;sx++){const c=color((px+(sx+0.5)/S)/size,(py+(sy+0.5)/S)/size);if(c){rgb=rgb.map((v,i)=>v+c[i]);alpha++;}}
      const o=py*(size*4+1)+1+px*4;
      if(alpha){rows[o]=Math.round(rgb[0]/alpha);rows[o+1]=Math.round(rgb[1]/alpha);rows[o+2]=Math.round(rgb[2]/alpha);}
      rows[o+3]=Math.round(255*alpha/(S*S));
    }
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
await mkdir(out,{recursive:true});
for(const size of [16,32,48,128])await writeFile(new URL(`icon-${size}.png`,out),png(size));
console.log('Icons → extension/icons/icon-{16,32,48,128}.png');
