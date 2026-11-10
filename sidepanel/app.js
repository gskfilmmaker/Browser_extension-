import {addFile,listFiles,removeFile} from '../lib/files.js';
const $=s=>document.querySelector(s);let state;
const send=async m=>{const r=await chrome.runtime.sendMessage(m);if(r?.error)throw Error(r.error);return r;};
function node(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function render(s){state=s;$('#status').textContent=s.status;$('#status').classList.toggle('active',s.running);$('#send').disabled=s.running;$('#stop').hidden=!s.running;$('#mode').disabled=s.running;$('#resume').hidden=s.running||!s.lastTask||s.status==='Done';
 const box=$('#messages'),nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<90;
 if(s.messages.length){box.replaceChildren();for(const m of s.messages){if(m.role==='tool'){const d=node('details','', 'tool');d.append(node('summary',m.text),node('pre',JSON.stringify({arguments:m.args,result:m.result},null,2)));box.append(d);}else box.append(node('article',m.text||(s.running?'Thinking…':''),`message ${m.role}`));}}
 else if(!box.querySelector('.welcome'))box.replaceChildren(node('div','Start a new journey with FramePilot. What would you like to do?','welcome'));
 if(s.steps?.length){const plan=node('details','','task-plan');plan.open=true;plan.append(node('summary','Task progress'));for(const step of s.steps)plan.append(node('div',`${{pending:'○',working:'◉',done:'✓',blocked:'!'}[step.status]} ${step.text}`,`step ${step.status}`));box.prepend(plan);}
 if(nearBottom)box.scrollTop=box.scrollHeight;
 const approval=$('#approval');approval.hidden=!s.pending;
 if(!s.pending){approval.replaceChildren();delete approval.dataset.pendingId;}
 else if(approval.dataset.pendingId!==s.pending.id){
  const p=s.pending;approval.dataset.pendingId=p.id;approval.replaceChildren();
  const heading=node('strong',p.level==='critical'?'Confirm critical action':p.level==='unknown'?'Check this action':`Approve ${p.name}?`);
  const detail=node('div','','approval-detail');detail.append(node('p',p.notice),node('p',p.url),node('pre',JSON.stringify(p.args,null,2)));
  if(p.review){const review=p.review;detail.replaceChildren(node('p',p.notice),node('p',`From: ${review.sender}`),node('p',`To: ${review.to.join(', ')}`),node('p',`Cc: ${review.cc.join(', ')||'—'} · Bcc: ${review.bcc.join(', ')||'—'}`),node('strong',review.subject),node('pre',review.body),node('p',`Attachments: ${review.attachments.join(', ')||'None detected — verify on the page'}`));for(const link of review.links||[])detail.append(node('p',`${link.text}: ${link.url}`));for(const warning of review.warnings)detail.append(node('p',warning,'review-warning'));}
  if(p.files)detail.append(node('pre',JSON.stringify(p.files.map(f=>({name:f.name,size:f.size})),null,2)));
  const actions=node('div','','approval-actions');
  for(const [label,approved]of [['Deny',false],['Approve once',true]]){
   const b=node('button',label);b.onclick=async()=>{for(const button of actions.querySelectorAll('button'))button.disabled=true;try{await send({type:'approve',id:p.id,approved});}catch(e){for(const button of actions.querySelectorAll('button'))button.disabled=false;error(e);}};actions.append(b);
  }
  approval.append(heading,detail,actions);
 }

}
function error(e){$('#status').textContent=e.message;}
$('#settings').onclick=()=>chrome.runtime.openOptionsPage();
$('#chat').onsubmit=async e=>{e.preventDefault();try{await send({type:'start',text:$('#prompt').value});$('#prompt').value='';}catch(e){error(e);}};
$('#prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!state?.running){e.preventDefault();$('#chat').requestSubmit();}};
$('#resume').onclick=()=>send({type:'start',text:'Continue previous task',resume:true}).catch(error);
$('#stop').onclick=()=>send({type:'stop'}).catch(error);$('#clear').onclick=()=>send({type:'clear'}).catch(error);
$('#mode').onchange=async()=>{const {settings={}}=await chrome.storage.local.get('settings');settings.mode=$('#mode').value;await chrome.storage.local.set({settings});};
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&changes.state)render(changes.state.newValue);if(area==='local'&&changes.settings)$('#mode').value=changes.settings.newValue.mode||'auto';});
chrome.runtime.onMessage.addListener(m=>{if(m.type==='state')render(m.state);});
try{render(await send({type:'getState'}));const {settings={}}=await chrome.storage.local.get('settings');$('#mode').value=settings.mode||'auto';}catch(e){error(e);}

async function renderFiles(){
 const box=$('#files');box.replaceChildren();
 for(const f of await listFiles()){const row=node('div','','file-row');row.append(node('span',`${f.name} · ${Math.ceil(f.size/1024)} KB`));const remove=node('button','Remove','quiet');remove.type='button';remove.onclick=async()=>{await removeFile(f.id);await renderFiles();};row.append(remove);box.append(row);}
}
$('#choose-files').onclick=()=>$('#file-picker').click();
$('#file-picker').onchange=async()=>{try{for(const file of $('#file-picker').files)await addFile(file);await renderFiles();$('#status').textContent='Files selected locally. Ask FramePilot to attach them; uploading requires approval.';}catch(e){error(e);}finally{$('#file-picker').value='';}};
renderFiles().catch(error);
