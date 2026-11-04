/* Welcome page, opened when the plugin is installed (background/sw.js): the terms of use
   (shared/terms.json). Accepting is what the desktop on chat.zalo.me checks (src/yahoo/terms.mjs). */
(async () => {
  const store=chrome.storage.local,$=id=>document.getElementById(id);
  const terms=await (await fetch(chrome.runtime.getURL('shared/terms.json'))).json();
  $('title').textContent=terms.title;$('intro').textContent=terms.intro;
  for(const[lead,text]of terms.points){const li=document.createElement('li'),b=document.createElement('b');b.textContent=lead;li.append(b,' '+text);$('points').append(li);}
  const state=s=>{document.body.dataset.state=s;};
  if((await store.get({ymTerms:''})).ymTerms===terms.version)state('accepted');
  $('accept').addEventListener('click',async()=>{await store.set({ymTerms:terms.version,ymDesktop:true});state('accepted');});
  $('decline').addEventListener('click',async()=>{await store.set({ymDesktop:false});state('declined');});
  $('open-zalo').addEventListener('click',()=>chrome.tabs.create({url:'https://chat.zalo.me/'}));
})();
