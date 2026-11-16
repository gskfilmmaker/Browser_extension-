"""Media transfer integration: mocked Drive/Studio UI, real downloads and CDP file assignment.
Never connects to a Google account or uploads to YouTube.
"""
import os,asyncio,json,tempfile,threading
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
CHANNEL='UCFramePilotTestChannel'
STUDIO=f'https://studio.youtube.com/channel/{CHANNEL}/videos'
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  if self.path=='/source':
   self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(SOURCE.encode());return
  if self.path.startswith('/payload/'):
   name=self.path.split('/')[-1];size=40*1024*1024 if name=='first.mp4' else 4096
   self.send_response(200);self.send_header('Content-Type','video/mp4');self.send_header('Content-Disposition',f'attachment; filename={name}');self.send_header('Content-Length',str(size));self.end_headers()
   chunk=b'0'*(1024*1024)
   while size:part=chunk[:min(len(chunk),size)];self.wfile.write(part);size-=len(part)
   return
  file=ROOT/self.path.lstrip('/').split('?')[0]
  if file.is_file():self.send_response(200);self.send_header('Content-Type','text/javascript' if file.suffix=='.js' else 'text/html');self.end_headers();self.wfile.write(file.read_bytes());return
  self.send_response(404);self.end_headers()
 def log_message(self,*a):pass
SOURCE='''<html><title>Drive test source</title><body><a id="one" href="/payload/first.mp4" download="first.mp4">Download</a><a id="two" href="/payload/second.mp4" download="second.mp4">Download</a></body></html>'''
DEST='''<html><title>Studio test destination</title><body><div id="channel-name">FramePilot test channel</div><div role="dialog" data-framepilot-youtube-upload>
<input id="upload" type="file" accept="video/*" multiple hidden><span id="original-filename"></span>
<label>Title <input id="title" name="title" value=""></label><label>Description <textarea id="description"></textarea></label>
<label><input type="radio" name="visibility" value="private" checked>Private</label><label><input type="radio" name="visibility" value="unlisted">Unlisted</label><label><input type="radio" name="visibility" value="public">Public</label>
<label><input type="radio" name="audience" value="yes_mfk">Yes, made for kids</label><label><input type="radio" name="audience" value="not_mfk" checked>No, not made for kids</label>
<p id="progress">Waiting for files</p><button id="save" type="button"><span id="save-label">Save</span></button></div><p role="status" id="saved"></p>
<script>window.attachCount=0;window.saveCount=0;document.querySelector('#upload').onchange=e=>{attachCount++;document.querySelector('#original-filename').textContent=e.target.files[0].name;document.querySelector('#progress').textContent='Upload complete. Checks complete.';};document.querySelector('#save').onclick=()=>{saveCount++;document.querySelector('#saved').textContent='Changes saved';};</script></body></html>'''
async def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with tempfile.TemporaryDirectory(prefix='framepilot-media-') as temp:
   async with async_playwright() as p:
    browser=await p.chromium.launch(executable_path=os.environ.get('FRAMEPILOT_CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    context=await browser.new_context(accept_downloads=True)
    base=f'http://127.0.0.1:{server.server_port}'
    # Source downloads use a local Drive-style fixture; no live Drive request is made.
    await context.route('https://studio.youtube.com/**',lambda route:route.fulfill(status=200,content_type='text/html',body=DEST))
    source=await context.new_page();await source.goto(base+'/source')
    destination=await context.new_page();await destination.goto(STUDIO)
    harness=await context.new_page();await harness.goto(base+'/options/index.html')
    pages={1:source,2:destination};sessions={i:await context.new_cdp_session(page) for i,page in pages.items()}
    async def execute_page(tabId,source_code,args,frameId):return await pages[tabId].main_frame.evaluate('([code,args])=>('+source_code+')(...args)',[source_code,args])
    async def tab_info(tabId):return {'id':tabId,'url':pages[tabId].url,'title':await pages[tabId].title(),'active':tabId==1}
    await harness.expose_function('pageExec',execute_page);await harness.expose_function('tabInfo',tab_info);await harness.expose_function('cdpCommand',lambda id,method,args:sessions[id].send(method,args))
    await harness.evaluate("""()=>{globalThis.local={};globalThis.session={};globalThis.items=[];let created=[],changed=[];globalThis.chrome={runtime:{getPlatformInfo:async()=>({os:'linux'})},tabs:{get:async id=>tabInfo(id),query:async()=>[await tabInfo(1),await tabInfo(2)]},debugger:{onDetach:{addListener(){}},onEvent:{addListener(){}},attach:async()=>{},detach:async()=>{},sendCommand:async(t,m,a)=>cdpCommand(t.tabId,m,a)},storage:{local:{get:async()=>structuredClone(local),set:async d=>Object.assign(local,structuredClone(d))},session:{get:async()=>structuredClone(session),set:async d=>Object.assign(session,structuredClone(d))}},scripting:{executeScript:async spec=>[{result:await pageExec(spec.target.tabId,spec.func.toString(),spec.args||[],spec.target.frameIds[0])}]},downloads:{onCreated:{addListener:f=>created.push(f)},onChanged:{addListener:f=>changed.push(f)},search:async q=>structuredClone(q.id!==undefined?items.filter(d=>d.id===q.id):items.filter(d=>!q.startedAfter||Date.parse(d.startTime)>=Date.parse(q.startedAfter))),emit:d=>{items.push(d);for(const f of created)f(d);for(const f of changed)f({id:d.id,state:{current:d.state}});}}};}""")
    await harness.evaluate("""async()=>{globalThis.api=await import('/lib/browser.js');globalThis.transfers=await import('/lib/transfers.js');transfers.installDownloadListeners();const {defaults}=await import('/lib/policy.js');globalThis.ctx={tabId:1,settings:defaults,signal:new AbortController().signal};globalThis.act=async(name,args={},approved=false)=>{const plan=await api.prepareAction(name,args,ctx);ctx.authorization={signature:plan.signature,approved};return await api.execute(name,args,ctx);};}""")
    plan={'sourceTabId':1,'destinationTabId':2,'channel':'FramePilot test channel','visibility':'unlisted','madeForKids':False,'files':[{'name':'first.mp4','title':'First reel','description':'A test reel'},{'name':'second.mp4','title':'Second reel','description':'Another test reel'}]}
    denied=await harness.evaluate("async a=>{try{await act('create_upload_job',a);return '';}catch(e){return e.message;}}",plan);assert 'confirmation' in denied
    job=await harness.evaluate("a=>act('create_upload_job',a,true)",plan);jobId=job['id']
    for index,(selector,name) in enumerate([('#one','first.mp4'),('#two','second.mp4')],1):
     async with source.expect_download() as future:
      # Download buttons covered by the approved source batch do not ask again.
      await harness.evaluate("a=>act('click_element',a)",{'tabId':1,'selector':selector})
     download=await future.value;path=Path(temp)/name;await download.save_as(path)
     item={'id':index,'filename':str(path),'url':base+'/payload/'+name,'referrer':source.url,'finalUrl':base+'/payload/'+name,'startTime':await source.evaluate('new Date().toISOString()'),'endTime':await source.evaluate('new Date().toISOString()'),'state':'complete','danger':'safe','exists':True,'mime':'video/mp4','fileSize':path.stat().st_size,'bytesReceived':path.stat().st_size,'totalBytes':path.stat().st_size}
     await harness.evaluate('d=>chrome.downloads.emit(d)',item)
    ready=await harness.evaluate("id=>act('get_upload_job',{jobId:id})",jobId)
    assert all(f['status']=='ready' for f in ready['files']),ready
    assert ready['files'][0]['size']==40*1024*1024
    assert 'localPath' not in json.dumps(ready) and temp not in json.dumps(ready)
    # Resume is restricted to interrupted files already registered in this job.
    await harness.evaluate("async()=>{items[0].state='interrupted';items[0].canResume=true;chrome.downloads.resume=async id=>{globalThis.resumedId=id;};await transfers.captureDownload(items[0]);}")
    resumed=await harness.evaluate("id=>act('resume_transfer_download',{jobId:id,downloadId:1},true)",jobId)
    assert resumed['status']=='resuming' and await harness.evaluate('resumedId')==1
    unrelated=await harness.evaluate("async id=>{try{await act('resume_transfer_download',{jobId:id,downloadId:999},true);return '';}catch(e){return e.message;}}",jobId)
    assert 'registered' in unrelated
    await harness.evaluate("async()=>{items[0].state='complete';await transfers.captureDownload(items[0]);}")
    attached=await harness.evaluate("id=>act('attach_downloads',{jobId:id})",jobId)
    assert attached['status']=='attached',attached
    assert await destination.evaluate('attachCount')==1
    assert await destination.locator('#upload').evaluate('(e)=>e.files[0].size')==40*1024*1024
    again=await harness.evaluate("id=>act('attach_downloads',{jobId:id})",jobId);assert again['status']=='already-attached'
    assert await destination.evaluate('attachCount')==1
    # Restarting the browser session requires reauthorization; metadata and files remain.
    await harness.evaluate('()=>{globalThis.session={};}')
    expired=await harness.evaluate("async id=>{try{await act('attach_downloads',{jobId:id});return '';}catch(e){return e.message;}}",jobId);assert 'fresh review' in expired
    renewed=await harness.evaluate("a=>act('resume_upload_job',a,true)",{'jobId':jobId,'sourceTabId':1,'destinationTabId':2})
    assert renewed['files'][0]['downloadId']==1 and renewed['files'][0]['status']=='attached'
    # Fill actual Studio fields with normal native input tools.
    await harness.evaluate("()=>act('form_input',{tabId:2,selector:'#title',text:'First reel'})")
    await harness.evaluate("()=>act('form_input',{tabId:2,selector:'#description',text:'A test reel'})")
    await harness.evaluate("()=>act('set_checked',{tabId:2,selector:'input[value=unlisted]',checked:true})")
    snapshot=await harness.evaluate("()=>act('inspect_youtube_upload',{tabId:2})")
    assert snapshot['visibility']=='unlisted' and snapshot['madeForKids'] is False,snapshot
    finalArgs={'jobId':jobId,'downloadId':1,'selector':'#save'}
    # A raw Save click cannot bypass the reviewed job tool.
    raw=await harness.evaluate("async()=>{try{await act('click_element',{tabId:2,selector:'#save'},true);return '';}catch(e){return e.message;}}")
    assert 'finalize_youtube_upload' in raw
    nested=await harness.evaluate("async()=>{try{await act('click_element',{tabId:2,selector:'#save-label'},true);return '';}catch(e){return e.message;}}")
    assert 'finalize_youtube_upload' in nested
    await destination.locator('#title').focus()
    implicit=await harness.evaluate("async()=>{try{await act('press_key',{tabId:2,key:'Enter'},true);return '';}catch(e){return e.message;}}")
    assert 'implicit submit' in implicit
    final_plan=await harness.evaluate("a=>api.prepareAction('finalize_youtube_upload',a,ctx)",finalArgs)
    assert final_plan['videoReview']['title']=='First reel'
    # Editing metadata after approval invalidates finalization.
    await harness.evaluate("p=>{ctx.authorization={signature:p.signature,approved:true};}",final_plan)
    await destination.locator('#title').fill('Changed after approval')
    changed=await harness.evaluate("async a=>{try{await api.execute('finalize_youtube_upload',a,ctx);return '';}catch(e){return e.message;}}",finalArgs)
    assert 'title differs' in changed or 'changed' in changed,changed
    assert await destination.evaluate('saveCount')==0
    await destination.locator('#title').fill('First reel')
    saved=await harness.evaluate("a=>act('finalize_youtube_upload',a,true)",finalArgs)
    assert saved['status']=='website-confirmed-save',saved
    repeated=await harness.evaluate("async a=>{try{await act('finalize_youtube_upload',a,true);return '';}catch(e){return e.message;}}",finalArgs)
    assert 'already had' in repeated
    assert await destination.evaluate('saveCount')==1
    await harness.evaluate("id=>act('cancel_upload_job',{jobId:id})",jobId)
    cancelled=await harness.evaluate("async id=>{try{await act('attach_downloads',{jobId:id});return '';}catch(e){return e.message;}}",jobId);assert 'revoked' in cancelled
    assert (Path(temp)/'first.mp4').exists()
    print(json.dumps({'passed':['one batch approval','source-scoped download clicks','real 40 MB download','persistent metadata without paths in model output','real CDP file assignment without base64','no duplicate attachment','registered interrupted download resume','restart requires renewed approval','resume preserves attachment state','actual Studio metadata/audience/visibility inspection','raw final Save bypass blocked','changed metadata rejection','fresh save confirmation','duplicate finalization blocked','revocation without deleting disk files']},indent=2))
    await harness.evaluate('()=>api.detachAll()');await browser.close()
 finally:server.shutdown()
if __name__=='__main__':asyncio.run(main())
