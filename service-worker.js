import {defaults,SYSTEM,needsApproval,checkURL,validateArgs} from './lib/policy.js';
import {tools} from './lib/tools.js';
import {complete} from './lib/providers.js';
import {execute,target,detachAll} from './lib/browser.js';
let conversation=[];
let state={messages:[],running:false,pending:null,status:'Ready'},controller=null,pendingResolve=null,lastStart=0;
const boot=(async()=>{await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});const cached=await chrome.storage.session.get(['state','conversation']);conversation=cached.conversation||[];const saved=cached.state;if(saved)state={...saved,running:false,pending:null,status:saved.running?'Previous run interrupted. Start a new request.':'Ready'};await save();})();
async function save(){await chrome.storage.session.set({state});chrome.runtime.sendMessage({type:'state',state}).catch(()=>{});}
function message(role,text,extra={}){const m={id:crypto.randomUUID(),role,text,...extra};state.messages.push(m);return m;}
chrome.runtime.onInstalled.addListener(async()=>{await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});});
chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>{});
function trusted(sender){return sender.id===chrome.runtime.id&&!sender.tab&&sender.url?.startsWith(chrome.runtime.getURL(''));}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 if(!trusted(sender))return;
 (async()=>{await boot;
 switch(m.type){
 case 'getState':return state;
 case 'start':if(state.running)throw Error('An agent run is already active.');if(Date.now()-lastStart<3000)throw Error('Wait a few seconds between requests.');if(typeof m.text!=='string'||!m.text.trim()||m.text.length>16000)throw Error('Enter a request under 16,000 characters.');lastStart=Date.now();state.running=true;controller=new AbortController();run(m.text.trim()).catch(()=>{});return {ok:true};
 case 'approve':if(state.pending?.id!==m.id)throw Error('Approval expired.');pendingResolve?.(m.approved===true);return {ok:true};
 case 'stop':controller?.abort();pendingResolve?.(false);return {ok:true};
 case 'clear':if(state.running)throw Error('Stop the agent first.');state.messages=[];conversation=[];await chrome.storage.session.remove('conversation');await save();return {ok:true};
 default:throw Error('Unknown message.');}
 })().then(reply,e=>reply({error:e.message}));return true;
});
async function approve(name,args,ctx){
 const id=crypto.randomUUID();let t=null;
 if(name!=='get_tabs_context'&&name!=='create_tab')t=await target(args.tabId??ctx.tabId,ctx.settings);
 const url=t?.url||args.url||'All permitted HTTP(S) tabs';
 state.pending={id,name,args,url,tabId:t?.id,title:t?.title,notice:'This action can expose page data to your AI provider or change the website. Check the exact target and arguments.'};state.status='Waiting for approval';await save();
 const yes=await new Promise(resolve=>{const timer=setTimeout(()=>{pendingResolve=null;resolve(false);},120000);pendingResolve=v=>{clearTimeout(timer);pendingResolve=null;resolve(v);};});
 state.pending=null;await save();if(!yes||ctx.signal.aborted)throw Error('Action denied, expired, or stopped.');
 if(t){const current=await target(t.id,ctx.settings);if(current.url!==url)throw Error('The page navigated after approval was requested. Please retry.');}
}
async function run(text){
 const signal=controller.signal;let keepAlive;const timeout=setTimeout(()=>{controller?.abort();pendingResolve?.(false);},600000);
 try{
 // Chrome API activity keeps an active run alive; no unattended resumption after termination.
 keepAlive=setInterval(()=>chrome.runtime.getPlatformInfo().catch(()=>{}),20000);
 const settings={...defaults,...(await chrome.storage.local.get('settings')).settings};
 const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
 const ctx={settings,tabId:tab?.id,signal};
 message('user',text);state.status='Thinking';await save();
 // Checkpoints contain completed tool turns only; screenshot bytes are not retained.
 const history=[{role:'system',text:SYSTEM},...conversation,{role:'user',text:`Target tab ID: ${ctx.tabId}. User request: ${text}`}];
 if(JSON.stringify(history).length>1500000)throw Error('Conversation is too long. Start a new chat.');
 const checkpoint=async()=>{conversation=history.slice(1).map(m=>m.image?{role:'tool',id:m.id,result:{screenshot:'Image from a previous turn; capture again if needed.'}}:m);await chrome.storage.session.set({conversation});};
 for(let step=0;step<Math.min(40,settings.maxSteps||20);step++){
 signal.throwIfAborted();state.status='Thinking';const m=message('assistant','');await save();let scheduled=false;
 const answer=await complete(settings,history,signal,delta=>{m.text+=delta;if(!scheduled){scheduled=true;setTimeout(()=>{scheduled=false;save().catch(()=>{});},80);}});
 m.text=answer.text;history.push({role:'assistant',text:answer.text,calls:answer.calls});await save();
 if(!answer.calls.length){await checkpoint();state.status='Done';return;}
 if(answer.calls.length>8)throw Error('Too many tool calls in a single response.');
 for(const call of answer.calls){
 signal.throwIfAborted();if(!tools.some(t=>t.name===call.name))throw Error('Provider requested an unknown tool.');validateArgs(call.name,call.args);
 const item=message('tool',call.name,{args:call.args,result:null});await save();
 let result;
 try{
 if(call.args.url)checkURL(call.args.url,settings);
 if(needsApproval(call.name,settings.mode))await approve(call.name,call.args,ctx);
 signal.throwIfAborted();state.status=`Controlling page · ${call.name}`;await chrome.action.setBadgeText({text:'RUN'});await chrome.action.setBadgeBackgroundColor({color:'#ba5429'});await save();
 result=await execute(call.name,call.args,ctx);signal.throwIfAborted();
 item.result=result.image?{screenshot:'Captured and sent to provider',mime:result.mime}:result;
 }catch(e){if(signal.aborted)throw e;result={error:e.message};item.result=result;}
 history.push({role:'tool',id:call.id,...(result.image?{image:result.image}:{result})});await save();
 await chrome.action.setBadgeText({text:''});
 }
 await checkpoint();
 }
 throw Error('Step limit reached. Review the results and send a new request.');
 }catch(e){state.status=signal.aborted?'Stopped':`Error: ${e.message}`;message('notice',state.status);}
 finally{clearInterval(keepAlive);clearTimeout(timeout);pendingResolve?.(false);pendingResolve=null;state.running=false;state.pending=null;await detachAll();await chrome.action.setBadgeText({text:''});await save();controller=null;}
}
