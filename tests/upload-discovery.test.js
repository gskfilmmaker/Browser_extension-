import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCDPUpload,assignDownloads} from '../lib/upload-bridge.js';
const files=[{actualName:'reel.mp4',mime:'video/mp4',size:42,localPath:'/registered/reel.mp4'}];
const input=id=>({localName:'input',backendNodeId:id,attributes:['type','file']});
test('browser upload discovery excludes child documents and disabled inputs',async()=>{
 const root={backendNodeId:1,children:[{localName:'iframe',contentDocument:{children:[input(99)]}},input(2)],shadowRoots:[{children:[input(3)]}]};
 const command=async(name,args)=>{
  if(name==='DOM.getDocument')return {root};
  if(name==='DOM.resolveNode')return {object:{objectId:String(args.backendNodeId)}};
  if(name==='Runtime.callFunctionOn')return {result:{value:{connected:true,type:'file',disabled:args.objectId==='2',multiple:true,accept:'video/*'}}};
  return {};
 };
 const e=await inspectCDPUpload(command,files);assert.equal(e.backendNodeId,3);assert.equal(e.documentBackendNodeId,1);
 await assert.rejects(inspectCDPUpload(command,files,4),/top-frame/);
});
test('changed documents prevent file assignment and do not mark an uncertain attempt',async()=>{
 let dispatched=false;const command=async name=>{if(name==='DOM.getDocument')return {root:{backendNodeId:999}};if(name==='DOM.setFileInputFiles')dispatched=true;return {};};
 await assert.rejects(assignDownloads({evidence:{found:true,type:'file',transport:'cdp',multiple:true,accept:'video/*',backendNodeId:3,documentBackendNodeId:1},files,command,signal:new AbortController().signal}),e=>/document changed/.test(e.message)&&e.assignmentAttempted===false);
 assert.equal(dispatched,false);
});
