// Maps paths written for the original single-site projects onto the hub layout.
export function resolver(adapter){
  return p=>{
    if(p==='extension/manifest.json')return new URL('../extension/manifest.json',import.meta.url);
    if(p.startsWith('extension/'))return new URL(`../extension/adapters/${adapter}/${p.slice(10)}`,import.meta.url);
    if(p.startsWith('../'))return new URL('../'+p,import.meta.url);
    return new URL(`../fixtures/${adapter}/${p}`,import.meta.url);
  };
}
