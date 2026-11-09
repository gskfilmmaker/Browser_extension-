import {defaults} from '../lib/policy.js';
const form=document.querySelector('form'),status=document.querySelector('#saved');
const stored={...defaults,...(await chrome.storage.local.get('settings')).settings};
for(const [k,v]of Object.entries(stored)){if(form.elements[k])form.elements[k].value=Array.isArray(v)?v.join('\n'):v;}
function hosts(value){return value.split(/\n/).map(v=>v.trim().toLowerCase()).filter(Boolean).map(v=>{if(!/^(\*\.)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(v))throw Error(`Invalid hostname: ${v}`);return v;});}
form.onsubmit=async e=>{e.preventDefault();try{const data=Object.fromEntries(new FormData(form));data.allowlist=hosts(data.allowlist);data.blocklist=hosts(data.blocklist);data.maxSteps=Number(data.maxSteps);for(const k of ['openaiKey','anthropicKey','openaiModel','anthropicModel'])data[k]=data[k].trim();await chrome.storage.local.set({settings:data});status.textContent='Settings saved.';}catch(e){status.textContent=e.message;}};
document.querySelector('#delete').onclick=async()=>{const {settings={}}=await chrome.storage.local.get('settings');settings.openaiKey='';settings.anthropicKey='';await chrome.storage.local.set({settings});form.elements.openaiKey.value='';form.elements.anthropicKey.value='';status.textContent='Stored API keys deleted.';};
