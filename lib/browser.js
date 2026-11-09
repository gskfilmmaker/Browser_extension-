import {checkURL,validateArgs} from './policy.js';
export const attached=new Set(); const logs=new Map();
chrome.debugger.onDetach.addListener(s=>attached.delete(s.tabId));
chrome.debugger.onEvent.addListener((s,m,p)=>{if(m==='Runtime.consoleAPICalled'){const l=logs.get(s.tabId)||[];l.push({type:p.type,text:p.args.map(a=>a.value!==undefined?String(a.value):a.description||'').join(' ').slice(0,2000)});logs.set(s.tabId,l.slice(-100));}});
export async function detachAll(){await Promise.allSettled([...attached].map(tabId=>chrome.debugger.detach({tabId})));attached.clear();}
async function attach(id){if(!attached.has(id)){await chrome.debugger.attach({tabId:id},'1.3');attached.add(id);await cmd(id,'Runtime.enable');}}
const cmd=(id,method,params={})=>chrome.debugger.sendCommand({tabId:id},method,params);
export async function target(id,settings){const t=await chrome.tabs.get(id);checkURL(t.url,settings);return t;}
async function evaluate(id,expression){const r=await cmd(id,'Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails) throw Error('Page evaluation failed.');return r.result.value;}
// User/model text is serialized into data literals, never interpolated as executable code.
async function point(id,a,focus=false){return evaluate(id,`(()=>{const a=${JSON.stringify(a)}; let e=a.selector?document.querySelector(a.selector):[...document.querySelectorAll('a,button,input,[role="button"],label')].find(e=>(e.innerText||e.getAttribute('aria-label')||'').trim()===a.text); if(!e)throw Error('Element not found'); e.scrollIntoView({block:'center'}); ${focus?'e.focus();':''} const r=e.getBoundingClientRect(); if(!r.width||!r.height)throw Error('Element not visible'); const x=r.x+r.width/2,y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y)))throw Error('Element is obscured'); return {x,y,type:e.type,tag:e.tagName,editable:e.isContentEditable};})()`);}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
export async function execute(name,a,ctx){
 validateArgs(name,a); const s=ctx.settings;
 if(name==='get_tabs_context')return (await chrome.tabs.query({})).filter(t=>{try{checkURL(t.url,s);return true;}catch{return false;}}).map(t=>({id:t.id,title:t.title,url:t.url,active:t.active,windowId:t.windowId}));
 if(name==='create_tab'){const t=await chrome.tabs.create({url:checkURL(a.url,s)});ctx.tabId=t.id;return {tabId:t.id};}
 const id=a.tabId??ctx.tabId;await target(id,s);
 if(name==='switch_tab'){await chrome.tabs.update(id,{active:true});ctx.tabId=id;return {tabId:id};}
 if(name==='close_tab'){await chrome.tabs.remove(id);return {closed:id};}
 if(name==='navigate'&&a.url){await chrome.tabs.update(id,{url:checkURL(a.url,s)});return {navigated:a.url};}
 if(name==='read_page'||name==='get_page_text'){
 const [r]=await chrome.scripting.executeScript({target:{tabId:id},files:['content/extract.js']});return name==='read_page'?r.result:{text:r.result.text,url:r.result.url};}
 await attach(id);
 switch(name){
 case 'get_accessibility_tree':{await cmd(id,'Accessibility.enable');const r=await cmd(id,'Accessibility.getFullAXTree');return {nodes:r.nodes.filter(n=>!n.ignored).slice(0,500).map(n=>({id:n.nodeId,role:n.role?.value,name:n.name?.value,children:n.childIds})),limit:500};}
 case 'take_screenshot':return {image:(await cmd(id,'Page.captureScreenshot',{format:'jpeg',quality:65,captureBeyondViewport:false})).data,mime:'image/jpeg'};
 case 'read_console_messages':return {messages:logs.get(id)||[],note:'Only events since attachment are available.'};
 case 'click_element':{const p=a.selector||a.text?await point(id,a):a;await cmd(id,'Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});await cmd(id,'Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});return {clicked:true};}
 case 'form_input':case 'type_text':{
 if(name==='form_input'){const p=await point(id,a,true);if(!['INPUT','TEXTAREA'].includes(p.tag)&&!p.editable)throw Error('Target is not editable.');}
 const info=await evaluate(id,`(()=>{const e=document.activeElement;return {tag:e?.tagName,type:e?.type,editable:e?.isContentEditable};})()`);
 if(!['INPUT','TEXTAREA'].includes(info.tag)&&!info.editable)throw Error('No editable field focused.');
 if(info.tag==='INPUT'&&!['text','search','email','url','tel','number',''].includes(info.type))throw Error('This input type is not supported. Enter sensitive values manually.');
 if(name==='form_input'){const modifiers=(await chrome.runtime.getPlatformInfo()).os==='mac'?4:2;await cmd(id,'Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers});await cmd(id,'Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers});}
 await cmd(id,'Input.insertText',{text:a.text});return {typed:true};}
 case 'scroll':await cmd(id,'Input.dispatchMouseEvent',{type:'mouseWheel',x:100,y:100,deltaX:a.x||0,deltaY:a.y??600});return {scrolled:true};
 case 'navigate':if(a.history==='reload')await cmd(id,'Page.reload');else {const h=await cmd(id,'Page.getNavigationHistory');const e=h.entries[h.currentIndex+(a.history==='back'?-1:1)];if(!e)throw Error('No history entry.');checkURL(e.url,s);await cmd(id,'Page.navigateToHistoryEntry',{entryId:e.id});}return {navigated:true};
 case 'wait_for_element':case 'wait_for_load':{const end=Date.now()+Math.max(100,Math.min(a.timeout||10000,15000));do{if(ctx.signal.aborted)throw Error('Stopped');await target(id,s);const ok=await evaluate(id,name==='wait_for_load'?`document.readyState==='complete'`:`(()=>{const e=document.querySelector(${JSON.stringify(a.selector)});return !!e&&!!e.getClientRects().length;})()`);if(ok)return {ready:true};await pause(250);}while(Date.now()<end);throw Error('Wait timed out.');}
 default:throw Error('Unknown tool.');
 }
}
