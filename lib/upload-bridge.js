/** CDP sees only paths issued by the transfer registry, never a model-provided disk path. */
export function validateUploadTarget(evidence,files,frameId=0){
 if(frameId)throw Error('The large-file bridge currently targets a top-frame upload input. Open the upload page directly.');
 if(!evidence?.found||evidence.type!=='file')throw Error('A verified file input is required.');
 if(files.length>1&&!evidence.multiple)throw Error('This input accepts one file. Attach one reviewed download ID at a time.');
 if(evidence.accept){const accept=evidence.accept.toLowerCase().split(',').map(v=>v.trim()).filter(Boolean);for(const f of files){const name=f.actualName.toLowerCase(),mime=f.mime.toLowerCase();if(!accept.some(a=>a==='*/*'||a.startsWith('.')&&name.endsWith(a)||a.endsWith('/*')&&(mime.startsWith(a.slice(0,-1))||a==='video/*'&&/\.(mp4|mov|webm|m4v|avi|mkv|mpeg|mpg)$/.test(name))||a===mime))throw Error('The reviewed file does not match this upload input’s accepted types.');}}
}
export async function assignDownloads({id,frameId,args,evidence,files,page,command,signal}){
 validateUploadTarget(evidence,files,frameId);
 const marker=crypto.randomUUID();const locator={elementRef:evidence.elementRef,marker,expectedRef:evidence.elementRef};
 let searchId,assignmentAttempted=false;
 try{
  signal.throwIfAborted();await page('mark_upload_target',locator);
  await command('DOM.enable');await command('DOM.getDocument',{depth:0,pierce:true});
  const search=await command('DOM.performSearch',{query:`input[data-framepilot-upload="${marker}"]`,includeUserAgentShadowDOM:true});searchId=search.searchId;
  if(search.resultCount!==1)throw Error('Chrome could not uniquely identify the upload input. Read the page and try a more specific locator.');
  const nodes=await command('DOM.getSearchResults',{searchId,fromIndex:0,toIndex:1});const nodeId=nodes.nodeIds[0];if(!nodeId)throw Error('This frame or shadow upload input cannot be addressed by Chrome.');
  const {node}=await command('DOM.describeNode',{nodeId});const attrs=node.attributes||[];const typeIndex=attrs.indexOf('type');if(node.localName!=='input'||typeIndex<0||attrs[typeIndex+1]!=='file')throw Error('The upload target changed.');
  signal.throwIfAborted();assignmentAttempted=true;await command('DOM.setFileInputFiles',{nodeId,files:files.map(f=>f.localPath)});
  const actual=await page('upload_value',locator);
  const verified=actual.files.length===files.length&&files.every(f=>actual.files.some(a=>a.name===f.actualName&&a.size===f.size));
  return {status:verified?'attached':'uncertain',files:files.map(f=>({downloadId:f.downloadId,name:f.actualName,size:f.size})),note:verified?'Files assigned directly by Chrome. Wait for the website to finish uploading/processing; this is not publication.':'The website may have consumed/reset the input. Inspect the uploader before doing anything else; do not automatically attach again.'};
 }catch(e){e.assignmentAttempted=assignmentAttempted;throw e;}finally{
  if(searchId)try{await command('DOM.discardSearchResults',{searchId});}catch{}
  try{await page('clear_upload_marker',locator);}catch{}
 }
}
