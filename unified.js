(()=>{
  const file=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const storePages=new Set(['store.html','shop.html','product.html','cart.html','checkout.html','about.html','contact.html','wishlist.html','my-orders.html','store-admin.html','admin-login.html']);
  const isStore=storePages.has(file);
  if(isStore) document.body.classList.add('kb-unified');

  const portal=document.createElement('div');
  portal.className='brand-portal';
  portal.setAttribute('aria-label','Switch website section');
  portal.innerHTML=`<a href="index.html" class="${!isStore?'active':''}"><i class="fa-solid fa-clapperboard"></i><span>EDITZ LK</span></a><a href="store.html" class="${isStore?'active':''}"><i class="fa-solid fa-shirt"></i><span>KB LABEL</span></a>`;

  // Keep the mode switch outside both headers so it can never cover cart/navigation controls.
  document.body.appendChild(portal);

  const loader=document.querySelector('#loader,.kb-page-loader');
  const syncLoader=()=>{
    const active=loader && loader.isConnected && !loader.classList.contains('hide') && !loader.classList.contains('hidden') && !loader.classList.contains('is-hidden') && !loader.classList.contains('loader-hide');
    portal.style.opacity=active?'0':'1';
    portal.style.pointerEvents=active?'none':'';
    portal.style.visibility=active?'hidden':'visible';
  };
  syncLoader();
  if(loader){
    new MutationObserver(syncLoader).observe(loader,{attributes:true,attributeFilter:['class','style']});
    new MutationObserver(syncLoader).observe(document.body,{childList:true});
  }
  window.addEventListener('load',()=>setTimeout(syncLoader,50));

  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');io.unobserve(entry.target)}}),{threshold:.1,rootMargin:'0px 0px -40px'});
    document.querySelectorAll('section,.product-card,.category-choice,.fusion-card,.benefits>div').forEach((el,i)=>{
      if(!el.classList.contains('hero')){el.classList.add('reveal-cinematic');el.style.transitionDelay=Math.min(i%4,3)*70+'ms';io.observe(el)}
    });
  }
  document.addEventListener('pointermove',e=>{document.documentElement.style.setProperty('--mx',e.clientX+'px');document.documentElement.style.setProperty('--my',e.clientY+'px')},{passive:true});
})();

// Fast, flicker-free image reveal for cached, local and Firebase-hosted media.
(()=>{
  const prepare=(img)=>{
    if(!img || img.dataset.kbPrepared) return;
    img.dataset.kbPrepared='1';
    img.decoding='async';
    if(!img.hasAttribute('loading') && !img.closest('.hero,.product-gallery,.kb-page-loader')) img.loading='lazy';
    img.classList.add('kb-img-pending');
    const done=()=>{img.classList.remove('kb-img-pending');img.classList.add('kb-img-ready')};
    if(img.complete && img.naturalWidth) done();
    else {img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true})}
  };
  const scan=(root=document)=>root.querySelectorAll?.('img').forEach(prepare);
  scan();
  new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType!==1)return;if(n.matches?.('img'))prepare(n);scan(n)}))).observe(document.documentElement,{childList:true,subtree:true});
})();

// EDITZ LK / KB Label shared YouTube playlist dock — one controller on every public page.
(()=>{
  const file=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const blockedPages=new Set(['store-admin.html','editz-admin.html','admin-login.html']);
  if(blockedPages.has(file)) return;

  const PLAYLIST_ID='PLSwKLxeDJiPY';
  const KEY='editzYoutubeMusicV1';
  const readState=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
  const writeState=(patch={})=>{try{localStorage.setItem(KEY,JSON.stringify({...readState(),...patch,updated:Date.now()}))}catch{}};

  document.querySelectorAll('#musicPlayer,#background-music,#kbSharedMusicPlayer,#kbSharedAudio,#kbYoutubeHost').forEach(el=>el.remove());

  const root=document.createElement('aside');
  root.className='kb-music-player is-paused needs-gesture';
  root.id='kbSharedMusicPlayer';
  root.setAttribute('aria-label','YouTube playlist controls');
  root.innerHTML=`
    <button class="kb-music-orb" type="button" aria-label="Play playlist" aria-pressed="false">
      <span class="kb-orb-spectrum" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <i class="fa-solid fa-play kb-play-icon"></i>
    </button>
    <button class="kb-volume-trigger" type="button" aria-label="Open music controls" aria-expanded="false"><i class="fa-solid fa-sliders"></i></button>
    <div class="kb-music-panel" role="dialog" aria-label="YouTube playlist player">
      <div class="kb-music-meta"><small>YOUTUBE PLAYLIST</small><strong>LOADING MUSIC…</strong><span>EDITZ LK × KB LABEL</span></div>
      <div class="kb-track-controls">
        <button class="kb-track-prev" type="button" aria-label="Previous song"><i class="fa-solid fa-backward-step"></i></button>
        <button class="kb-track-next" type="button" aria-label="Next song"><i class="fa-solid fa-forward-step"></i></button>
        <a class="kb-open-playlist" href="https://www.youtube.com/playlist?list=${PLAYLIST_ID}" target="_blank" rel="noopener" aria-label="Open playlist on YouTube"><i class="fa-brands fa-youtube"></i></a>
      </div>
      <div class="kb-volume-row">
        <button class="kb-music-volume" type="button" aria-label="Mute playlist"><i class="fa-solid fa-volume-low"></i></button>
        <input type="range" min="0" max="100" value="28" aria-label="Playlist volume">
        <output>28</output>
      </div>
      <p class="kb-music-note">Tap play once to allow sound.</p>
    </div>`;

  const host=document.createElement('div');
  host.id='kbYoutubeHost';
  host.setAttribute('aria-hidden','true');
  host.style.cssText='position:fixed;width:1px;height:1px;left:-9999px;bottom:0;overflow:hidden;opacity:.001;pointer-events:none';
  const playerNode=document.createElement('div');
  playerNode.id='kbYoutubePlayer';
  host.appendChild(playerNode);
  document.body.append(root,host);

  const play=root.querySelector('.kb-music-orb');
  const trigger=root.querySelector('.kb-volume-trigger');
  const slider=root.querySelector('input');
  const output=root.querySelector('output');
  const mute=root.querySelector('.kb-music-volume');
  const volumeIcon=mute.querySelector('i');
  const title=root.querySelector('.kb-music-meta strong');
  const subtitle=root.querySelector('.kb-music-meta span');
  const note=root.querySelector('.kb-music-note');
  const prev=root.querySelector('.kb-track-prev');
  const next=root.querySelector('.kb-track-next');
  const state=readState();
  let yt=null, ready=false, desiredPlaying=state.playing===true, lastVolume=Number.isFinite(+state.lastVolume)?+state.lastVolume:28;
  const initialVolume=Number.isFinite(+state.volume)?Math.max(0,Math.min(100,+state.volume)):28;
  slider.value=String(initialVolume);

  const setPanel=(open)=>{
    root.classList.toggle('open',open);
    trigger.setAttribute('aria-expanded',String(open));
    trigger.setAttribute('aria-label',open?'Close music controls':'Open music controls');
  };
  const isPlaying=()=>ready && yt && yt.getPlayerState && yt.getPlayerState()===1;
  const currentVolume=()=>ready&&yt&&yt.getVolume?yt.getVolume():Number(slider.value)||0;
  const paint=()=>{
    const playing=isPlaying();
    root.classList.toggle('is-paused',!playing); root.classList.toggle('is-playing',playing);
    play.setAttribute('aria-pressed',String(playing));
    play.setAttribute('aria-label',playing?'Pause playlist':'Play playlist');
    play.querySelector('.kb-play-icon').className=`fa-solid fa-${playing?'pause':'play'} kb-play-icon`;
    const v=currentVolume();
    volumeIcon.className=`fa-solid fa-volume-${v===0?'xmark':v<50?'low':'high'}`;
    output.value=String(Math.round(v)); output.textContent=output.value; slider.value=output.value;
  };
  const updateMeta=()=>{
    if(!ready||!yt) return;
    const data=yt.getVideoData?.()||{};
    title.textContent=data.title||'YOUTUBE PLAYLIST';
    subtitle.textContent=data.author?`${data.author} • EDITZ LK × KB LABEL`:'EDITZ LK × KB LABEL';
  };
  const persist=()=>writeState({volume:currentVolume(),lastVolume,playing:isPlaying(),index:ready&&yt.getPlaylistIndex?yt.getPlaylistIndex():0});
  const requestPlay=()=>{
    if(!ready||!yt){desiredPlaying=true;note.textContent='Player is loading…';return}
    try{yt.playVideo();desiredPlaying=true;root.classList.remove('needs-gesture');note.textContent='Playlist is playing in the background.'}catch{root.classList.add('needs-gesture')}
  };
  const toggle=()=>{
    if(!ready){requestPlay();return}
    if(isPlaying()){yt.pauseVideo();desiredPlaying=false}else requestPlay();
    setTimeout(()=>{paint();persist()},80);
  };

  play.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();toggle()});
  trigger.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setPanel(!root.classList.contains('open'))});
  prev.addEventListener('click',e=>{e.stopPropagation();if(ready){yt.previousVideo();requestPlay()}});
  next.addEventListener('click',e=>{e.stopPropagation();if(ready){yt.nextVideo();requestPlay()}});
  slider.addEventListener('input',()=>{const v=+slider.value;if(v>0)lastVolume=v;if(ready)yt.setVolume(v);paint();persist()});
  mute.addEventListener('click',e=>{e.stopPropagation();const v=currentVolume();if(ready){if(v>0){lastVolume=v;yt.setVolume(0)}else yt.setVolume(Math.max(8,lastVolume||28))}paint();persist()});
  document.addEventListener('pointerdown',e=>{if(!root.contains(e.target))setPanel(false)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setPanel(false)});

  const createPlayer=()=>{
    if(ready||!window.YT||!YT.Player) return;
    yt=new YT.Player('kbYoutubePlayer',{
      height:'1',width:'1',
      playerVars:{listType:'playlist',list:PLAYLIST_ID,autoplay:0,controls:0,loop:1,playsinline:1,rel:0,origin:location.origin},
      events:{
        onReady:()=>{
          ready=true;
          root.classList.remove('audio-error');
          yt.setVolume(initialVolume);
          const index=Number.isFinite(+state.index)?Math.max(0,+state.index):0;
          try{yt.loadPlaylist({listType:'playlist',list:PLAYLIST_ID,index,startSeconds:0});yt.pauseVideo()}catch{}
          setTimeout(()=>{try{if(index>0)yt.playVideoAt(index)}catch{};if(desiredPlaying)requestPlay();else yt.pauseVideo();updateMeta();paint()},450);
          note.textContent='Press play to start the YouTube playlist.';
        },
        onStateChange:e=>{
          if(e.data===1){desiredPlaying=true;root.classList.remove('needs-gesture');updateMeta();note.textContent='Playlist is playing in the background.'}
          if(e.data===2){desiredPlaying=false;note.textContent='Music paused.'}
          if(e.data===0){try{yt.nextVideo()}catch{}}
          paint();persist();
        },
        onError:e=>{
          root.classList.add('audio-error');
          title.textContent='PLAYLIST UNAVAILABLE';
          subtitle.textContent='CHECK YOUTUBE PLAYLIST LINK';
          note.textContent=`YouTube error ${e.data}. Open the playlist button to verify it is Public or Unlisted.`;
          paint();
        }
      }
    });
  };

  if(window.YT&&YT.Player) createPlayer();
  else{
    const old=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=()=>{if(typeof old==='function')old();createPlayer()};
    if(!document.querySelector('script[src*="youtube.com/iframe_api"]')){
      const tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';tag.async=true;document.head.appendChild(tag);
    }
  }

  const gestureResume=()=>{if(desiredPlaying&&!isPlaying())requestPlay()};
  document.addEventListener('pointerdown',gestureResume,true);
  document.addEventListener('touchstart',gestureResume,true,{passive:true});
  document.addEventListener('keydown',gestureResume,true);
  ['enter-site','kbEnterSite'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>{desiredPlaying=true;requestPlay()},{capture:true}));
  setInterval(()=>{if(ready){updateMeta();persist()}},2000);
  window.addEventListener('pagehide',persist);
  paint();
})();
