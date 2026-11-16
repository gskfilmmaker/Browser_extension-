import test from 'node:test';
import assert from 'node:assert/strict';
import {rateLimitedFetch,providerFailure,retryDelay,abortableWait} from '../lib/providers.js';
const options=()=>({signal:new AbortController().signal,body:'unchanged-request'});
test('rate-limit retries preserve the request and honor Retry-After before a successful response',async()=>{
 const original=global.fetch;let calls=0;const delays=[],statuses=[],opts=options();
 global.fetch=async(url,o)=>{assert.equal(o,opts);return ++calls<3?new Response('{"error":{"code":"rate_limit_exceeded"}}',{status:429,headers:{'retry-after':'5'}}):new Response('ok');};
 try{const r=await rateLimitedFetch('https://test.invalid',opts,s=>statuses.push(s),async ms=>delays.push(ms));assert.equal(await r.text(),'ok');assert.equal(calls,3);assert.equal(statuses.length,2);assert.ok(delays.every(ms=>ms>=5000));}finally{global.fetch=original;}
});
test('quota errors and excessive Retry-After never automatically retry; raw error messages stay private',async()=>{
 const original=global.fetch;try{for(const [code,after] of [['insufficient_quota','5'],['rate_limit_exceeded','300']]){let calls=0;global.fetch=async()=>{calls++;return new Response(JSON.stringify({error:{code,message:'private secret content'}}),{status:429,headers:{'retry-after':after}});};await assert.rejects(rateLimitedFetch('https://test.invalid',options(),()=>{},async()=>assert.fail('must not wait')),e=>e.message.includes(code)&&!e.message.includes('private secret'));assert.equal(calls,1);}}finally{global.fetch=original;}
});
test('rate-limit retry count is bounded and cancellation interrupts waiting',async()=>{
 const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;return new Response('{}',{status:429});};try{await assert.rejects(rateLimitedFetch('https://test.invalid',options(),()=>{},async()=>{}),/429/);assert.equal(calls,4);}finally{global.fetch=original;}
 const c=new AbortController();const waiting=abortableWait(60000,c.signal);c.abort();await assert.rejects(waiting,/abort/i);
});
test('Retry-After accepts seconds and HTTP dates, and authentication has a specific remedy',async()=>{
 assert.equal(retryDelay('5'),5000);assert.equal(retryDelay('Mon, 16 Nov 2026 12:00:05 GMT',Date.parse('2026-11-16T12:00:00Z')),5000);assert.equal(retryDelay('invalid'),0);
 const result=await providerFailure(new Response('{}',{status:401}));assert.match(result.error.message,/API key was rejected/);assert.equal(result.rate,false);
});
