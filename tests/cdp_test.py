import asyncio,json,threading
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kw):super().__init__(*args,directory=str(root),**kw)
 def do_GET(self):
  if self.path=='/fixture':
   self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(b'<html><title>Agent fixture</title><h1>Browser fixture</h1><input id="name"><button id="go" onclick="document.querySelector(\'#result\').textContent=\'Clicked\'">Continue</button><p id="result">Waiting</p></html>')
  else:super().do_GET()
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=await b.new_context();fixture=await c.new_page();base=f'http://127.0.0.1:{server.server_port}';await fixture.goto(base+'/fixture');cdp=await c.new_cdp_session(fixture)
  harness=await c.new_page();await harness.goto(base+'/options/index.html')
  await harness.expose_function('cdpCommand',lambda method,params:cdp.send(method,params))
  await harness.expose_function('extractPage',lambda:fixture.evaluate((root/'content/extract.js').read_text()))
  await harness.evaluate("""(base)=>{globalThis.chrome={runtime:{getPlatformInfo:async()=>({os:'linux'})},debugger:{onDetach:{addListener(){}},onEvent:{addListener(){}},attach:async()=>{},detach:async()=>{},sendCommand:async(_t,m,p)=>cdpCommand(m,p)},tabs:{get:async id=>({id,url:base+'/fixture'}),query:async()=>[{id:1,url:base+'/fixture',title:'Agent fixture'}]},scripting:{executeScript:async()=>[{result:await extractPage()}]}};}""",base)
  result=await harness.evaluate("""async()=>{const {execute,detachAll}=await import('/lib/browser.js');const {defaults}=await import('/lib/policy.js');const ctx={tabId:1,settings:defaults,signal:new AbortController().signal};const page=await execute('read_page',{},ctx);const ax=await execute('get_accessibility_tree',{},ctx);await execute('form_input',{selector:'#name',text:'Browser agent'},ctx);await execute('click_element',{selector:'#go'},ctx);const image=await execute('take_screenshot',{},ctx);const wait=await execute('wait_for_element',{selector:'#result'},ctx);await execute('scroll',{y:20},ctx);await detachAll();return {page:page.text,ax:ax.nodes.length,screenshot:!!image.image,wait};}""")
  assert 'Browser fixture' in result['page'];assert result['ax']>0;assert result['screenshot'];assert await fixture.locator('#name').input_value()=='Browser agent';assert await fixture.locator('#result').inner_text()=='Clicked'
  # Run the actual service-worker agent loop with Chrome API adapters and real CDP tools.
  await harness.evaluate("""(base)=>{const local={settings:{provider:'openai',openaiKey:'test',mode:'ask'}},session={};let listener;Object.assign(chrome.runtime,{id:'test',getURL:()=>base+'/',onInstalled:{addListener(){}},onMessage:{addListener:f=>{listener=f}},sendMessage:async m=>{if(m.type==='state')globalThis.latestState=m.state;},getPlatformInfo:async()=>({os:'linux'})});chrome.storage={local:{setAccessLevel:async()=>{},get:async()=>local,set:async d=>Object.assign(local,d)},session:{get:async()=>session,set:async d=>Object.assign(session,d),remove:async k=>delete session[k]}};chrome.sidePanel={setPanelBehavior:async()=>{}};chrome.action={setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}};globalThis.agentRequest=m=>new Promise(resolve=>listener(m,{id:'test',url:base+'/sidepanel/index.html'},resolve));let counter=0;globalThis.fetch=async()=>{const sequence=[['get_page_text',{}],['form_input',{selector:'#name',text:'Approved input'}],['click_element',{selector:'#go'}]];const call=sequence[counter++];const data=call?{choices:[{delta:{tool_calls:[{index:0,id:'call_'+counter,function:{name:call[0],arguments:JSON.stringify(call[1])}}]},finish_reason:'tool_calls'}]}:{choices:[{delta:{content:'Verified browser task complete.'},finish_reason:'stop'}]};return new Response('data: '+JSON.stringify(data)+'\\n\\n');};}""",base)
  await harness.evaluate("async()=>{await import('/service-worker.js');return await agentRequest({type:'getState'});}")
  await harness.evaluate("()=>agentRequest({type:'start',text:'Read then fill and click the fixture'})")
  for tool in ['get_page_text','form_input','click_element']:
   await harness.wait_for_function('(tool)=>globalThis.latestState?.pending?.name===tool',arg=tool)
   await harness.evaluate("()=>agentRequest({type:'approve',id:latestState.pending.id,approved:true})")
  await harness.wait_for_function("()=>globalThis.latestState?.status==='Done'")
  assert await fixture.locator('#name').input_value()=='Approved input'
  print('Actual service-worker agent loop: three approval gates, real CDP read/fill/click, mock provider stream, completed.')
  # UI-only adapter; messages never touch the real extension runtime.
  ui=await c.new_page();errors=[];ui.on('pageerror',lambda e:errors.append(str(e)))
  await ui.add_init_script("""(()=>{let settings={},session={};let listeners=[];globalThis.chrome={runtime:{sendMessage:async m=>m.type==='getState'?{messages:[],running:false,pending:null,status:'Ready'}:{ok:true},openOptionsPage(){},onMessage:{addListener(){}}},storage:{local:{get:async()=>({settings}),set:async v=>{settings=v.settings}},onChanged:{addListener:f=>listeners.push(f)}}};})()""")
  await ui.goto(base+'/sidepanel/index.html');await ui.locator('#prompt').fill('Summarize this page');# Rendered using a browser page with the extension runtime adapter.
  await ui.goto(base+'/options/index.html');await ui.locator('[name=allowlist]').fill('example.com\n*.example.org');await ui.get_by_role('button',name='Save settings').click();await ui.get_by_text('Settings saved.',exact=True).wait_for();await ui.locator('[name=blocklist]').fill('https://invalid.example');await ui.get_by_role('button',name='Save settings').click();await ui.get_by_text('Invalid hostname: https://invalid.example',exact=True).wait_for();assert not errors,errors
  print(json.dumps({'browser_tools_over_real_CDP':result,'UI':'renders and saves settings; rejects invalid hostname','errors':errors},indent=2));await b.close()
asyncio.run(main());server.shutdown()
