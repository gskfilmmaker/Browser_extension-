"""Real Chromium/CDP integration with explicit Chrome API adapters, no provider keys.
Tests controls, element references, open shadow DOM, frames, files, reviewed email,
stale-approval rejection, duplicate prevention, and uncertain-send recovery.
"""
import os
import asyncio, json, threading, base64
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
FIXTURE='''<!doctype html><html><head><title>FramePilot advanced fixture</title></head><body>
<div data-framepilot-account="sender@example.com">Sender</div>
<label>Name <input id="name" aria-label="Name"></label>
<label>Category <select id="category"><option value="a">Alpha</option><option value="b">Beta</option></select></label>
<label><input type="checkbox" id="toggle">Enable option</label>
<button id="ordinary" type="button" onclick="this.textContent='Changed'">Continue</button>
<form role="search" onsubmit="event.preventDefault();document.querySelector('#search-result').textContent='Found '+this.q.value"><input name="q" type="search" aria-label="Search"><button>Search</button></form><p id="search-result"></p>
<button type="button" id="hover" onmouseover="document.querySelector('#hover-result').textContent='Hovered'" oncontextmenu="event.preventDefault();document.querySelector('#hover-result').textContent='Right clicked'" ondblclick="document.querySelector('#hover-result').textContent='Double clicked'">Hover target</button><p id="hover-result"></p>
<div id="drag" style="display:inline-block;width:80px;height:50px;background:#ddd">Drag source</div><div id="drop" style="display:inline-block;width:80px;height:50px;background:#eee">Drop target</div><p id="drag-result"></p>
<script>document.querySelector('#drag').onpointerdown=()=>{window.dragging=true;};document.onpointerup=e=>{if(window.dragging&&document.elementFromPoint(e.clientX,e.clientY)?.id==='drop')document.querySelector('#drag-result').textContent='Dropped';window.dragging=false;};</script>
<div id="shadow"></div><script>const r=document.querySelector('#shadow').attachShadow({mode:'open'});r.innerHTML='<label>Shadow name <input aria-label="Shadow name"></label><button type="button">Shadow action</button>';r.querySelector('button').onclick=()=>r.querySelector('button').textContent='Shadow clicked';</script>
<iframe title="Embedded form" src="/frame" width="600" height="120"></iframe>
<form id="composer" data-framepilot-composer onsubmit="event.preventDefault()">
<label>To <input name="to" value="recipient@example.com"></label><label>Cc <input name="cc" value="copy@example.com"></label><label>Bcc <input name="bcc" value=""></label>
<label>Subject <input name="subject" value="A test email"></label>
<div id="body" role="textbox" contenteditable="true" aria-label="Message Body">Hello from FramePilot</div>
<input type="file" id="upload" multiple hidden><span id="attachment"></span>
<button type="button" id="send" onclick="window.sendCount=(window.sendCount||0)+1;document.querySelector('#sent').textContent='Message sent'">Send</button></form>
<p id="sent" role="status"></p>
<script>document.querySelector('#upload').onchange=e=>{const span=document.querySelector('#attachment');span.textContent=e.target.files[0]?.name||'';span.setAttribute('data-attachment-name',span.textContent);};</script>
</body></html>'''
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**k):super().__init__(*a,directory=str(ROOT),**k)
 def do_GET(self):
  if self.path=='/download':
   self.send_response(200);self.send_header('Content-Type','application/octet-stream');self.send_header('Content-Disposition','attachment; filename=framepilot.txt');self.end_headers();self.wfile.write(b'FramePilot download fixture');return
  if self.path in ['/fixture','/frame']:
   text=FIXTURE if self.path=='/fixture' else '<html><body><label>Frame input <input aria-label="Frame input"></label><button type="button" onclick="this.textContent=\'Frame clicked\'">Frame action</button></body></html>'
   self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(text.encode())
  else:super().do_GET()
 def log_message(self,*a):pass
async def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(executable_path=os.environ.get('FRAMEPILOT_CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
   context=await browser.new_context(accept_downloads=True);fixture=await context.new_page();base=f'http://127.0.0.1:{server.server_port}'
   await fixture.goto(base+'/fixture');await fixture.frame_locator('iframe').get_by_role('button').wait_for()
   cdp=await context.new_cdp_session(fixture);harness=await context.new_page();await harness.goto(base+'/options/index.html')
   async def page_exec(source,args,frameId):return await fixture.frames[frameId].evaluate('([source,args])=>('+source+')(...args)',[source,args])
   async def frame_list():return [{'frameId':i,'parentFrameId':-1 if f==fixture.main_frame else fixture.frames.index(f.parent_frame),'url':f.url} for i,f in enumerate(fixture.frames)]
   async def start_download(url):
    async with fixture.expect_download() as future:
     await fixture.evaluate("url=>{const a=document.createElement('a');a.href=url;a.download='framepilot.txt';document.body.append(a);a.click();a.remove();}",url)
    download=await future.value
    await download.path()
    assert await download.failure() is None
    return 1
   await harness.expose_function('startDownload',start_download)
   await harness.expose_function('pageExec',page_exec);await harness.expose_function('frameList',frame_list);await harness.expose_function('cdpCommand',lambda m,a:cdp.send(m,a))
   await harness.evaluate("""base=>{let session={};globalThis.chrome={runtime:{getPlatformInfo:async()=>({os:'linux'})},debugger:{onDetach:{addListener(){}},onEvent:{addListener(){}},attach:async()=>{},detach:async()=>{},sendCommand:async(t,m,a)=>cdpCommand(m,a)},tabs:{get:async id=>({id,url:base+'/fixture'}),query:async()=>[{id:1,url:base+'/fixture'}]},webNavigation:{getAllFrames:async()=>await frameList()},downloads:{download:async a=>await startDownload(a.url),search:async a=>[{id:a.id,state:'complete',filename:'framepilot.txt'}]},storage:{session:{get:async()=>session,set:async d=>Object.assign(session,d)}},scripting:{executeScript:async spec=>[{result:await pageExec(spec.func.toString(),spec.args||[],spec.target.frameIds[0])}]}};}""",base)
   await harness.evaluate("""async()=>{globalThis.api=await import('/lib/browser.js');const {defaults}=await import('/lib/policy.js');globalThis.ctx={tabId:1,settings:defaults,signal:new AbortController().signal};globalThis.act=async(name,args={},approve=false)=>{const plan=await api.prepareAction(name,args,ctx);ctx.authorization={signature:plan.signature,approved:approve};return await api.execute(name,args,ctx);};}""")
   snapshot=await harness.evaluate("()=>act('read_page')");refs={e['label']:e['elementRef'] for e in snapshot['elements']}
   assert 'Shadow name' in refs
   assert (await harness.evaluate("ref=>act('form_input',{elementRef:ref,text:'Stable input'})",refs['Name']))['verified']
   assert (await harness.evaluate("()=>act('select_option',{selector:'#category',value:'b'})"))['verified']
   assert (await harness.evaluate("()=>act('set_checked',{selector:'#toggle',checked:true})"))['verified']
   assert (await harness.evaluate("ref=>act('form_input',{elementRef:ref,text:'Inside shadow'})",refs['Shadow name']))['verified']
   await harness.evaluate("ref=>act('click_element',{elementRef:ref})",refs['Shadow action'])
   assert await fixture.locator('#shadow').get_by_role('button').inner_text()=='Shadow clicked'
   await harness.evaluate("()=>act('hover_element',{selector:'#hover'})")
   assert await fixture.locator('#hover-result').inner_text()=='Hovered'
   await harness.evaluate("()=>act('click_element',{selector:'#hover',button:'right'})")
   assert await fixture.locator('#hover-result').inner_text()=='Right clicked'
   await harness.evaluate("()=>act('click_element',{selector:'#hover',clickCount:2})")
   assert await fixture.locator('#hover-result').inner_text()=='Double clicked'
   await harness.evaluate("()=>act('drag_element',{selector:'#drag',toSelector:'#drop'})")
   assert await fixture.locator('#drag-result').inner_text()=='Dropped'
   await harness.evaluate("()=>act('form_input',{role:'searchbox',name:'Search',text:'FramePilot'})")
   await harness.evaluate("()=>act('press_key',{key:'Enter'})")
   assert await fixture.locator('#search-result').inner_text()=='Found FramePilot'
   fs=await harness.evaluate("()=>act('get_frames')");child=next(f['frameId'] for f in fs['frames'] if f['frameId'])
   inner=await harness.evaluate("frameId=>act('read_page',{frameId})",child)
   inner_ref=next(e['elementRef'] for e in inner['elements'] if e['label']=='Frame action')
   await harness.evaluate("a=>act('click_element',a)",{'frameId':child,'elementRef':inner_ref})
   assert await fixture.frame_locator('iframe').get_by_role('button').inner_text()=='Frame clicked'
   download=await harness.evaluate("url=>act('download_file',{url},true)",base+'/download')
   status=await harness.evaluate("id=>act('get_download_status',{downloadId:id})",download['downloadId'])
   assert status['state']=='complete'
   # User-selected files are stored in extension-origin IndexedDB, then explicitly approved.
   file=await harness.evaluate("""async()=>{const {addFile}=await import('/lib/files.js');return await addFile(new File(['hello attachment'],'test.txt',{type:'text/plain'}));}""")
   uploaded=await harness.evaluate("id=>act('attach_files',{selector:'#upload',fileIds:[id]},true)",file['id'])
   assert uploaded['attached'][0]['name']=='test.txt'
   review=await harness.evaluate("()=>act('inspect_email_draft',{selector:'#send'})")
   assert review['to']==['recipient@example.com'];assert review['cc']==['copy@example.com'];assert review['sender']=='sender@example.com';assert review['attachments']==['test.txt']
   # Missing approval cannot send.
   error=await harness.evaluate("async()=>{try{await act('send_email',{selector:'#send'});return '';}catch(e){return e.message;}}")
   assert 'confirmation' in error
   # Editing a reviewed email invalidates the grant.
   await harness.evaluate("async()=>{globalThis.plan=await api.prepareAction('send_email',{selector:'#send'},ctx);ctx.authorization={signature:plan.signature,approved:true};}")
   await fixture.locator('#body').fill('Changed after approval')
   error=await harness.evaluate("async()=>{try{await api.execute('send_email',{selector:'#send'},ctx);return '';}catch(e){return e.message;}}")
   assert 'changed' in error
   sent=await harness.evaluate("()=>act('send_email',{selector:'#send'},true)")
   assert sent['status']=='submission-confirmed',sent
   error=await harness.evaluate("async()=>{try{await act('send_email',{selector:'#send'},true);return '';}catch(e){return e.message;}}")
   assert 'already' in error
   assert await fixture.evaluate('window.sendCount')==1
   # An old sent toast is not evidence that a new send succeeded.
   await fixture.locator('#body').fill('A different message')
   await fixture.evaluate("()=>{document.querySelector('#send').onclick=()=>{window.sendCount++;};}")
   uncertain=await harness.evaluate("()=>act('send_email',{selector:'#send'},true)")
   assert uncertain['status']=='uncertain',uncertain
   assert await fixture.evaluate('window.sendCount')==2,await fixture.evaluate('({count:window.sendCount,html:document.querySelector("#send").outerHTML})')
   # Detached references never silently retarget another element.
   await fixture.locator('#name').evaluate('(e)=>e.remove()')
   stale=await harness.evaluate("async ref=>{try{await act('form_input',{elementRef:ref,text:'wrong'});return '';}catch(e){return e.message;}}",refs['Name'])
   assert 'Stale' in stale
   # Actual worker/provider loop: prepare a draft, present real review data, wait for approval, send, verify.
   await fixture.evaluate("()=>{document.querySelector('#send').onclick=()=>{window.sendCount++;document.querySelector('#sent').textContent='Message sent';};}")
   await harness.evaluate("""base=>{let local={settings:{provider:'openai',openaiKey:'test-only',mode:'auto',permissionPolicyVersion:2}};let listener;Object.assign(chrome.runtime,{id:'test',getURL:()=>base+'/',onInstalled:{addListener(){}},onMessage:{addListener(f){listener=f;}},sendMessage:async m=>{if(m.type==='state')globalThis.workerState=m.state;}});chrome.storage.local={get:async()=>local,set:async d=>Object.assign(local,d),setAccessLevel:async()=>{}};chrome.sidePanel={setPanelBehavior:async()=>{}};chrome.action={setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}};globalThis.workerRequest=m=>new Promise(resolve=>listener(m,{id:'test',url:base+'/sidepanel/index.html'},resolve));let index=0;globalThis.fetch=async()=>{const sequence=[['update_task',{steps:[{text:'Prepare and verify an email',status:'working'}]}],['read_page',{}],['form_input',{selector:'#body',text:'Email composed by agent'}],['inspect_email_draft',{selector:'#send'}],['send_email',{selector:'#send'}],['update_task',{steps:[{text:'Prepare and verify an email',status:'done'}]}]];const call=sequence[index++];const event=call?{choices:[{delta:{tool_calls:[{index:0,id:'email_'+index,function:{name:call[0],arguments:JSON.stringify(call[1])}}]},finish_reason:'tool_calls'}]}:{choices:[{delta:{content:'The website confirmed email submission.'},finish_reason:'stop'}]};return new Response('data: '+JSON.stringify(event)+'\\n\\n');};}""",base)
   await harness.evaluate("async()=>{await import('/service-worker.js');return await workerRequest({type:'getState'});}")
   await harness.evaluate("()=>workerRequest({type:'start',text:'Compose and send the test email'})")
   await harness.wait_for_function("()=>workerState?.pending?.name==='send_email'")
   live_review=await harness.evaluate('()=>workerState.pending.review')
   assert live_review['body']=='Email composed by agent' and live_review['to']==['recipient@example.com']
   assert await fixture.evaluate('window.sendCount')==2
   ui=await context.new_page();await ui.set_viewport_size({'width':380,'height':820})
   ui_errors=[];ui.on('pageerror',lambda e:ui_errors.append(str(e)))
   ui_state={'messages':[], 'running':True,'status':'Waiting for approval','pending':{'id':'preview','name':'send_email','level':'critical','notice':'Review this email before sending.','url':base+'/fixture','args':{'selector':'#send'},'review':live_review}}
   await ui.add_init_script("globalThis.previewState="+json.dumps(ui_state)+";globalThis.chrome={runtime:{sendMessage:async()=>previewState,onMessage:{addListener(){}},openOptionsPage(){}},storage:{local:{get:async()=>({settings:{mode:'auto'}})},onChanged:{addListener(){}}}};")
   await ui.goto(base+'/sidepanel/index.html')
   await ui.get_by_text('To: recipient@example.com',exact=True).wait_for()
   await ui.get_by_text('Email composed by agent',exact=True).wait_for()
   for button in ['Deny','Approve once']:
    rect=await ui.get_by_role('button',name=button,exact=True).bounding_box()
    assert rect and rect['y']+rect['height']<=820
   if os.environ.get('FRAMEPILOT_CAPTURE'):
    await ui.screenshot(path=str(ROOT/'brand/email-review-preview.png'))
   assert not ui_errors,ui_errors
   await ui.close()
   await harness.evaluate("()=>workerRequest({type:'approve',id:workerState.pending.id,approved:true})")
   await harness.wait_for_function("()=>workerState.status==='Done'")
   assert await fixture.evaluate('window.sendCount')==3
   assert await harness.evaluate("()=>workerState.steps[0].status")=='done'
   print('Worker email loop passed: real draft extraction → approval review → send → fresh confirmation → completed checklist.')
   print(json.dumps({'passed':['stable refs','role/name targeting','hover/right/double click','pointer drag','requested download/status','rich and plain input verification','keyboard search submission','native select','checkbox','open shadow DOM','frame reading and mouse coordinates','selected-file attachment','actual email review','missing/stale approval rejection','email send confirmation','duplicate-send prevention','uncertain send without retry','stale element rejection']},indent=2))
   await api_detach(harness);await browser.close()
 finally:server.shutdown()
async def api_detach(harness):await harness.evaluate('()=>api.detachAll()')
if __name__=='__main__':asyncio.run(main())
