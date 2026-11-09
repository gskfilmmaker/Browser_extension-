// Injected on demand in the isolated world; no persistent page listener.
(()=>{
 const visible=e=>!!(e.getClientRects().length)&&getComputedStyle(e).visibility!=='hidden';
 const nodes=[...document.querySelectorAll('a,button,input,textarea,select,[role],h1,h2,h3')].filter(visible).slice(0,350).map(e=>({tag:e.tagName.toLowerCase(),role:e.getAttribute('role'),id:e.id||undefined,name:(e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.innerText||'').slice(0,180),type:e.getAttribute('type'),href:e.tagName==='A'?e.href:undefined}));
 return {title:document.title,url:location.href,text:document.body?.innerText.slice(0,24000)||'',elements:nodes,truncated:(document.body?.innerText.length||0)>24000,scope:'Top frame only; embedded frames and closed shadow roots are not included.'};
})()
