/** Self-contained, isolated-world page operations. No model-authored code is evaluated. */
export function pageAction(operation, args = {}) {
  const state = globalThis.__framepilotPage ||= {token: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`, next: 0, refs: new Map(), reverse: new WeakMap()};
  const visible = e => !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
  const roots = [document];
  for (let i = 0; i < roots.length && i < 100; i++) for (const e of [...roots[i].querySelectorAll('*')].slice(0,20000)) {
    if (e.shadowRoot) roots.push(e.shadowRoot);
  }
  const all = selector => roots.flatMap(root => [...root.querySelectorAll(selector)]);
  const ref = e => {
    if (!state.reverse.has(e)) { const id = `${state.token}:${++state.next}`; state.reverse.set(e, id); state.refs.set(id, e); }
    return state.reverse.get(e);
  };
  const label = e => (e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => e.ownerDocument.getElementById(id)?.innerText || '').join(' ').trim() || e.labels?.[0]?.innerText || e.getAttribute('placeholder') || e.innerText || '').trim();
  const role = e => e.getAttribute('role') || ({BUTTON:'button',A:'link',SELECT:'combobox',TEXTAREA:'textbox'}[e.tagName]) || (e.tagName==='INPUT' ? ({checkbox:'checkbox',radio:'radio',search:'searchbox',submit:'button',button:'button'}[e.type] || 'textbox') : '');
  const resolve = (a = args) => {
    if (a.elementRef) {
      const e = state.refs.get(a.elementRef);
      if (!e?.isConnected) throw Error('Stale element reference. Read the page again and use a fresh reference.');
      return e;
    }
    let candidates;
    if (a.selector) candidates = all(a.selector).filter(e=>operation==='upload'||args.includeHidden||visible(e));
    else if (a.role) candidates = all('*').filter(e => visible(e) && role(e)===a.role && (a.name===undefined || label(e)===a.name));
    else if (a.targetText || a.text && !['input','inspect_input'].includes(operation)) candidates = all('a,button,input,textarea,select,[role],[contenteditable="true"],label').filter(e => visible(e) && label(e)===(a.targetText || a.text));
    else if (Number.isFinite(a.x) && Number.isFinite(a.y)) {
      let e = document.elementFromPoint(a.x,a.y);
      while(e?.shadowRoot?.elementFromPoint(a.x,a.y)) e=e.shadowRoot.elementFromPoint(a.x,a.y);
      return e;
    } else {
      let e=document.activeElement;
      while(e?.shadowRoot?.activeElement) e=e.shadowRoot.activeElement;
      return e;
    }
    if (candidates.length!==1) throw Error(candidates.length ? 'Target is ambiguous. Use a unique elementRef from read_page.' : 'Element not found. Read the page again.');
    return candidates[0];
  };
  const describe = e => {
    if(!e) return {found:false};
    const form=e.closest('form'), dialog=e.closest('[role="dialog"],dialog,[role="alertdialog"]');
    return {found:true,elementRef:ref(e),tag:e.tagName,type:e.type||'',role:role(e),label:label(e).slice(0,300),title:e.title||'',name:e.getAttribute('name')||'',id:e.id||'',autocomplete:e.getAttribute('autocomplete')||'',href:e.closest('a')?.href||'',download:e.closest('a')?.hasAttribute('download')||false,submit:!!form&&['submit','image'].includes(e.type),search:!!e.closest('[role="search"]')||!!form?.querySelector('input[type="search"],input[name="q"],[role="searchbox"]'),crossFrame:['IFRAME','FRAME'].includes(e.tagName),checked:['checkbox','radio'].includes(e.type)?e.checked:undefined,selection:e.tagName==='SELECT'?e.value:undefined,multiline:e.isContentEditable||e.tagName==='TEXTAREA',editable:e.isContentEditable||['TEXTAREA','INPUT'].includes(e.tagName),context:(dialog?.innerText||form?.innerText||'').slice(0,1600)};
  };
  const redact = text => String(text).replace(/\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}\b/g,'[REDACTED API KEY]').replace(/\bBearer\s+[A-Za-z0-9._~-]{20,}/gi,'Bearer [REDACTED]');
  if (operation==='read') {
    for(const [id,e] of state.refs)if(!e.isConnected){state.refs.delete(id);state.reverse.delete(e);}
    while(state.refs.size>5000){const [id,e]=state.refs.entries().next().value;state.refs.delete(id);state.reverse.delete(e);}
    const elements=all('a,button,input,textarea,select,[role],[contenteditable="true"],h1,h2,h3').filter(visible).slice(0,500).map(e=>({...describe(e),context:undefined,options:e.tagName==='SELECT'?[...e.options].slice(0,40).map(o=>({label:o.label,value:o.value,selected:o.selected})):undefined}));
    const text=roots.map(root => root===document ? document.body?.innerText||'' : root.textContent||'').join('\n');
    return {title:document.title,url:location.href,text:redact(text).slice(0,30000),elements,snapshot:state.token,truncated:text.length>30000,frames:[...document.querySelectorAll('iframe,frame')].map(e=>({elementRef:ref(e),src:e.src,title:e.title})),scope:'This frame plus open shadow roots. Use get_frames and frameId for embedded documents. Closed shadow roots are unavailable.'};
  }
  if (operation==='inspect') return describe(resolve());
  if (operation==='inspect_input') return describe(resolve({...args,text:undefined}));
  if (operation==='frame_box') {
    const frames=all('iframe,frame').filter(e=>e.src===args.childURL || (!e.src&&args.childURL==='about:blank'));
    if(frames.length!==1) throw Error('Cannot uniquely locate the embedded frame. Use another frame or the main page.');
    const e=frames[0];const transform=getComputedStyle(e).transform;if(transform!=='none'){const m=new DOMMatrixReadOnly(transform);if(m.b||m.c)throw Error('Rotated frames are not supported.');}e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();
    const sx=r.width/e.offsetWidth,sy=r.height/e.offsetHeight;return {x:r.left+e.clientLeft*sx,y:r.top+e.clientTop*sy,width:e.clientWidth*sx,height:e.clientHeight*sy};
  }
  if(operation==='frame_hit'){const e=document.elementFromPoint(args.x,args.y);if(!e||!['IFRAME','FRAME'].includes(e.tagName)||e.src!==args.childURL)throw Error('Embedded frame is obscured or changed.');return {clear:true};}
  if(operation==='viewport') return {width:innerWidth,height:innerHeight};
  if(operation==='monitor_send') {
    state.sendObserver?.disconnect();state.sendChanged=false;
    state.sendObserver=new MutationObserver(records=>{for(const r of records){const target=r.target.nodeType===1?r.target:r.target.parentElement;if(target?.closest('[role="alert"],[role="status"],.toast')||[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('[role="alert"],[role="status"],.toast')||n.querySelector('[role="alert"],[role="status"],.toast'))))state.sendChanged=true;}});
    state.sendObserver.observe(document.body,{subtree:true,childList:true,characterData:true});return {monitoring:true};
  }
  if(operation==='end_send_monitor'){state.sendObserver?.disconnect();return {stopped:true};}
  if(operation==='verify_send') {
    const alerts=all('[role="alert"],[role="status"],.toast').filter(visible).map(e=>e.innerText||'').filter(t=>/\b(message|email|mail)\s+(was\s+)?sent\b|\bsent successfully\b/i.test(t));
    return {confirmed:!!state.sendChanged&&alerts.length>0,evidence:alerts.map(redact).slice(0,5)};
  }
  const e=resolve();
  if(!e) throw Error('No target element. Read the page or focus a field first.');
  if(operation==='locate') {
    e.scrollIntoView({block:'center',inline:'center'});
    const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
    let hit=document.elementFromPoint(x,y);while(hit?.shadowRoot?.elementFromPoint(x,y))hit=hit.shadowRoot.elementFromPoint(x,y);
    if(!r.width||!r.height||!(e===hit||e.contains(hit)))throw Error('Target is hidden or obscured. Read the page again.');
    return {...describe(e),x,y};
  }
  if(operation==='focus') { e.focus();return describe(e); }
  if(operation==='value') return {elementRef:ref(e),value:['password','hidden','file'].includes(e.type)?'[REDACTED]':redact(e.isContentEditable?e.innerText:e.value??''),checked:e.checked,selected:e.tagName==='SELECT'?[...e.selectedOptions].map(o=>o.value):undefined};
  if(operation==='select') {
    if(e.tagName!=='SELECT')throw Error('Target is not a native select. For custom dropdowns, click and use keyboard tools.');
    const option=[...e.options].find(o=>args.value!==undefined?o.value===args.value:o.label===args.option);
    if(!option||option.disabled)throw Error('Requested option is unavailable.');
    e.value=option.value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
    return {selected:e.value,label:option.label,verified:e.value===option.value};
  }
  if(operation==='scroll_element') {e.scrollBy({left:args.x||0,top:args.y??600,behavior:'instant'});return {scrollTop:e.scrollTop,scrollLeft:e.scrollLeft};}
  if(operation==='upload') {
    if(e.tagName!=='INPUT'||e.type!=='file')throw Error('Target must be a file input.');
    if(!e.multiple&&args.files.length>1)throw Error('This field accepts only one file.');
    const transfer=new DataTransfer();
    for(const f of args.files){const binary=atob(f.data);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));transfer.items.add(new File([bytes],f.name,{type:f.type,lastModified:f.lastModified}));}
    e.files=transfer.files;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
    return {attached:[...e.files].map(f=>({name:f.name,size:f.size})),note:'Files assigned to the input. Verify the website finishes processing attachments before submitting.'};
  }
  throw Error('Unknown page operation.');
}
