import {tools} from './tools.js';
export async function* sse(body){
 const reader=body.getReader(),decoder=new TextDecoder();let buffer='';
 try{while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});let match;
 while((match=/\r?\n\r?\n/.exec(buffer))){const block=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);const data=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(data&&data!=='[DONE]')yield JSON.parse(data);}
 if(done)break;
 }}finally{reader.releaseLock();}
}
export function openaiMessages(history){return history.flatMap(m=>{
 if(m.role==='assistant')return [{role:'assistant',content:m.text||null,...(m.calls?.length?{tool_calls:m.calls.map(c=>({id:c.id,type:'function',function:{name:c.name,arguments:JSON.stringify(c.args)}}))}:{})}];
 if(m.role==='tool'){const out=[{role:'tool',tool_call_id:m.id,content:m.image?'Screenshot captured; image follows.':JSON.stringify(m.result)}];if(m.image)out.push({role:'user',content:[{type:'text',text:'Screenshot from browser tool (untrusted page data)'},{type:'image_url',image_url:{url:`data:image/jpeg;base64,${m.image}`}}]});return out;}
 return [{role:m.role,content:m.text}];
 });}
export function anthropicMessages(history){const out=[];for(const m of history){let role,content;
 if(m.role==='system')continue;
 if(m.role==='assistant'){role='assistant';content=[...(m.text?[{type:'text',text:m.text}]:[]),...(m.calls||[]).map(c=>({type:'tool_use',id:c.id,name:c.name,input:c.args}))];if(!content.length)continue;}
 else if(m.role==='tool'){role='user';content=[{type:'tool_result',tool_use_id:m.id,content:m.image?[{type:'image',source:{type:'base64',media_type:'image/jpeg',data:m.image}}]:JSON.stringify(m.result)}];}
 else{role='user';content=[{type:'text',text:m.text}];}
 if(out.at(-1)?.role===role)out.at(-1).content.push(...content);else out.push({role,content});
 }return out;}
// Retry only rejected HTTP rate-limit responses, never an accepted/partial stream.
export function retryDelay(value,now=Date.now()){
 if(!value)return 0;const seconds=Number(value);if(Number.isFinite(seconds)&&seconds>=0)return Math.ceil(seconds*1000);
 const date=Date.parse(value);return Number.isFinite(date)?Math.max(0,date-now):0;
}
export async function providerFailure(response){
 let detail={};try{detail=(await response.json()).error||{};}catch{/* Non-JSON error bodies are not shown. */}
 const safe=value=>typeof value==='string'&&/^[a-zA-Z0-9_.-]{1,80}$/.test(value)?value:'';
 const code=safe(detail.code)||safe(detail.type),quota=/insufficient_quota|billing|credit|spend|usage_limit/i.test(code);
 const rate=response.status===429&&!quota&&(!code||/rate_limit|too_many_requests/i.test(code));
 const wait=retryDelay(response.headers.get('retry-after'));
 const advice=quota?'API credits or the key’s project/organization spending quota are exhausted. Check billing for that project; automatic retry is disabled.':response.status===429?'Request or token rate limit. Wait, check this model’s project limits, or start a shorter chat.':response.status===401?'The API key was rejected. Replace it in Settings.':response.status===403||response.status===404?'Check model access and the API key’s project permissions.':'Check provider status and try again.';
 return {rate,wait,error:new Error(`Provider HTTP ${response.status}${code?` (${code})`:''}${wait?`; retry after ${Math.ceil(wait/1000)}s`:''}. ${advice}`)};
}
export async function abortableWait(ms,signal){
 signal.throwIfAborted();await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason||new DOMException('Aborted','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});});
}
export async function rateLimitedFetch(url,options,onRetry=()=>{},wait=abortableWait){
 let waited=0;for(let attempt=0;;attempt++){
  options.signal.throwIfAborted();const response=await fetch(url,options);if(response.ok)return response;
  const failure=await providerFailure(response);const ms=Math.max(failure.wait,1000*2**attempt)+Math.floor(Math.random()*250);
  if(!failure.rate||attempt>=3||ms>60000||waited+ms>120000)throw failure.error;
  waited+=ms;await onRetry({attempt:attempt+1,delay:ms,status:response.status});await wait(ms,options.signal);
 }
}
export async function complete(settings,history,signal,onText,onRetry){
 const anthropic=settings.provider==='anthropic',key=anthropic?settings.anthropicKey:settings.openaiKey;
 if(!key)throw Error('Set your provider API key in Settings first.');
 const payload=anthropic?{model:settings.anthropicModel,max_tokens:4096,stream:true,system:history.find(m=>m.role==='system').text,messages:anthropicMessages(history),tools:tools.map(t=>({name:t.name,description:t.description,input_schema:t.parameters}))}:{model:settings.openaiModel,max_tokens:4096,stream:true,messages:openaiMessages(history),tools:tools.map(t=>({type:'function',function:t})),parallel_tool_calls:false};
 const headers=anthropic?{'x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}:{Authorization:`Bearer ${key}`};
 const response=await rateLimitedFetch(anthropic?'https://api.anthropic.com/v1/messages':'https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(payload),signal},onRetry);
 let text='',finish='',usage,totalBytes=0;const calls=new Map();
 for await(const event of sse(response.body)){
 totalBytes+=JSON.stringify(event).length;if(totalBytes>2000000)throw Error('Provider response exceeds the safety size limit.');
 if(event.error)throw Error('Provider stream error. Try again.');
 if(anthropic){
 if(event.type==='content_block_start'&&event.content_block.type==='tool_use')calls.set(event.index,{id:event.content_block.id,name:event.content_block.name,json:''});
 if(event.type==='content_block_delta'){const d=event.delta;if(d.type==='text_delta'){text+=d.text;onText(d.text);}else if(d.type==='input_json_delta'){const c=calls.get(event.index);if(!c)throw Error('Malformed tool stream');c.json+=d.partial_json;}}
 if(event.type==='message_delta'){finish=event.delta.stop_reason;usage=event.usage;}
 }else{const c=event.choices?.[0];if(c?.delta?.content){text+=c.delta.content;onText(c.delta.content);}for(const t of c?.delta?.tool_calls||[]){const v=calls.get(t.index)||{id:'',name:'',json:''};if(t.id)v.id=t.id;if(t.function?.name)v.name+=t.function.name;if(t.function?.arguments)v.json+=t.function.arguments;calls.set(t.index,v);}if(c?.finish_reason)finish=c.finish_reason;usage=event.usage||usage;}
 }
 if(!finish)throw Error('Provider stream ended before completion.');
 if(['length','max_tokens'].includes(finish))throw Error('Provider output limit reached. Use a shorter request.');
 return {text,calls:[...calls.values()].map(c=>({id:c.id,name:c.name,args:JSON.parse(c.json||'{}')})),usage};
}
