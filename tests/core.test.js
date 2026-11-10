import test from 'node:test';import assert from 'node:assert/strict';
import {checkURL,defaults,hostMatches,needsApproval,validateArgs,migrateSettings} from '../lib/policy.js';
import {classifyAction} from '../lib/action-risk.js';
import {sse,complete,openaiMessages,anthropicMessages} from '../lib/providers.js';
test('site policy blocks privileged schemes and honors domain boundaries',()=>{for(const url of ['chrome://settings','javascript:alert(1)','file:///tmp/a','data:text/html,x'])assert.throws(()=>checkURL(url,defaults));assert.equal(hostMatches('evil-example.com','*.example.com'),false);assert.equal(hostMatches('a.example.com','*.example.com'),true);assert.equal(hostMatches('example.com','*.example.com'),false);assert.throws(()=>checkURL('https://example.com',{...defaults,mode:'trusted'}));assert.throws(()=>checkURL('https://example.com',{...defaults,mode:'trusted',allowlist:['example.com'],blocklist:['example.com']}));});
test('automatic mode allows routine actions but keeps critical and unknown approvals',()=>{
 for(const tool of ['read_page','click_element','navigate','type_text','close_tab','scroll']){
  assert.equal(needsApproval(tool,'auto',{level:'routine'}),false);
  assert.equal(needsApproval(tool,'trusted',{level:'routine'}),false);
  assert.equal(needsApproval(tool,'ask',{level:'routine'}),true);
  assert.equal(needsApproval(tool,'auto',{level:'critical'}),true);
  assert.equal(needsApproval(tool,'auto',{level:'unknown'}),true);
 }
});
test('migration enables requested automatic mode once and preserves keys and trusted restrictions',()=>{
 assert.equal(migrateSettings({mode:'ask',openaiKey:'local-test'}).mode,'auto');
 assert.equal(migrateSettings({mode:'ask',openaiKey:'local-test'}).openaiKey,'local-test');
 assert.equal(migrateSettings({mode:'trusted',allowlist:['example.com']}).mode,'trusted');
 assert.equal(migrateSettings({mode:'ask',permissionPolicyVersion:2}).mode,'ask');
});
const regular={found:true,label:'Continue',id:'next',type:'button',context:''};
test('routine search, reading, drafting and ordinary controls do not prompt',()=>{
 for(const name of ['read_page','scroll','navigate','switch_tab','close_tab'])assert.equal(classifyAction(name,{},null).level,'routine');
 assert.equal(classifyAction('click_element',{},regular).level,'routine');
 assert.equal(classifyAction('form_input',{text:'Please delete this sentence'},{...regular,label:'Draft message',type:'textarea'}).level,'routine');
 assert.equal(classifyAction('form_input',{text:'password reset'},{...regular,label:'Search mail',type:'search'}).level,'routine');
 assert.equal(classifyAction('click_element',{}, {...regular,label:'Search',submit:true,search:true}).level,'routine');
});
test('critical controls are detected from the actual DOM even if model claims safe',()=>{
 for(const label of ['Send','Delete message','Move to trash','Buy now','Place order','Publish','Share','Change password','Sign in','Revoke access']){
  assert.equal(classifyAction('click_element',{critical:false},{...regular,label}).level,'critical',label);
 }
 for(const label of ['New password','API key','Card number','Verification code'])assert.equal(classifyAction('form_input',{}, {...regular,label}).level,'critical',label);
 assert.equal(classifyAction('click_element',{}, {...regular,label:'Save',context:'Change your password'}).level,'critical');
 assert.equal(classifyAction('click_element',{}, {...regular,label:'Continue',submit:true,search:false}).level,'critical');
 assert.equal(classifyAction('click_element',{critical:true},regular).level,'critical');
});
test('uninspectable targets and dangerous navigation cannot bypass approval',()=>{
 assert.equal(classifyAction('click_element',{x:1,y:2},null).level,'unknown');
 assert.equal(classifyAction('click_element',{}, {...regular,label:'',id:''}).level,'unknown');
 assert.equal(classifyAction('click_element',{}, {...regular,crossFrame:true}).level,'unknown');
 for(const url of ['https://example.com/delete?id=1','https://example.com/logout','https://example.com/transfer?to=a'])assert.equal(classifyAction('navigate',{url}).level,'critical');
});
test('invalid arguments fail closed',()=>{assert.throws(()=>validateArgs('click_element',{}));assert.throws(()=>validateArgs('form_input',{selector:'#a'}));assert.throws(()=>validateArgs('close_tab',{tabId:-1}));validateArgs('click_element',{x:0,y:0});});
test('SSE parser handles chunk boundaries, CRLF and multibyte text',async()=>{const bytes=new TextEncoder().encode('data: {"text":"é"}\r\n\r\ndata: {"n":2}\n\ndata: [DONE]\n\n');const stream=new ReadableStream({start(c){for(const b of bytes)c.enqueue(Uint8Array.of(b));c.close();}});const events=[];for await(const e of sse(stream))events.push(e);assert.deepEqual(events,[{text:'é'},{n:2}]);});
const h=[{role:'system',text:'safe'},{role:'user',text:'hello'},{role:'assistant',text:'',calls:[{id:'a',name:'read_page',args:{}}]},{role:'tool',id:'a',result:{text:'page'}}];
test('provider tool history has correct roles and identifiers',()=>{const o=openaiMessages(h);assert.equal(o[2].tool_calls[0].function.arguments,'{}');assert.equal(o[3].tool_call_id,'a');const a=anthropicMessages(h);assert.equal(a[1].content[0].type,'tool_use');assert.equal(a[2].content[0].tool_use_id,'a');assert.equal(a[2].role,'user');});
test('OpenAI streamed tool calls assemble and serialize correctly',async()=>{const original=global.fetch;global.fetch=async(url,opts)=>{const p=JSON.parse(opts.body);assert.equal(p.tools[0].type,'function');return new Response('data: '+JSON.stringify({choices:[{delta:{tool_calls:[{index:0,id:'x',function:{name:'read_page',arguments:'{'}}]}}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{tool_calls:[{index:0,function:{arguments:'}'}}]},finish_reason:'tool_calls'}]})+'\n\n');};try{const r=await complete({...defaults,openaiKey:'test'},h.slice(0,2),new AbortController().signal,()=>{});assert.deepEqual(r.calls,[{id:'x',name:'read_page',args:{}}]);}finally{global.fetch=original;}});
test('Anthropic streamed tool inputs assemble correctly',async()=>{const original=global.fetch;global.fetch=async(url,opts)=>{const p=JSON.parse(opts.body);assert.equal(p.system,'safe');assert.ok(p.tools[0].input_schema);return new Response([{type:'content_block_start',index:0,content_block:{type:'tool_use',id:'x',name:'read_page'}},{type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:'{}'}},{type:'message_delta',delta:{stop_reason:'tool_use'}}].map(e=>'data: '+JSON.stringify(e)+'\n\n').join(''));};try{const r=await complete({...defaults,provider:'anthropic',anthropicKey:'test'},h.slice(0,2),new AbortController().signal,()=>{});assert.equal(r.calls[0].name,'read_page');}finally{global.fetch=original;}});
test('partial streams and HTTP failures never silently succeed',async()=>{const original=global.fetch;try{global.fetch=async()=>new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n');await assert.rejects(complete({...defaults,openaiKey:'test'},h.slice(0,2),new AbortController().signal,()=>{}),/before completion/);global.fetch=async()=>new Response('',{status:429,headers:{'retry-after':'10'}});await assert.rejects(complete({...defaults,openaiKey:'test'},h.slice(0,2),new AbortController().signal,()=>{}),/429/);}finally{global.fetch=original;}});
