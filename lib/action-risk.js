const critical = /\b(delete|trash|discard|remove|erase|destroy|send|publish|post|share|invite|purchase|checkout|subscribe|unsubscribe|transfer|withdraw|revoke|authorize|grant|download|upload|attach)\b|\b(pay|buy|order)\s+(now|order|payment)|\b(place order|complete payment|confirm payment|change password|reset password|save password|change email|close account|cancel subscription|sign in|log in|sign out|log out)\b/i;
const sensitive = /password|passkey|security|privacy|account.settings|two.factor|\b2fa\b|security key|credit.card|card.number|\bcvv\b|\bcvc\b|bank.account|routing.number|social.security|\bssn\b|api.?key|secret|access.?token|recovery.code|one.time.code|verification.code|payment|billing|permission|account deletion/i;
const generic = /^(continue|confirm|yes|ok|okay|submit|save|update|done|apply|allow|accept|next)(\b|$)/i;
const destructiveURL=/(?:\/|[?&])(?:delete|remove|destroy|logout|signout|unsubscribe|purchase|pay|transfer)(?:[/?=&]|$)/i;
export function classifyAction(name,args={},e=null){
 const risk=(level,reason)=>({level,reason});
 if(['send_email','attach_files','download_file'].includes(name))return risk('critical',name==='send_email'?'Review the exact email before sending.':name==='attach_files'?'This uploads selected files to the website.':'This downloads a file to your computer.');
 if(args.critical===true)return risk('critical','The requested action is marked sensitive by the agent.');
 if(['navigate','create_tab'].includes(name)&&destructiveURL.test(args.url||''))return risk('critical','The destination may perform a destructive, financial, or account action.');
 if(['get_element_value','inspect_email_draft','list_files','get_frames','update_task','hover_element'].includes(name))return risk('routine','Read or inspect task context.');
 if(!['click_element','type_text','form_input','press_key','select_option','set_checked','drag_element'].includes(name))return risk('routine','Routine browser operation.');
 if(!e?.found)return risk('unknown','The target could not be inspected reliably.');
 if(name==='select_option'&&(critical.test(args.value||args.option||'')||sensitive.test(args.value||args.option||'')))return risk('critical','The selected option may commit a sensitive change.');
 const label=[e.label,e.title,e.name,e.id].filter(Boolean).join(' ');
 if(name==='press_key'){
  if(/(?:ctrl|control|meta|cmd|command|primary|alt)\+/i.test(args.key||'')&&!/^(?:Primary|Control|Ctrl|Meta|Cmd|Command)\+(?:a|c|z|y)$/i.test(args.key||''))return risk('critical','This keyboard shortcut may submit, send, or change website data.');
  if(/^(Delete|Backspace)$/i.test(args.key||'')&&!e.editable)return risk('critical','This key can delete selected messages or records.');
  if(!/^(Enter|Return|Space)$/i.test(args.key||''))return risk('routine','Keyboard navigation or editing.');
  if(/^(Enter|Return)$/.test(args.key||'')&&e.tag==='INPUT'&&!e.search&&e.context)return risk('critical','Enter may submit this non-search form. Use the visible control for a clearer review.');
  if(e.editable&&e.type!=='password'&&!e.submit&&!e.context)return risk('routine','Editing the focused field.');
 }
 if(['type_text','form_input'].includes(name)){
  if(e.type==='search'||e.role==='searchbox')return risk('routine','Search field input.');
  if(e.type==='password'||sensitive.test(label+' '+e.autocomplete))return risk('critical','This field may contain credentials, payment information, or account-security data.');
  return risk('routine','Drafting or editing a regular field; this does not submit it.');
 }
 if(e.download)return risk('critical','This link initiates a file download.');
 if(e.crossFrame)return risk('unknown','Use get_frames to select the embedded document before acting.');
 if(e.type==='password'||sensitive.test(label)||critical.test(label)||destructiveURL.test(e.href||''))return risk('critical','This control may send, delete, purchase, share, authenticate, or change account settings.');
 if((e.role==='switch'||['checkbox','radio'].includes(e.type))&&sensitive.test(e.context||''))return risk('critical','This control changes a sensitive account or payment setting.');
 if((generic.test(label.trim())||e.submit)&&(sensitive.test(e.context||'')||critical.test(e.context||'')))return risk('critical','This confirmation belongs to a sensitive form or dialog.');
 if(e.submit&&!e.search)return risk('critical','Submitting a non-search form can send information or commit a change.');
 if(!label.trim()&&!e.href)return risk('unknown','This unlabeled control has no reliable action description.');
 return risk('routine','Ordinary page interaction.');
}
