import {checkURL,validateArgs,needsApproval} from './policy.js';
import {classifyAction} from './action-risk.js';
import {pageAction} from './page.js';
import {inspectEmail} from './mail.js';
import {keyEvent} from './keyboard.js';
import {listFiles,filePayload} from './files.js';
import * as transfers from './transfers.js';
import {assignDownloads,validateUploadTarget} from './upload-bridge.js';
import {inspectYouTube,youtubeDecision} from './youtube.js';
export const attached=new Set();const logs=new Map();
chrome.debugger.onDetach.addListener(s=>attached.delete(s.tabId));
chrome.debugger.onEvent.addListener((s,m,p)=>{if(m==='Runtime.consoleAPICalled'){const rows=logs.get(s.tabId)||[];rows.push({type:p.type,text:p.args.map(a=>a.value!==undefined?String(a.value):a.description||'').join(' ').slice(0,2000)});logs.set(s.tabId,rows.slice(-100));}});
export async function detachAll(){await Promise.allSettled([...attached].map(tabId=>chrome.debugger.detach({tabId})));attached.clear();}
const cmd=(id,method,params={})=>chrome.debugger.sendCommand({tabId:id},method,params);
async function attach(id){if(!attached.has(id)){await chrome.debugger.attach({tabId:id},'1.3');attached.add(id);await cmd(id,'Runtime.enable');}}
export async function target(id,settings){const t=await chrome.tabs.get(id);checkURL(t.url,settings);return t;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const localTools=new Set(['get_tabs_context','create_tab','list_files','update_task','get_download_status','create_upload_job','resume_upload_job','list_upload_jobs','get_upload_job','wait_for_transfer','cancel_upload_job','resume_transfer_download','diagnose_upload_job']);
const inspectTools=new Set(['click_element','hover_element','drag_element','type_text','form_input','press_key','select_option','set_checked','get_element_value','attach_files']);
async function frames(id,settings){const rows=await chrome.webNavigation.getAllFrames({tabId:id});return (rows||[]).filter(f=>{try{checkURL(f.url,settings);return true;}catch{return false;}});}
async function assertFrame(id,frameId,settings){if(!frameId)return;const f=(await frames(id,settings)).find(f=>f.frameId===frameId);if(!f)throw Error('Frame is no longer present or is outside site policy. Read get_frames again.');}
async function runPage(id,frameId,operation,args,settings){await assertFrame(id,frameId,settings);const [result]=await chrome.scripting.executeScript({target:{tabId:id,frameIds:[frameId||0]},func:pageAction,args:[operation,args]});if(!result)throw Error('No response from page frame.');return result.result;}
async function mail(id,frameId,args,settings){await runPage(id,frameId,'read',{},settings);const [r]=await chrome.scripting.executeScript({target:{tabId:id,frameIds:[frameId||0]},func:inspectEmail,args:[args]});if(!r?.result)throw Error('No email composer response.');return r.result;}
async function point(id,frameId,a,settings){
 let p=await runPage(id,frameId,'locate',a,settings);
 if(frameId){const tree=await frames(id,settings);let f=tree.find(f=>f.frameId===frameId);
  while(f&&f.frameId!==0){const viewport=await runPage(id,f.frameId,'viewport',{},settings);const box=await runPage(id,f.parentFrameId,'frame_box',{childURL:f.url},settings);p={...p,x:box.x+p.x*(box.width/viewport.width),y:box.y+p.y*(box.height/viewport.height)};await runPage(id,f.parentFrameId,'frame_hit',{x:p.x,y:p.y,childURL:f.url},settings);f=tree.find(n=>n.frameId===f.parentFrameId);}
 }
 return p;
}
async function mouseClick(id,p,button='left',clickCount=1){await cmd(id,'Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});await cmd(id,'Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button,clickCount});await cmd(id,'Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button,clickCount});}
async function digest(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function prepareAction(name,a,ctx){
 validateArgs(name,a);const s=ctx.settings;let evidence=null,url='',historyURL='',review=null,files=null,destination=null;
 if(a.url)checkURL(a.url,s);
 let id=a.tabId??ctx.tabId;const frameId=a.frameId||0;let job=null,transferReview=null,videoReview=null;
 if(['attach_downloads','finalize_youtube_upload'].includes(name)){job=await transfers.activeJob(a.jobId,s);if(a.tabId!==undefined&&a.tabId!==job.destinationTabId)throw Error('Use the reviewed destination tab.');id=job.destinationTabId;await transfers.destinationFor(job,s);}
 if(name==='create_upload_job')transferReview=await transfers.transferPlan(a,s);
 if(name==='resume_upload_job')transferReview=await transfers.transferPlan(a,s,await transfers.getJob(a.jobId));
 if(!localTools.has(name)){const t=await target(id,s);url=t.url;await assertFrame(id,frameId,s);}
 if(inspectTools.has(name)) evidence=await runPage(id,frameId,name==='type_text'?'inspect_input':'inspect',name==='attach_files'?{...a,includeHidden:true}:a,s);
 if(name==='press_key')keyEvent(a.key,(await chrome.runtime.getPlatformInfo()).os);
 if(name==='drag_element')destination=await runPage(id,frameId,'inspect',{elementRef:a.toElementRef,selector:a.toSelector},s);
 if(name==='navigate'&&['back','forward'].includes(a.history)){await attach(id);const h=await cmd(id,'Page.getNavigationHistory');historyURL=h.entries[h.currentIndex+(a.history==='back'?-1:1)]?.url||'';if(historyURL)checkURL(historyURL,s);}
 const emailClick=(name==='click_element'||name==='press_key'&&/^(Enter|Return|Space)$/.test(a.key||''))&&/^send\b/i.test(evidence?.label||'')&&/^(mail\.google\.com|outlook\.(live|office|office365)\.com|outlook\.cloud\.microsoft)$/.test(new URL(url).hostname);
 if(name==='send_email'||emailClick) review=await mail(id,frameId,a,s);
 if(name==='attach_files'){const available=await listFiles();files=a.fileIds.map(id=>{const f=available.find(f=>f.id===id);if(!f)throw Error('A selected file was removed.');return f;});}
 if(name==='attach_downloads'){files=await transfers.verifiedDownloads(job,a.downloadIds,s);evidence=await runPage(id,frameId,'inspect_upload',a,s);validateUploadTarget(evidence,files,frameId);}
 if(name==='finalize_youtube_upload'){const file=job.files.find(f=>f.downloadId===a.downloadId);if(!file||!['attached','uncertain'].includes(file.status))throw Error('This file is not attached or has already had a finalization attempt. Inspect the job instead of publishing twice.');const snapshot=await youtube(id,s);videoReview=youtubeDecision(job,file,snapshot);evidence=await runPage(id,frameId,'inspect',a,s);if(!/^(publish|save|schedule)$/i.test(evidence.label))throw Error('Specify the actual final Publish, Save or Schedule button.');if(evidence.disabled)throw Error('Finalization is disabled. Wait for checks.');}
 const studioFinal=['click_element','press_key'].includes(name)&&/^https:\/\/studio\.youtube\.com\//.test(url)&&/^(publish|save|schedule)$/i.test(evidence?.label||'');
 if(name==='press_key'&&/^https:\/\/studio\.youtube\.com\//.test(url)){
  const {mediaJobs=[]}=await chrome.storage.local.get('mediaJobs');const guarded=mediaJobs.some(j=>j.destinationTabId===id&&j.status!=='cancelled');
  if(guarded&&((/^(Enter|Return)$/.test(a.key)&&!evidence?.multiline&&evidence?.role!=='button')||(/(?:primary|ctrl|control|meta|cmd|command|alt)\+/i.test(a.key)&&!/^(?:primary|ctrl|control|meta|cmd|command)\+(a|c|z|y)$/i.test(a.key))))throw Error('Use visible Next/Save controls for a reviewed Studio upload; implicit submit shortcuts are disabled.');
 }
 if(studioFinal){const {mediaJobs=[]}=await chrome.storage.local.get('mediaJobs');if(mediaJobs.some(j=>j.destinationTabId===id&&j.status!=='cancelled'))throw Error('Use finalize_youtube_upload with the jobId and current downloadId for a reviewed final action.');}
 let risk=classifyAction(review?'send_email':name,historyURL?{...a,url:historyURL}:a,evidence);
 if(['create_upload_job','resume_upload_job','finalize_youtube_upload'].includes(name)||studioFinal)risk={level:'critical',reason:videoReview?'Review the actual video details and visibility before saving or publishing.':'Review this batch transfer plan.'};
 if(name==='attach_downloads')risk={level:'routine',reason:'Attaching files covered by this active reviewed batch.'};
 if(name==='click_element'&&evidence?.label&&await transfers.captureGrant(id,url,evidence.label,s))risk={level:'routine',reason:'Download covered by the reviewed batch capture.'};
 if(destination){const r=classifyAction('click_element',a,destination);if(r.level!=='routine')risk=r;}
 return {targetTabId:id,risk,evidence,url,review,files,transferReview,videoReview,signature:JSON.stringify({name,a,url,evidence,historyURL,review,files:files?.map(({localPath,...f})=>f),destination,transferReview,videoReview})};
}
async function sendReviewed(id,frameId,prepared,ctx){
 const review=prepared.review,s=ctx.settings;
 const key=await digest({...review,sendRef:undefined,warnings:undefined});
 const stored=(await chrome.storage.session.get('emailAttempts')).emailAttempts||[];
 if(stored.some(x=>x.key===key))throw Error('This email already has a recorded send attempt. Check Sent before retrying; FramePilot will not automatically send it twice.');
 const p=await point(id,frameId,{elementRef:review.sendRef},s);
 const fresh=await mail(id,frameId,{elementRef:review.sendRef},s);if(JSON.stringify(fresh)!==JSON.stringify(review))throw Error('The email changed just before sending. Request a fresh review.');
 await runPage(id,frameId,'monitor_send',{},s);
 // Write-ahead record: a lost browser response must not trigger another send.
 const entry={key,time:Date.now(),url:review.url,status:'attempted'};
 ctx.signal.throwIfAborted();await chrome.storage.session.set({emailAttempts:[...stored,entry].slice(-200)});
 ctx.signal.throwIfAborted();await mouseClick(id,p);
 const end=Date.now()+6000;
 do{if(ctx.signal.aborted)break;await delay(300);try{await target(id,s);const outcome=await runPage(id,frameId,'verify_send',{},s);if(outcome.confirmed){await runPage(id,frameId,'end_send_monitor',{},s);entry.status='submission-confirmed';await chrome.storage.session.set({emailAttempts:[...stored,entry].slice(-200)});return {status:'submission-confirmed',evidence:outcome.evidence,note:'The website reports sent. This is not proof of recipient delivery.'};}}catch{break;}}while(Date.now()<end);
 try{await runPage(id,frameId,'end_send_monitor',{},s);}catch{}
 return {status:'uncertain',note:'Send was attempted, but no clear confirmation was observed. Do not retry. Inspect the Sent folder or ask the user to verify.'};
}
async function youtube(id,settings){await runPage(id,0,'read',{},settings);const [r]=await chrome.scripting.executeScript({target:{tabId:id,frameIds:[0]},func:inspectYouTube,args:[]});if(!r?.result)throw Error('No YouTube upload state.');return r.result;}
async function finalizeVideo(id,frameId,a,prepared,ctx){
 const s=ctx.settings;await attach(id);const position=await point(id,frameId,a,s);
 const job=await transfers.activeJob(a.jobId,s),file=job.files.find(f=>f.downloadId===a.downloadId);
 const fresh=youtubeDecision(job,file,await youtube(id,s));if(JSON.stringify(fresh)!==JSON.stringify(prepared.videoReview))throw Error('Video metadata changed after approval. Inspect and review again.');
 await runPage(id,0,'monitor_commit',{},s);ctx.signal.throwIfAborted();await transfers.markFiles(a.jobId,[a.downloadId],'finalizing',{finalizationAttemptedAt:Date.now()});
 try{ctx.signal.throwIfAborted();await mouseClick(id,position);const end=Date.now()+6000;
  do{ctx.signal.throwIfAborted();await delay(300);const result=await runPage(id,0,'verify_commit',{},s);if(result.confirmed){await transfers.markFiles(a.jobId,[a.downloadId],'finalized',{finalizationEvidence:result.evidence,videoLinks:fresh.videoLinks});return {status:'website-confirmed-save',evidence:result.evidence,videoLinks:fresh.videoLinks,note:'Verify the video link and visibility in Studio. Website confirmation is not proof of public availability or processing/copyright clearance.'};}}while(Date.now()<end);
  await transfers.markFiles(a.jobId,[a.downloadId],'finalize-uncertain');return {status:'uncertain',note:'Final save/publish was attempted. Inspect Studio before retrying; do not create another upload.'};
 }catch(e){await transfers.markFiles(a.jobId,[a.downloadId],'finalize-uncertain',{error:e.message});throw e;}
 finally{try{await runPage(id,0,'end_commit_monitor',{},s);}catch{}}
}
export async function execute(name,a,ctx){
 const prepared=await prepareAction(name,a,ctx),s=ctx.settings;ctx.signal.throwIfAborted();
 if(ctx.authorization&&ctx.authorization.signature!==prepared.signature)throw Error('The action target or reviewed content changed. Read the page and request fresh approval.');
 if(needsApproval(name,s.mode,prepared.risk)&&!ctx.authorization?.approved)throw Error('This action requires confirmation before execution.');
 let id=a.tabId??ctx.tabId;const frameId=a.frameId||0;
 if(['attach_downloads','finalize_youtube_upload'].includes(name)){const job=await transfers.activeJob(a.jobId,s);id=job.destinationTabId;ctx.tabId=id;}
 if(name==='create_upload_job'){const job=await transfers.createJob(prepared.transferReview);ctx.mediaJobId=job.id;return job;}
 if(name==='resume_upload_job'){const job=await transfers.resumeJob(a.jobId,prepared.transferReview);ctx.mediaJobId=job.id;return job;}
 if(name==='resume_transfer_download'){const job=await transfers.activeJob(a.jobId,s);const file=job.files.find(f=>f.downloadId===a.downloadId);if(!file||file.status!=='download-interrupted')throw Error('Only an interrupted registered download can resume.');const [d]=await chrome.downloads.search({id:a.downloadId});if(!d||d.url!==file.originalURL||!d.canResume||d.state!=='interrupted')throw Error('Chrome cannot resume this download. Start a fresh reviewed transfer instead.');await chrome.downloads.resume(a.downloadId);return {downloadId:a.downloadId,status:'resuming'};}
 if(name==='diagnose_upload_job'){if(chrome.downloads?.search)await transfers.refreshJobs();return await transfers.diagnoseJob(a.jobId,s);}
 if(name==='cancel_upload_job')return await transfers.cancelJob(a.jobId);
 if(name==='list_upload_jobs')return {jobs:(await transfers.refreshJobs()).filter(j=>{try{checkURL(j.sourceURL,s);checkURL(j.destinationURL,s);return true;}catch{return false;}})};
 if(name==='get_upload_job'||name==='wait_for_transfer'){const end=Date.now()+(name==='wait_for_transfer'?Math.max(1000,Math.min(a.timeout||30000,120000)):0);let job;do{ctx.signal.throwIfAborted();await transfers.refreshJobs();job=await transfers.getJob(a.jobId);checkURL(job.sourceURL,s);checkURL(job.destinationURL,s);if(name==='get_upload_job'||job.files.every(f=>!['waiting','downloading'].includes(f.status)))break;await delay(1000);}while(Date.now()<end);ctx.mediaJobId=a.jobId;return transfers.publicJob(job);}
 if(name==='update_task'){ctx.steps=a.steps;return {steps:a.steps};}
 if(name==='list_files')return {files:await listFiles()};
 if(name==='get_tabs_context')return (await chrome.tabs.query({})).filter(t=>{try{checkURL(t.url,s);return true;}catch{return false;}}).map(t=>({id:t.id,title:t.title,url:t.url,active:t.active,windowId:t.windowId}));
 if(name==='create_tab'){const t=await chrome.tabs.create({url:checkURL(a.url,s)});ctx.tabId=t.id;return {tabId:t.id};}
 if(name==='get_download_status'){const owned=(await chrome.storage.session.get('downloadIds')).downloadIds||[];if(!owned.includes(a.downloadId))throw Error('Only FramePilot-initiated downloads can be inspected.');const [d]=await chrome.downloads.search({id:a.downloadId});return d?{id:d.id,state:d.state,filename:d.filename?.split(/[\\/]/).pop(),error:d.error}: {error:'Download not found.'};}
 if(name==='switch_tab'){const tab=await chrome.tabs.update(id,{active:true});if(chrome.windows?.update&&tab.windowId!==undefined)await chrome.windows.update(tab.windowId,{focused:true});ctx.tabId=id;return {tabId:id};}
 if(name==='close_tab'){await chrome.tabs.remove(id);return {closed:id};}
 if(name==='get_frames')return {frames:await frames(id,s)};
 if(name==='navigate'&&a.url){await chrome.tabs.update(id,{url:checkURL(a.url,s)});return {navigated:a.url,next:'Use wait_for_load or read_page to verify the destination.'};}
 if(name==='read_page'||name==='get_page_text'){const data=await runPage(id,frameId,'read',{},s);return name==='read_page'?{...data,frameId}:{text:data.text,url:data.url,frameId};}
 if(name==='inspect_youtube_upload')return await youtube(id,s);
 if(name==='attach_downloads'){const ids=prepared.files.filter(f=>f.status==='ready').map(f=>f.downloadId);if(!ids.length)return {status:'already-attached',note:'Inspect the uploader; files were not attached again.'};if(ids.length!==prepared.files.length)throw Error('Choose only ready files; other files were already attached.');await attach(id);await transfers.markFiles(a.jobId,ids,'attaching',{attachedTabId:id});try{const result=await assignDownloads({id,frameId,args:a,evidence:prepared.evidence,files:prepared.files,page:(op,data)=>runPage(id,frameId,op,data,s),command:(method,data)=>cmd(id,method,data),signal:ctx.signal});await transfers.markFiles(a.jobId,ids,result.status);ctx.mediaJobId=a.jobId;return result;}catch(e){const mayHaveAssigned=e.assignmentAttempted===true;const message=/permission|not allowed|access denied/i.test(e.message)?'Chrome denied file access. Review the extension’s file-access settings on your Mac.':mayHaveAssigned?'Chrome did not confirm assignment; inspect the uploader before retrying.':'Chrome could not identify an eligible upload input; read the page and try a unique input.';await transfers.markFiles(a.jobId,ids,mayHaveAssigned?'uncertain':'ready',{error:message});throw Error(message);}}
 if(name==='finalize_youtube_upload')return await finalizeVideo(id,frameId,a,prepared,ctx);
 if(name==='inspect_email_draft')return await mail(id,frameId,a,s);
 if(name==='get_element_value')return await runPage(id,frameId,'value',a,s);
 if(name==='select_option')return await runPage(id,frameId,'select',a,s);
 if(name==='attach_files')return await runPage(id,frameId,'upload',{...a,files:await filePayload(a.fileIds)},s);
 if(name==='download_file'){
  const downloadId=await chrome.downloads.download({url:checkURL(a.url,s),saveAs:false});const ids=(await chrome.storage.session.get('downloadIds')).downloadIds||[];await chrome.storage.session.set({downloadIds:[...ids,downloadId].slice(-200)});
  return {downloadId,status:'started',next:'Use get_download_status; report success only after state is complete.'};
 }
 if(name==='wait_for_element'||name==='wait_for_load'){
  const end=Date.now()+Math.max(100,Math.min(a.timeout||10000,15000));let last='';
  do{ctx.signal.throwIfAborted();try{await target(id,s);if(name==='wait_for_element'){const e=await runPage(id,frameId,'locate',a,s);if(e.found)return {ready:true,elementRef:e.elementRef};}else{const [r]=await chrome.scripting.executeScript({target:{tabId:id,frameIds:[frameId]},func:()=>document.readyState});if(r?.result==='complete')return {ready:true};}}catch(e){last=e.message;}await delay(250);}while(Date.now()<end);
  throw Error('Wait timed out.'+(last?' '+last:''));
 }
 await attach(id);
 if(prepared.review)return await sendReviewed(id,frameId,prepared,ctx);
 switch(name){
  case 'get_accessibility_tree':{if(frameId)throw Error('Use read_page with frameId for frame-specific element references.');await cmd(id,'Accessibility.enable');const r=await cmd(id,'Accessibility.getFullAXTree');return {nodes:r.nodes.filter(n=>!n.ignored).slice(0,600).map(n=>({id:n.nodeId,role:n.role?.value,name:n.name?.value,children:n.childIds})),scope:'Chrome accessibility tree; use read_page for actionable elementRefs.'};}
  case 'take_screenshot':return {image:(await cmd(id,'Page.captureScreenshot',{format:'jpeg',quality:65,captureBeyondViewport:false})).data,mime:'image/jpeg'};
  case 'read_console_messages':return {messages:logs.get(id)||[],note:'Only events since debugger attachment are available.'};
  case 'click_element':{const p=await point(id,frameId,a,s);await mouseClick(id,p,a.button||'left',a.clickCount||1);return {clicked:true,elementRef:p.elementRef,next:'Read the page to verify the effect.'};}
  case 'hover_element':{const p=await point(id,frameId,a,s);await cmd(id,'Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});return {hovered:true};}
  case 'drag_element':{
   const from=await point(id,frameId,a,s),to=await point(id,frameId,{elementRef:a.toElementRef,selector:a.toSelector},s);
   await cmd(id,'Input.dispatchMouseEvent',{type:'mouseMoved',x:from.x,y:from.y});await cmd(id,'Input.dispatchMouseEvent',{type:'mousePressed',x:from.x,y:from.y,button:'left',clickCount:1});
   try{for(let i=1;i<=12;i++)await cmd(id,'Input.dispatchMouseEvent',{type:'mouseMoved',x:from.x+(to.x-from.x)*i/12,y:from.y+(to.y-from.y)*i/12,button:'left',buttons:1});}finally{await cmd(id,'Input.dispatchMouseEvent',{type:'mouseReleased',x:to.x,y:to.y,button:'left',clickCount:1});}
   return {dragged:true,note:'Verify the page effect; custom HTML drag-and-drop implementations may reject synthetic input.'};
  }
  case 'set_checked':{const value=await runPage(id,frameId,'value',a,s);if(!['checkbox','radio'].includes(prepared.evidence?.type))throw Error('Target must be a native checkbox or radio.');if(value.checked!==a.checked){if(prepared.evidence.type==='radio'&&!a.checked)throw Error('Select another radio option to change this group.');await mouseClick(id,await point(id,frameId,a,s));}const after=await runPage(id,frameId,'value',a,s);return {checked:after.checked,verified:after.checked===a.checked};}
  case 'form_input':case 'type_text':{
   const info=await runPage(id,frameId,'focus',name==='type_text'?{}:a,s);
   if(!info.editable||['password','file','hidden','checkbox','radio','submit','button'].includes(info.type))throw Error('Not a supported editable field. Enter passwords manually.');
   if(name==='form_input'){const key=keyEvent('Primary+A',(await chrome.runtime.getPlatformInfo()).os);await cmd(id,'Input.dispatchKeyEvent',{type:'keyDown',...key});await cmd(id,'Input.dispatchKeyEvent',{type:'keyUp',...key});}
   await cmd(id,'Input.insertText',{text:a.text});const value=await runPage(id,frameId,'value',{elementRef:info.elementRef},s);
   return {typed:true,value:value.value,verified:name==='form_input'?value.value===a.text:undefined};
  }
  case 'press_key':{
   if(a.elementRef||a.selector||a.role)await runPage(id,frameId,'focus',a,s);
   const key=keyEvent(a.key,(await chrome.runtime.getPlatformInfo()).os);
   await cmd(id,'Input.dispatchKeyEvent',{type:'keyDown',...key,...(key.key==='Enter'&&!key.modifiers?{text:'\r'}:{})});await cmd(id,'Input.dispatchKeyEvent',{type:'keyUp',...key});return {pressed:a.key,next:'Read the page to verify the effect.'};
  }
  case 'scroll':if(a.elementRef||a.selector||a.role)return await runPage(id,frameId,'scroll_element',a,s);else{await cmd(id,'Input.dispatchMouseEvent',{type:'mouseWheel',x:100,y:100,deltaX:a.x||0,deltaY:a.y??600});return {scrolled:true};}
  case 'navigate':if(a.history==='reload')await cmd(id,'Page.reload');else{const h=await cmd(id,'Page.getNavigationHistory'),e=h.entries[h.currentIndex+(a.history==='back'?-1:1)];if(!e)throw Error('No history entry.');checkURL(e.url,s);await cmd(id,'Page.navigateToHistoryEntry',{entryId:e.id});}return {navigated:true};
  default:throw Error('Unknown tool.');
 }
}
