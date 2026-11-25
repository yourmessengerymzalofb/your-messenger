/* Chat sources mirrored into the Yahoo Desktop. The desktop runs on chat.zalo.me (the hub)
   and hosts Zalo itself; other apps publish from their own tab. Adding an app = one entry
   here, one adapters/<id>/ folder and one content_scripts block in manifest.json (see docs/ADAPTER.md). */
(() => {
  const hubOrigins=['https://chat.zalo.me'];
  const sources=[
    // uploads: the adapter attaches pictures pasted in a Yahoo chat window to its own composer.
    {id:'facebook',label:'Facebook',openUrl:'https://www.facebook.com/messages/',groups:['Online','Offline','Group','Chưa rõ trạng thái','Page'],uploads:true,
     match:u=>/^https:\/\/(?:www\.|web\.)?facebook\.com$/.test(u.origin)&&u.pathname.startsWith('/messages')},
    // Telegram Web A only (web.telegram.org/a/); version K (/k/) is another page.
    {id:'telegram',label:'Telegram',openUrl:'https://web.telegram.org/a/',groups:['Online','Bạn bè','Nhóm','Bot'],
     match:u=>u.origin==='https://web.telegram.org'&&u.pathname.startsWith('/a/')}
  ];
  const parse=url=>{try{return new URL(url);}catch{return null;}};
  function sourceForUrl(url){const u=parse(url);return u?sources.find(s=>s.match(u))||null:null;}
  function isHub(url){const u=parse(url);return !!u&&hubOrigins.includes(u.origin);}
  const source=id=>sources.find(s=>s.id===id)||null;
  globalThis.YahooHubRegistry={hubOrigins,sources,source,sourceForUrl,isHub,hubUrl:hubOrigins[0]+'/'};
})();
