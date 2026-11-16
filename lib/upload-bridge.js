/** CDP sees only paths issued by the transfer registry, never a model-provided disk path. */
export function validateUploadTarget(evidence,files,frameId=0){
 if(frameId)throw Error('The large-file bridge currently targets a top-frame upload input. Open the upload page directly.');
 if(!evidence?.found||evidence.type!=='file'||evidence.disabled)throw Error('A verified file input is required.');
 if(files.length>1&&!evidence.multiple)throw Error('This input accepts one file. Attach one reviewed download ID at a time.');
 if(evidence.accept){const accept=evidence.accept.toLowerCase().split(',').map(v=>v.trim()).filter(Boolean);for(const f of files){const name=f.actualName.toLowerCase(),mime=f.mime.toLowerCase();if(!accept.some(a=>a==='*/*'||a.startsWith('.')&&name.endsWith(a)||a.endsWith('/*')&&(mime.startsWith(a.slice(0,-1))||a==='video/*'&&/\.(mp4|mov|webm|m4v|avi|mkv|mpeg|mpg)$/.test(name))||a===mime))throw Error('The reviewed file does not match this upload input’s accepted types.');}}
}
// Browser-side discovery sees closed shadow roots that isolated page scripts cannot traverse.
// Child documents are deliberately excluded: the bridge remains top-frame only.
export async function inspectCDPUpload(command,files,frameId=0){
 if(frameId)throw Error('Open the upload page directly; the large-file bridge supports top-frame inputs only.');
 await command('DOM.enable');const {root}=await command('DOM.getDocument',{depth:-1,pierce:true});
 const nodes=[],stack=[root];let seen=0;
 while(stack.length){const n=stack.pop();if(++seen>100000)throw Error('Upload DOM exceeds the inspection limit.');
  const attrs=Object.fromEntries(Array.from({length:(n.attributes||[]).length/2},(_,i)=>[n.attributes[i*2],n.attributes[i*2+1]]));
  if(n.localName==='input'&&String(attrs.type).toLowerCase()==='file')nodes.push(n);
  stack.push(...(n.children||[]),...(n.shadowRoots||[]));
 }
 const candidates=[];let disabled=0,incompatible=0;
 for(const n of nodes){
  const {object}=await command('DOM.resolveNode',{backendNodeId:n.backendNodeId});if(!object?.objectId)continue;
  try{const r=await command('Runtime.callFunctionOn',{objectId:object.objectId,functionDeclaration:'function(){return {connected:this.isConnected,type:this.type,disabled:this.disabled,multiple:this.multiple,accept:this.accept};}',returnByValue:true});
   if(r.exceptionDetails||!r.result?.value)throw Error('Chrome could not inspect an upload input.');const v=r.result.value;
   if(!v.connected||v.disabled){disabled++;continue;}
   const evidence={found:true,type:v.type,disabled:v.disabled,multiple:v.multiple,accept:v.accept,transport:'cdp',backendNodeId:n.backendNodeId,documentBackendNodeId:root.backendNodeId};
   try{validateUploadTarget(evidence,files,frameId);candidates.push(evidence);}catch{incompatible++;}
  }finally{await command('Runtime.releaseObject',{objectId:object.objectId});}
 }
 if(candidates.length!==1)throw Error(`Upload input discovery: ${nodes.length} top-frame file input(s), ${candidates.length} compatible, ${disabled} disabled/detached, ${incompatible} incompatible. ${candidates.length?'Multiple eligible inputs: open only the intended upload dialog.':'Open Upload videos and wait for the uploader to finish initializing. Inputs inside child frames are not supported by this bridge.'}`);
 return candidates[0];
}
async function assignCDP({evidence,files,command,signal}){
 let assignmentAttempted=false,objectId;
 try{
  const {root}=await command('DOM.getDocument',{depth:0});if(root.backendNodeId!==evidence.documentBackendNodeId)throw Error('The upload document changed. Inspect it again.');
  const resolved=await command('DOM.resolveNode',{backendNodeId:evidence.backendNodeId});objectId=resolved.object?.objectId;if(!objectId)throw Error('Upload input detached.');
  const before=await command('Runtime.callFunctionOn',{objectId,functionDeclaration:'function(){return {found:this.isConnected,type:this.type,disabled:this.disabled,accept:this.accept,multiple:this.multiple};}',returnByValue:true});
  if(before.exceptionDetails||!before.result?.value)throw Error('Cannot verify upload input.');
  const live=before.result.value;validateUploadTarget(live,files);if(live.disabled||live.accept!==evidence.accept||live.multiple!==evidence.multiple)throw Error('Upload input changed. Inspect it again.');
  signal.throwIfAborted();assignmentAttempted=true;
  await command('DOM.setFileInputFiles',{backendNodeId:evidence.backendNodeId,files:files.map(f=>f.localPath)});
  const after=await command('Runtime.callFunctionOn',{objectId,functionDeclaration:'function(){return Array.from(this.files||[],f=>({name:f.name,size:f.size}));}',returnByValue:true});
  const actual=after.result?.value;const verified=!after.exceptionDetails&&Array.isArray(actual)&&actual.length===files.length&&files.every(f=>actual.some(a=>a.name===f.actualName&&a.size===f.size));
  return {status:verified?'attached':'uncertain',files:files.map(f=>({downloadId:f.downloadId,name:f.actualName,size:f.size})),note:verified?'Chrome verified the assigned FileList. Wait for website upload and processing.':'The website may have consumed/reset the input. Inspect the uploader; do not automatically attach again.'};
 }catch(e){e.assignmentAttempted=assignmentAttempted;throw e;}
 finally{if(objectId)try{await command('Runtime.releaseObject',{objectId});}catch{}}
}
export async function assignDownloads({frameId,evidence,files,command,signal}){
 validateUploadTarget(evidence,files,frameId);
 if(evidence.transport!=='cdp')throw Error('A current browser-verified upload input is required.');
 return await assignCDP({evidence,files,command,signal});
}
