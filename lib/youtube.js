/** Inspect the visible YouTube Studio upload UI. No private/internal YouTube API. */
export function inspectYouTube(){
 if(location.hostname!=='studio.youtube.com')throw Error('Open YouTube Studio in the destination tab.');
 const state=globalThis.__framepilotPage;if(!state)throw Error('Read the page before inspecting the upload.');
 const roots=[document];for(let i=0;i<roots.length&&i<100;i++)for(const e of [...roots[i].querySelectorAll('*')].slice(0,20000))if(e.shadowRoot)roots.push(e.shadowRoot);
 const all=selector=>roots.flatMap(r=>[...r.querySelectorAll(selector)]),visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 const ref=e=>{if(!state.reverse.has(e)){const id=`${state.token}:${++state.next}`;state.reverse.set(e,id);state.refs.set(id,e);}return state.reverse.get(e);};
 const label=e=>(e.getAttribute('aria-label')||e.labels?.[0]?.innerText||e.getAttribute('placeholder')||e.innerText||'').trim();
 const inside=(e,root)=>{let n=e;while(n){if(n===root||root.contains(n))return true;n=n.getRootNode()?.host;}return false;};
 let dialogs=all('ytcp-uploads-dialog,ytcp-video-upload-dialog,[data-framepilot-youtube-upload],[role="dialog"]').filter(visible);
 if(!dialogs.length)dialogs=[document.body];
 const fields=all('input:not([type="file"]):not([type="password"]):not([type="hidden"]),textarea,[contenteditable="true"]');
 let root=dialogs.find(d=>fields.some(e=>inside(e,d)))||dialogs[0];
 const scoped=selector=>all(selector).filter(e=>visible(e)&&inside(e,root));
 const text=[root.innerText||'',...roots.filter(r=>r.host&&inside(r.host,root)).map(r=>r.textContent||'')].join('\n').slice(0,20000);
 const entries=fields.filter(e=>inside(e,root)).map(e=>{let n=e,path=[];for(let i=0;i<6&&n;i++){path.push(n.id||'',n.getAttribute?.('aria-label')||'');n=n.parentElement||n.getRootNode()?.host;}const context=path.join(' ');return {elementRef:ref(e),label:label(e),kind:/description/i.test(context)?'description':/title|video name/i.test(context)?'title':'other',value:e.isContentEditable?e.innerText:e.value||'',checked:e.checked,type:e.type||''};});
 const buttons=scoped('button,[role="button"],ytcp-button').map(e=>({elementRef:ref(e),label:label(e),disabled:e.disabled||e.getAttribute('aria-disabled')==='true'||e.hasAttribute('disabled')}));
 const fileNames=[...new Set(scoped('#original-filename,#filename,.filename,[data-filename]').map(e=>e.getAttribute('data-filename')||e.getAttribute('filename')||e.innerText).filter(Boolean).map(s=>s.trim()))];
 const currentNames=scoped('#original-filename,[data-current-filename]').map(e=>e.getAttribute('data-current-filename')||e.innerText).filter(Boolean);
 const currentFileName=currentNames.length===1?currentNames[0].trim():fileNames.length===1?fileNames[0]:'';
 const selected=all('input[type="radio"],[role="radio"],tp-yt-paper-radio-button').filter(e=>inside(e,root)).filter(e=>typeof e.checked==='boolean'?e.checked:e.getAttribute('aria-checked')==='true'||e.hasAttribute('checked')).map(e=>({label:label(e),name:e.name||e.getAttribute('name')||'',value:e.value||''}));
 const visibility=selected.map(e=>`${e.label} ${e.name} ${e.value}`).map(t=>/unlisted/i.test(t)?'unlisted':/private/i.test(t)?'private':/public/i.test(t)?'public':'').find(Boolean)||'';
 const kids=selected.find(e=>/made for kids|not.*kids|yes_mfk|not_mfk|not_made_for_kids|made_for_kids/i.test(`${e.label} ${e.name} ${e.value}`));
 const madeForKids=kids? !/not|no\b/i.test(`${kids.label} ${kids.name} ${kids.value}`):null;
 const channelId=location.pathname.match(/\/channel\/([\w-]+)/)?.[1]||'';
 const channelName=all('#channel-name,[data-channel-name]').filter(visible).map(e=>e.getAttribute('data-channel-name')||e.innerText).find(Boolean)||'';
 const links=scoped('a[href]').map(e=>({text:e.innerText,url:e.href})).filter(l=>{try{const u=new URL(l.url);return u.hostname==='youtu.be'||u.hostname.endsWith('youtube.com')&&u.pathname==='/watch'&&u.searchParams.has('v');}catch{return false;}});
 const progress=scoped('[role="progressbar"]').map(e=>({label:label(e),value:e.getAttribute('aria-valuenow')}));
 return {url:location.href,channelId,channelName,fileNames,currentFileName,fields:entries,buttons,visibility,madeForKids,selected,progress,uploading:/\buploading\b|\b\d+% uploaded\b/i.test(text)&&!/upload complete/i.test(text),checksComplete:/checks complete|no issues found|checks finished|processing complete/i.test(text),videoLinks:links,text};
}
export function youtubeDecision(job,file,snapshot){
 if(!job.destinationChannelId||snapshot.channelId!==job.destinationChannelId)throw Error('The current YouTube channel does not match the reviewed batch.');
 const normalized=s=>String(s).normalize('NFC').replace(/ \(\d+\)(?=\.[^.]+$)/,'').toLowerCase();
 if(normalized(snapshot.currentFileName||(snapshot.fileNames.length===1?snapshot.fileNames[0]:''))!==normalized(file.actualName||file.name))throw Error('The current video filename is not visible or does not match this batch item. Select the correct video and inspect again.');
 if(snapshot.uploading||!snapshot.checksComplete)throw Error('Wait for the upload and recognized processing/checks completion before final review.');
 if(snapshot.visibility!==job.visibility)throw Error('The selected visibility does not match the approved plan.');
 const title=snapshot.fields.find(f=>f.kind==='title')?.value;
 const description=snapshot.fields.find(f=>f.kind==='description')?.value;
 if(title===undefined||description===undefined)throw Error('The actual title and description are not available in the current upload DOM. Return to Details or review manually; do not invent them.');
 if(file.title!==undefined&&title!==file.title)throw Error('The title differs from the reviewed upload plan.');
 if(file.description!==undefined&&description!==file.description)throw Error('The description differs from the reviewed upload plan.');
 if(snapshot.madeForKids===null)throw Error('The actual audience selection is not available. Return to Details and inspect it; do not guess.');
 if(job.madeForKids!==null&&snapshot.madeForKids!==job.madeForKids)throw Error('The audience selection is missing or differs from the reviewed plan.');
 return {kind:'youtube',channelId:snapshot.channelId,channelName:snapshot.channelName||job.channel||'Verify the channel in Studio',filename:file.actualName||file.name,title,description,visibility:snapshot.visibility,madeForKids:snapshot.madeForKids,videoLinks:snapshot.videoLinks,warnings:['Verify the channel, audience selection and copyright disclosures in Studio. Processing checks are read from visible UI; they do not establish ownership or legal clearance.']};
}
