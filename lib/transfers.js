/** Persistent metadata-only upload jobs. Paths come only from matched Chrome downloads. */
import {checkURL} from './policy.js';
export const MEDIA_KEY='mediaJobs';
const basename=path=>String(path||'').split(/[\\/]/).pop();
export const canonicalName=name=>String(name||'').normalize('NFC').replace(/ \(\d+\)(?=\.[^.]+$)/,'').toLowerCase();
const driveHost=host=>host==='drive.google.com'||host==='drive.usercontent.google.com'||host.endsWith('-docs.googleusercontent.com')||host==='docs.google.com';
const fileId=url=>{try{const u=new URL(url);return u.pathname.match(/\/file\/d\/([\w-]+)/)?.[1]||u.searchParams.get('id')||'';}catch{return '';}};
const channelId=url=>new URL(url).pathname.match(/\/channel\/([\w-]+)/)?.[1]||'';
let tail=Promise.resolve();
async function mutate(fn){const previous=tail;let release;tail=new Promise(r=>{release=r;});await previous;try{const {mediaJobs=[]}=await chrome.storage.local.get(MEDIA_KEY);const result=await fn(mediaJobs);await chrome.storage.local.set({[MEDIA_KEY]:mediaJobs});return result;}finally{release();}}
export async function browserSession(){const {mediaBrowserSessionId}=await chrome.storage.session.get('mediaBrowserSessionId');if(mediaBrowserSessionId)return mediaBrowserSessionId;const id=crypto.randomUUID();await chrome.storage.session.set({mediaBrowserSessionId:id});return id;}
async function tabsFor(sourceId,destinationId,settings){const [source,destination]=await Promise.all([chrome.tabs.get(sourceId),chrome.tabs.get(destinationId)]);checkURL(source.url,settings);checkURL(destination.url,settings);if(source.id===destination.id)throw Error('Use separate source and upload tabs.');return {source,destination};}
export async function transferPlan(args,settings,existing=null){
 const {source,destination}=await tabsFor(args.sourceTabId,args.destinationTabId,settings);
 const files=existing?existing.files.map(({name,sourceURL,title,description})=>({name,sourceURL,title,description})):args.files;
 if(!Array.isArray(files)||!files.length||files.length>10)throw Error('Choose 1–10 individually named files.');
 const seen=new Set();for(const f of files){if(!f||typeof f.name!=='string'||!f.name.trim()||f.name.length>255||/[\\/]/.test(f.name))throw Error('Each file needs a basename, not a disk path.');const key=canonicalName(f.name);if(seen.has(key))throw Error('File names must be unique within this batch.');seen.add(key);if(f.sourceURL)checkURL(f.sourceURL,settings);if(f.title!==undefined&&(typeof f.title!=='string'||f.title.length>100))throw Error('Video titles must be 100 characters or fewer.');if(f.description!==undefined&&(typeof f.description!=='string'||f.description.length>5000))throw Error('Descriptions must be 5000 characters or fewer.');}
 const visibility=existing?.visibility||args.visibility||'private';if(!['private','unlisted','public'].includes(visibility))throw Error('Choose private, unlisted or public visibility.');
 const studio=new URL(destination.url).hostname==='studio.youtube.com';const destinationChannelId=channelId(destination.url);
 if(studio&&!destinationChannelId)throw Error('Open the intended channel in YouTube Studio first so its channel ID can be verified.');
 if(existing&&existing.destinationChannelId&&destinationChannelId!==existing.destinationChannelId)throw Error('The resumed job targets a different YouTube channel. Create a new reviewed job instead.');
 return {sourceTabId:source.id,sourceURL:source.url,destinationTabId:destination.id,destinationURL:destination.url,destinationOrigin:new URL(destination.url).origin,destinationChannelId,channel:existing?.channel||args.channel||destination.title||'',visibility,madeForKids:existing?.madeForKids??args.madeForKids??null,modelRoundLimit:Math.min(120,Math.max(settings.maxSteps||60,settings.mediaMaxSteps||80)),files:files.map(f=>({name:f.name,sourceURL:f.sourceURL||'',title:f.title,description:f.description})),notice:'Approve downloading these exact files and attaching them to this destination. Publication/visibility changes still require a separate final review. No arbitrary local files are authorized. This transfer may use the displayed model-round allowance; provider usage charges apply.'};
}
export async function getJob(id){const {mediaJobs=[]}=await chrome.storage.local.get(MEDIA_KEY);const job=mediaJobs.find(j=>j.id===id);if(!job)throw Error('Upload job not found.');return job;}
export function publicJob(job){const {sessionId,...safe}=job;return {...safe,files:job.files.map(({localPath,originalURL,finalURL,...file})=>({...file,sourceHost:(()=>{try{return new URL(originalURL||job.sourceURL).hostname;}catch{return '';}})()}))};}
export async function createJob(plan){const sessionId=await browserSession();return await mutate(jobs=>{if(jobs.length>=50)throw Error('Forget an old transfer job first (50-job limit).');const now=Date.now();const job={id:crypto.randomUUID(),...plan,sessionId,createdAt:now,captureStartedAt:now,captureUntil:now+30*60000,grantExpires:now+24*3600000,status:'waiting-for-downloads',files:plan.files.map(f=>({...f,status:'waiting'}))};jobs.push(job);return publicJob(job);});}
export async function resumeJob(id,plan){const sessionId=await browserSession();return await mutate(jobs=>{const j=jobs.find(j=>j.id===id);if(!j)throw Error('Upload job not found.');if(j.status==='cancelled')throw Error('A cancelled job cannot resume. Create a new reviewed job.');const {files:plannedFiles,...binding}=plan;Object.assign(j,binding,{sessionId,captureStartedAt:Date.now(),captureUntil:Date.now()+30*60000,grantExpires:Date.now()+24*3600000});return publicJob(j);});}
export async function activeJob(id,settings){const j=await getJob(id);if(j.status==='cancelled')throw Error('Transfer approval was revoked.');if(j.sessionId!==await browserSession()||Date.now()>j.grantExpires)throw Error('Resume this job for a fresh review after a browser restart or expired approval.');checkURL(j.sourceURL,settings);checkURL(j.destinationURL,settings);return j;}
export async function destinationFor(job,settings){const t=await chrome.tabs.get(job.destinationTabId);checkURL(t.url,settings);if(new URL(t.url).origin!==job.destinationOrigin)throw Error('The destination tab changed site. Resume the job with the correct destination.');if(job.destinationChannelId&&channelId(t.url)!==job.destinationChannelId)throw Error('The destination channel changed. Open the reviewed channel before attaching.');return t;}
export async function cancelJob(id){return await mutate(jobs=>{const j=jobs.find(j=>j.id===id);if(!j)throw Error('Upload job not found.');j.status='cancelled';j.grantExpires=0;return publicJob(j);});}
export async function forgetJob(id){return await mutate(jobs=>{const index=jobs.findIndex(j=>j.id===id);if(index>=0)jobs.splice(index,1);return {forgotten:id,note:'Downloaded files were not deleted.'};});}
function sourceMatches(job,item,file){
 const started=Date.parse(item.startTime||'');if(!Number.isFinite(started)||started<(job.captureStartedAt||job.createdAt)-1000||started>job.captureUntil)return false;
 if(canonicalName(basename(item.filename))!==canonicalName(file.name))return false;
 const origin=new URL(job.sourceURL).origin;let match=false;
 for(const value of [item.url,item.referrer,item.finalUrl]){if(!value)continue;try{const u=new URL(value);if(u.protocol!=='https:'&&u.protocol!=='http:')continue;if(u.origin===origin||(driveHost(new URL(job.sourceURL).hostname)&&driveHost(u.hostname)))match=true;}catch{}}
 if(!match)return false;
 if(file.sourceURL){const expectedId=fileId(file.sourceURL);if(expectedId&&![item.url,item.finalUrl,item.referrer].some(u=>fileId(u)===expectedId))return false;}
 return true;
}
function safeDownload(item){return item.state==='complete'&&item.exists!==false&&item.filename&&item.fileSize>0&&['safe','deepScannedSafe','allowlistedByPolicy'].includes(item.danger||'safe')&&!/text\/html|application\/(?:x-msdownload|x-executable)/i.test(item.mime||'');}
export async function captureDownload(item){
 await mutate(jobs=>{for(const job of jobs){if(job.status==='cancelled')continue;for(const file of job.files){
  if(file.downloadId!==undefined&&file.downloadId!==item.id)continue;
  if(file.downloadId===undefined&&!sourceMatches(job,item,file))continue;
  if(file.downloadId===undefined)Object.assign(file,{downloadId:item.id,originalURL:item.url,finalURL:item.finalUrl||'',startedAt:item.startTime});
  if(['attaching','attached','uncertain','finalizing','finalized'].includes(file.status))continue;
  file.bytesReceived=item.bytesReceived||0;file.totalBytes=item.totalBytes||item.fileSize||0;
  if(item.state==='interrupted'){file.status='download-interrupted';file.error=item.error||'Download interrupted';}
  else if(item.state==='complete'){
   if(file.status==='ready'&&(file.localPath!==item.filename||file.size!==item.fileSize)){file.status='download-rejected';file.error='The completed download metadata changed.';continue;}
   if(safeDownload(item)){Object.assign(file,{status:'ready',localPath:item.filename,actualName:basename(item.filename),size:item.fileSize,mime:item.mime||'',completedAt:item.endTime});delete file.error;}
   else{file.status='download-rejected';file.error='The download is missing, unsafe, empty, or an HTML warning instead of the requested file.';}
  }else file.status='downloading';
 }
 if(job.files.every(f=>f.status==='finalized'))job.status='finalized';else if(job.files.every(f=>f.status==='ready'))job.status='files-ready';
 }});
}
export async function refreshJobs(){
 const {mediaJobs=[]}=await chrome.storage.local.get(MEDIA_KEY);if(!mediaJobs.length)return [];
 const sessions=await browserSession();const live=mediaJobs.filter(j=>j.status!=='cancelled'&&j.sessionId===sessions);
 for(const job of live){for(const file of job.files.filter(f=>f.downloadId!==undefined&&!['ready','attached','finalized','uncertain','finalizing','finalize-uncertain'].includes(f.status))){const [d]=await chrome.downloads.search({id:file.downloadId});if(d)await captureDownload(d);}
 const rows=await chrome.downloads.search({startedAfter:new Date(job.createdAt-1000).toISOString(),limit:100,orderBy:['-startTime']});for(const row of rows)if(job.files.some(f=>f.downloadId===row.id||sourceMatches(job,row,f)))await captureDownload(row);}
 const {mediaJobs:updated=[]}=await chrome.storage.local.get(MEDIA_KEY);return updated.map(publicJob);
}
export async function captureGrant(tabId,url,label,settings){
 if(!/^download(?:\s+(?:file|files))?(?:\s*\(\d+\))?[.…]*$/i.test(label.trim()))return null;
 const {mediaJobs=[]}=await chrome.storage.local.get(MEDIA_KEY);for(const j of mediaJobs){if(j.sourceTabId!==tabId||j.sourceURL!==url||Date.now()>j.captureUntil||j.status==='cancelled')continue;try{await activeJob(j.id,settings);return j.id;}catch{}}
 return null;
}
export async function verifiedDownloads(job,ids,settings){
 await destinationFor(job,settings);
 const chosen=ids?.length?ids:job.files.map(f=>f.downloadId);
 if(chosen.some(id=>!Number.isInteger(id))||new Set(chosen).size!==chosen.length)throw Error('Wait for all requested downloads or supply unique ready download IDs.');
 const files=[];for(const id of chosen){const f=job.files.find(f=>f.downloadId===id);if(!f)throw Error('This download is not in the reviewed batch.');if(['attaching','uncertain','finalizing'].includes(f.status))throw Error('This file has an uncertain attempt. Inspect the uploader before trying again; do not duplicate it.');if(!['ready','attached','finalized'].includes(f.status))throw Error('Download is not ready.');const [d]=await chrome.downloads.search({id});if(!d||!safeDownload(d)||d.filename!==f.localPath||d.fileSize!==f.size||d.url!==f.originalURL)throw Error('The downloaded file changed, was removed, or is unsafe. Download and review it again.');files.push(f);}
 return files;
}
export async function markFiles(jobId,ids,status,extra={}){return await mutate(jobs=>{const j=jobs.find(j=>j.id===jobId);if(!j)throw Error('Job not found.');for(const f of j.files)if(ids.includes(f.downloadId))Object.assign(f,{status,...extra});j.status=status==='attached'?'attached-awaiting-processing':status==='finalized'?(j.files.every(f=>f.status==='finalized')?'finalized':'partially-finalized'):status;return publicJob(j);});}
export function installDownloadListeners(){
 const onItem=async id=>{try{const [item]=await chrome.downloads.search({id});if(item)await captureDownload(item);}catch{/* Next explicit refresh recovers a missed event. */}};
 chrome.downloads?.onCreated?.addListener(item=>{captureDownload(item).catch(()=>{});});
 chrome.downloads?.onChanged?.addListener(delta=>{onItem(delta.id).catch(()=>{});});
}
