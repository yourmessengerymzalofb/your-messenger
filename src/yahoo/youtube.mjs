/* Minimal YT.Player for Winamp. Zalo's CSP blocks https://www.youtube.com/iframe_api, but its
   child-src allows YouTube frames: drive the embed with the same postMessage protocol the API uses. */
const ORIGIN='https://www.youtube.com';
let counter=0;

export class Player{
  constructor(host,{width='100%',height='100%',videoId,playerVars={},events={}}={}){
    this.id='ym-yt-'+(++counter);this.events=events;this.state=-1;this.time=0;this.duration=0;this.video={video_id:videoId||''};this.queue=[];this.ready=false;
    const vars=new URLSearchParams({enablejsapi:'1',origin:globalThis.location.origin,widgetid:String(counter)});
    for(const[k,v]of Object.entries(playerVars))if(k!=='origin'&&v!=null)vars.set(k,String(v));
    const frame=document.createElement('iframe');
    frame.id=host.id||this.id;frame.width=width;frame.height=height;frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;
    frame.referrerPolicy='strict-origin-when-cross-origin';frame.title='YouTube video player';frame.setAttribute('frameborder','0');
    frame.src=ORIGIN+'/embed/'+encodeURIComponent(videoId||'')+'?'+vars;
    host.replaceWith(frame);this.frame=frame;
    this.onMessage=e=>this.receive(e);addEventListener('message',this.onMessage);
    // The embed only reports once it knows a listener exists; repeat until onReady arrives.
    frame.addEventListener('load',()=>{this.listen();this.poll=setInterval(()=>{if(this.ready)clearInterval(this.poll);else this.listen();},250);setTimeout(()=>clearInterval(this.poll),15000);});
  }
  listen(){this.post({event:'listening',id:this.id,channel:'widget'});}
  post(message){try{this.frame?.contentWindow?.postMessage(JSON.stringify(message),ORIGIN);}catch{}}
  command(func,args=[]){if(this.ready)this.post({event:'command',func,args,id:this.id,channel:'widget'});else this.queue.push([func,args]);}
  fire(name,data){try{this.events[name]?.({target:this,data});}catch(error){setTimeout(()=>{throw error;});}}
  receive(e){
    if(e.origin!==ORIGIN||e.source!==this.frame?.contentWindow)return;
    let d;try{d=typeof e.data==='string'?JSON.parse(e.data):e.data;}catch{return;}
    if(d?.event==='onReady'&&!this.ready){this.ready=true;clearInterval(this.poll);for(const[f,a]of this.queue.splice(0))this.command(f,a);this.fire('onReady');}
    else if(d?.event==='onStateChange'){this.state=Number(d.info);this.fire('onStateChange',this.state);}
    else if(d?.event==='onError')this.fire('onError',Number(d.info));
    else if(d?.event==='onAutoplayBlocked')this.fire('onAutoplayBlocked');
    else if(d?.event==='infoDelivery'||d?.event==='initialDelivery'){
      const i=d.info||{};
      if(i.currentTime!=null)this.time=Number(i.currentTime);if(i.duration!=null)this.duration=Number(i.duration);
      if(i.videoData)this.video=i.videoData;
      if(i.playerState!=null&&Number(i.playerState)!==this.state){this.state=Number(i.playerState);this.fire('onStateChange',this.state);}
    }
  }
  playVideo(){this.command('playVideo');}
  pauseVideo(){this.command('pauseVideo');}
  stopVideo(){this.command('stopVideo');}
  seekTo(seconds,allowSeekAhead=true){this.time=Number(seconds)||0;this.command('seekTo',[this.time,allowSeekAhead]);}
  setVolume(volume){this.command('setVolume',[volume]);}
  mute(){this.command('mute');}unMute(){this.command('unMute');}
  loadVideoById(id,start=0){this.video={video_id:typeof id==='object'?id.videoId:id};this.command('loadVideoById',[id,start]);}
  cueVideoById(id,start=0){this.video={video_id:typeof id==='object'?id.videoId:id};this.command('cueVideoById',[id,start]);}
  getPlayerState(){return this.state;}
  getCurrentTime(){return this.time;}
  getDuration(){return this.duration;}
  getVideoData(){return this.video;}
  getIframe(){return this.frame;}
  destroy(){removeEventListener('message',this.onMessage);clearInterval(this.poll);this.frame?.remove();this.frame=null;this.ready=false;}
}
export const PlayerState={UNSTARTED:-1,ENDED:0,PLAYING:1,PAUSED:2,BUFFERING:3,CUED:5};
export const YT={Player,PlayerState,loaded:1};
