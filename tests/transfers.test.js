import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,validateArgs} from '../lib/policy.js';
import * as transfers from '../lib/transfers.js';
import {validateUploadTarget} from '../lib/upload-bridge.js';
import {youtubeDecision} from '../lib/youtube.js';
function setup(){const local={},session={},items=[];const tabs={1:{id:1,url:'https://drive.google.com/drive/folders/folder',title:'Drive'},2:{id:2,url:'https://studio.youtube.com/channel/UCtest/videos',title:'Studio'}};globalThis.chrome={storage:{local:{get:async()=>structuredClone(local),set:async d=>Object.assign(local,structuredClone(d))},session:{get:async()=>structuredClone(session),set:async d=>Object.assign(session,structuredClone(d))}},tabs:{get:async id=>structuredClone(tabs[id])},downloads:{search:async q=>structuredClone(q.id!==undefined?items.filter(d=>d.id===q.id):items)}};return {local,session,items,tabs};}
const spec=()=>({sourceTabId:1,destinationTabId:2,channel:'Test channel',visibility:'unlisted',madeForKids:false,files:[{name:'first.mp4',sourceURL:'https://drive.google.com/file/d/known-id/view',title:'Reel',description:'Caption'}]});
const download=(overrides={})=>({id:10,filename:'/test-downloads/first.mp4',url:'https://drive.usercontent.google.com/download?id=known-id',referrer:'https://drive.google.com/drive/folders/folder',startTime:new Date().toISOString(),endTime:new Date().toISOString(),state:'complete',danger:'safe',exists:true,mime:'video/mp4',fileSize:40*1024*1024,bytesReceived:40*1024*1024,...overrides});
test('reviewed plans reject paths, duplicate names, invalid metadata and channel rebinding',async()=>{
 const f=setup();await assert.rejects(transfers.transferPlan({...spec(),files:[{name:'../secret.mp4'}]},defaults),/basename/);
 await assert.rejects(transfers.transferPlan({...spec(),files:[{name:'first.mp4'},{name:'first (1).mp4'}]},defaults),/unique/);
 const plan=await transfers.transferPlan(spec(),defaults);const job=await transfers.createJob(plan);
 f.tabs[2].url='https://studio.youtube.com/channel/UCother/videos';
 await assert.rejects(transfers.transferPlan({sourceTabId:1,destinationTabId:2},defaults,await transfers.getJob(job.id)),/different YouTube channel/);
});
test('capture requires source, exact file identity/name and approved time window',async()=>{
 setup();const job=await transfers.createJob(await transfers.transferPlan(spec(),defaults));
 for(const d of [download({filename:'/test-downloads/other.mp4'}),download({url:'https://evil.example/first.mp4',referrer:'https://evil.example'}),download({url:'https://drive.usercontent.google.com/download?id=wrong-id'}),download({startTime:'2000-01-01T00:00:00Z'})])await transfers.captureDownload(d);
 assert.equal((await transfers.getJob(job.id)).files[0].status,'waiting');
 await transfers.captureDownload(download());const stored=await transfers.getJob(job.id);assert.equal(stored.files[0].status,'ready');
 const publicResult=transfers.publicJob(stored);assert.equal(publicResult.sessionId,undefined);assert.equal(publicResult.files[0].localPath,undefined);assert.equal(publicResult.files[0].originalURL,undefined);
});
test('unsafe/HTML downloads are rejected and changed files cannot be attached',async()=>{
 let f=setup();let job=await transfers.createJob(await transfers.transferPlan(spec(),defaults));await transfers.captureDownload(download({mime:'text/html'}));assert.equal((await transfers.getJob(job.id)).files[0].status,'download-rejected');
 f=setup();job=await transfers.createJob(await transfers.transferPlan(spec(),defaults));const d=download();f.items.push(d);await transfers.captureDownload(d);
 f.items[0].exists=false;await assert.rejects(transfers.verifiedDownloads(await transfers.getJob(job.id),undefined,defaults),/changed, was removed/);
});
test('browser restart expires grants, renewal preserves ledger, revocation is enforced',async()=>{
 const f=setup();const job=await transfers.createJob(await transfers.transferPlan(spec(),defaults));const d=download();f.items.push(d);await transfers.captureDownload(d);await transfers.markFiles(job.id,[10],'attached');
 delete f.session.mediaBrowserSessionId;await assert.rejects(transfers.activeJob(job.id,defaults),/fresh review/);
 const plan=await transfers.transferPlan({sourceTabId:1,destinationTabId:2},defaults,await transfers.getJob(job.id));const renewed=await transfers.resumeJob(job.id,plan);
 assert.equal(renewed.files[0].downloadId,10);assert.equal(renewed.files[0].status,'attached');await transfers.cancelJob(job.id);await assert.rejects(transfers.activeJob(job.id,defaults),/revoked/);
});
test('large-file input validation checks multiplicity, media types and supported frame',()=>{
 const input={found:true,type:'file',multiple:true,accept:'video/*'};const files=[{actualName:'first.mp4',mime:'video/mp4'}];validateUploadTarget(input,files);
 assert.throws(()=>validateUploadTarget({...input,multiple:false},[...files,...files]),/one file/);
 assert.throws(()=>validateUploadTarget({...input,accept:'image/png'},files),/accepted types/);
 assert.throws(()=>validateUploadTarget(input,files,2),/top-frame/);
});
test('final review requires actual matching channel/file/metadata/visibility/audience and completed checks',()=>{
 const job={destinationChannelId:'UCtest',visibility:'unlisted',madeForKids:false};const file={name:'first.mp4',title:'Reel',description:'Caption'};
 const snapshot={channelId:'UCtest',channelName:'Test',fileNames:['first.mp4'],currentFileName:'first.mp4',fields:[{kind:'title',value:'Reel'},{kind:'description',value:'Caption'}],visibility:'unlisted',madeForKids:false,uploading:false,checksComplete:true,videoLinks:[]};
 assert.equal(youtubeDecision(job,file,snapshot).title,'Reel');
 for(const patch of [{channelId:'UCother'},{currentFileName:'other.mp4'},{visibility:'public'},{madeForKids:null},{uploading:true},{checksComplete:false},{fields:[{kind:'title',value:'Changed'},{kind:'description',value:'Caption'}]}])assert.throws(()=>youtubeDecision(job,file,{...snapshot,...patch}));
});
test('transfer tools reject incomplete or malformed requests',()=>{
 assert.throws(()=>validateArgs('create_upload_job',{sourceTabId:1,destinationTabId:2,files:[{name:'a.mp4'}]}),/visibility/);
 assert.throws(()=>validateArgs('attach_downloads',{jobId:'x',downloadIds:['/etc/passwd']}),/download IDs/);
 assert.throws(()=>validateArgs('finalize_youtube_upload',{jobId:'x',downloadId:1}),/locator/);
 validateArgs('wait_for_transfer',{jobId:'x',timeout:120000});
});
