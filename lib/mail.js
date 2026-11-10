/** Extract a review from visible composer fields, not from model-provided email content. */
export async function inspectEmail(args={}) {
  const state=globalThis.__framepilotPage;
  const visible=e=>!!e.getClientRects().length;
  const resolve=()=>args.elementRef?state?.refs.get(args.elementRef):args.selector?document.querySelector(args.selector):null;
  const target=resolve();if(args.elementRef&&!target?.isConnected)throw Error('Stale send control. Read the page again.');
  const selectors='[contenteditable="true"][aria-label*="Message Body"],[contenteditable="true"][aria-label*="Message body"],[contenteditable="true"][aria-label*="message body"],textarea[name="body"],[contenteditable="true"][role="textbox"]';
  let root=target?.closest('[role="dialog"],dialog,form,[data-framepilot-composer]');
  const editors=[...document.querySelectorAll(selectors)].filter(visible);
  if(!root && target){let parent=target.parentElement;while(parent&&parent!==document.body){if(parent.querySelector(selectors)&&parent.querySelector('input[name="subjectbox"],input[name="subject"],input[aria-label*="Subject"],input[placeholder*="subject"],input[placeholder*="Subject"]')){root=parent;break;}parent=parent.parentElement;}}
  if(!root){const roots=[...new Set(editors.map(e=>e.closest('[role="dialog"],dialog,form,[data-framepilot-composer]')).filter(Boolean))];if(roots.length===1)root=roots[0];}
  if(!root)throw Error('Could not identify one email composer. Use the send control elementRef/selector, or a unique composer selector.');
  const bodyCandidates=[...root.querySelectorAll(selectors)].filter(visible);
  const preferred=bodyCandidates.filter(e=>/message body/i.test(e.getAttribute('aria-label')||'')||e.name==='body');
  const body=(preferred.length===1?preferred:bodyCandidates);
  if(body.length!==1)throw Error('Email body is ambiguous. Close other composers or use one clearly labeled message body.');
  const subject=root.querySelector('input[name="subjectbox"],input[name="subject"],input[aria-label*="Subject"],input[placeholder*="subject"],input[placeholder*="Subject"]');
  const addresses=value=>[...new Set((value||'').match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[])];
  const recipients=kind=>{
    const fields=[...root.querySelectorAll(`[name="${kind}"],[data-recipient-type="${kind}"],[aria-label="${kind.toUpperCase()}"],[aria-label="${kind==='to'?'To':kind==='cc'?'Cc':'Bcc'}"],[aria-label="${kind==='to'?'To':kind==='cc'?'Cc':'Bcc'} recipients"]`)];
    return addresses(fields.map(e=>[e.value||'',e.getAttribute('data-email')||'',e.textContent||'',[...(e.parentElement!==root&&e.parentElement.tagName!=='FORM'?e.parentElement.querySelectorAll('[email],[data-email],[data-hovercard-id]'):[])].map(n=>n.getAttribute('email')||n.getAttribute('data-email')||n.getAttribute('data-hovercard-id')).join(' ')].join(' ')).join(' '));
  };
  const to=recipients('to'),cc=recipients('cc'),bcc=recipients('bcc');
  const known=[...to,...cc,...bcc];
  const chipAddresses=addresses([...root.querySelectorAll('[email],[data-email],[data-hovercard-id]')].filter(e=>!body[0].contains(e)).map(e=>e.getAttribute('email')||e.getAttribute('data-email')||e.getAttribute('data-hovercard-id')||'').join(' '));
  if(chipAddresses.some(address=>!known.includes(address)))throw Error('Some recipient chips could not be assigned reliably to To/Cc/Bcc. Verify recipients manually rather than sending blindly.');
  if(!to.length&&!cc.length&&!bcc.length)throw Error('No verifiable recipient addresses. Complete the recipient field and inspect again.');
  const accountNode=document.querySelector('[aria-label*="Google Account"],[aria-label*="Account manager"],#O365_MainLink_Me,[data-framepilot-account]');
  const account=addresses(accountNode?.getAttribute('aria-label')||accountNode?.getAttribute('data-framepilot-account')||accountNode?.innerText||'')[0]||'';
  const from=root.querySelector('[name="from"],[aria-label="From"],[aria-label^="From:"],[data-framepilot-sender]');
  const sender=addresses(from?.value||from?.getAttribute('data-framepilot-sender')||from?.getAttribute('aria-label')||from?.innerText||'')[0]||account;
  const attachmentNodes=[...root.querySelectorAll('[data-attachment-name],.aV3,[aria-label*="Attachment"],[aria-label*="attachment"]')].filter(visible);
  const attachments=[...new Set(attachmentNodes.map(e=>e.getAttribute('data-attachment-name')||e.title||e.getAttribute('aria-label')||e.innerText).filter(Boolean))];
  const controls=[...root.querySelectorAll('button,[role="button"],input[type="submit"]')].filter(visible);
  const sends=controls.filter(e=>/^send(?:\b|$)/i.test(e.getAttribute('aria-label')||e.innerText||e.value||''));
  let send=target&&/^(button|input)$/i.test(target.tagName)||target?.getAttribute('role')==='button'?target:null;
  if(!send){if(sends.length!==1)throw Error('Send button is ambiguous. Read the page and specify its elementRef.');send=sends[0];}
  if(!/^send\b/i.test(send.getAttribute('aria-label')||send.innerText||send.value||''))throw Error('Target is not a labeled Send control.');
  if(/^send\s+(later|at|on|scheduled)\b/i.test(send.getAttribute('aria-label')||send.innerText||''))throw Error('Scheduled email sending is not supported by this review. Use the standard Send control.');
  if(send.disabled||send.getAttribute('aria-disabled')==='true')throw Error('Send is disabled; finish entering recipients and wait for attachments.');
  if(!state)throw Error('Read the page once before reviewing email.');
  if(!state.reverse.has(send)){const id=`${state.token}:${++state.next}`;state.reverse.set(send,id);state.refs.set(id,send);}
  if(/\b(uploading|attaching|scanning attachment|failed to attach)\b/i.test(root.innerText||''))throw Error('Attachments are still processing or failed. Wait and inspect again.');
  const links=[...body[0].querySelectorAll('a')].map(a=>({text:a.innerText,url:a.href}));
  const raw=body[0].isContentEditable?body[0].innerHTML:body[0].value;
  const contentHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const text=body[0].isContentEditable?body[0].innerText:body[0].value;
  if(text.length>60000)throw Error('Email is too long for a reliable review. Review and send manually.');
  return {account:account||'Not detected',sender:sender||'Account not detected — verify the active account',to,cc,bcc,subject:subject?.value||'(subject not detected — verify the thread)',body:text,links,contentHash,attachments,sendRef:state.reverse.get(send),warnings:[...(!sender?['Sending account could not be verified automatically.']:!from?['From address was inferred from the signed-in account. Verify any send-as alias on the page.']:[]),'Verify attachment names and upload completion on the website; custom attachment controls may not be recognized.'],url:location.href};
}
