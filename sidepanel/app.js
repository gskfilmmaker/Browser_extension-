const $=s=>document.querySelector(s);let state;
const send=async m=>{const r=await chrome.runtime.sendMessage(m);if(r?.error)throw Error(r.error);return r;};
function node(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function render(s){state=s;$('#status').textContent=s.status;$('#status').classList.toggle('active',s.running);$('#send').disabled=s.running;$('#stop').hidden=!s.running;$('#mode').disabled=s.running;
 const box=$('#messages'),nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<90;
 if(s.messages.length){box.replaceChildren();for(const m of s.messages){if(m.role==='tool'){const d=node('details','', 'tool');d.append(node('summary',m.text),node('pre',JSON.stringify({arguments:m.args,result:m.result},null,2)));box.append(d);}else box.append(node('article',m.text||(s.running?'Thinking…':''),`message ${m.role}`));}}
 else if(!box.querySelector('.welcome'))box.replaceChildren(node('div','Start a new journey with FramePilot. What would you like to do?','welcome'));
 if(nearBottom)box.scrollTop=box.scrollHeight;
 const approval=$('#approval');approval.hidden=!s.pending;approval.replaceChildren();if(s.pending){const p=s.pending;approval.append(node('strong',`Approve ${p.name}?`),node('p',p.url),node('p',p.notice),node('pre',JSON.stringify(p.args,null,2)));for(const [label,approved]of [['Deny',false],['Approve once',true]]){const b=node('button',label);b.onclick=()=>send({type:'approve',id:p.id,approved}).catch(error);approval.append(b);}}
}
function error(e){$('#status').textContent=e.message;}
$('#settings').onclick=()=>chrome.runtime.openOptionsPage();
$('#chat').onsubmit=async e=>{e.preventDefault();try{await send({type:'start',text:$('#prompt').value});$('#prompt').value='';}catch(e){error(e);}};
$('#prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!state?.running){e.preventDefault();$('#chat').requestSubmit();}};
$('#stop').onclick=()=>send({type:'stop'}).catch(error);$('#clear').onclick=()=>send({type:'clear'}).catch(error);
$('#mode').onchange=async()=>{const {settings={}}=await chrome.storage.local.get('settings');settings.mode=$('#mode').value;await chrome.storage.local.set({settings});};
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&changes.state)render(changes.state.newValue);if(area==='local'&&changes.settings)$('#mode').value=changes.settings.newValue.mode||'ask';});
chrome.runtime.onMessage.addListener(m=>{if(m.type==='state')render(m.state);});
try{render(await send({type:'getState'}));const {settings={}}=await chrome.storage.local.get('settings');$('#mode').value=settings.mode||'ask';}catch(e){error(e);}
