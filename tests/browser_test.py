import os
import asyncio, tempfile, json, threading
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from playwright.async_api import async_playwright
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(b'<html><head><title>Agent test</title></head><body><h1>Browser fixture</h1><input id="name"><button id="go" onclick="document.querySelector(\'#result\').textContent=\'Clicked\'">Continue</button><p id="result">Waiting</p></body></html>')
 def log_message(self,*a):pass
server=HTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
async def main():
 async with async_playwright() as p:
  ext=str(Path(__file__).resolve().parents[1])
  context=await p.chromium.launch_persistent_context(tempfile.mkdtemp(),executable_path=os.environ.get('FRAMEPILOT_CHROMIUM','/usr/bin/chromium'),headless=True,ignore_default_args=['--disable-extensions'],args=[f'--disable-extensions-except={ext}',f'--load-extension={ext}','--no-sandbox','--enable-unsafe-extension-debugging','--disable-features=DisableLoadExtensionCommandLineSwitch'])
  # New Chromium versions support explicit unpacked loading via CDP. Managed policy may reject it.
  if not context.service_workers:
   session=await context.browser.new_browser_cdp_session()
   try: await session.send('Extensions.loadUnpacked',{'path':ext})
   except Exception as e:
    await context.close()
    raise RuntimeError('Native extension loading unavailable; inspect Chrome managed policy. '+str(e)) from e
  worker=context.service_workers[0] if context.service_workers else await context.wait_for_event('serviceworker')
  eid=worker.url.split('/')[2];errors=[]
  page=await context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(f'http://127.0.0.1:{server.server_port}/')
  tabid=await worker.evaluate("async()=> (await chrome.tabs.query({})).find(t=>t.url.includes('127.0.0.1')).id")
  # Directly exercise real debugger and injected extraction tools.
  result=await worker.evaluate("""async(id)=>{const {execute,detachAll}=await import('./lib/browser.js');const {defaults}=await import('./lib/policy.js');const ctx={tabId:id,settings:defaults,signal:new AbortController().signal};const out={};out.page=await execute('read_page',{},ctx);out.ax=await execute('get_accessibility_tree',{},ctx);out.fill=await execute('form_input',{selector:'#name',text:'Browser agent'},ctx);out.click=await execute('click_element',{selector:'#go'},ctx);out.shot=!!(await execute('take_screenshot',{},ctx)).image;out.tabs=await execute('get_tabs_context',{},ctx);await detachAll();return out;}""",tabid)
  assert 'Browser fixture' in result['page']['text'];assert result['ax']['nodes'];assert result['shot']
  assert await page.locator('#name').input_value()=='Browser agent';assert await page.locator('#result').inner_text()=='Clicked'
  # Mock only the provider transport inside the worker; browser tools and UI are real.
  await worker.evaluate("""async()=>{await chrome.storage.local.set({settings:{openaiKey:'test-only',mode:'ask',permissionPolicyVersion:2,provider:'openai'}});globalThis.fetch=async()=>{globalThis.testCalls=(globalThis.testCalls||0)+1;const first=globalThis.testCalls===1;const data=first?{choices:[{delta:{tool_calls:[{index:0,id:'call_test',function:{name:'get_page_text',arguments:'{}'}}]},finish_reason:'tool_calls'}]}:{choices:[{delta:{content:'The fixture page was read successfully.'},finish_reason:'stop'}]};return new Response('data: '+JSON.stringify(data)+'\\n\\n');};}""")
  panel=await context.new_page();panel.on('pageerror',lambda e:errors.append(str(e)));await panel.goto(f'chrome-extension://{eid}/sidepanel/index.html')
  await panel.locator('#prompt').fill('Read the current page');await worker.evaluate('id=>chrome.tabs.update(id,{active:true})',tabid);await panel.locator('#send').click()
  await panel.get_by_text('Approve get_page_text?',exact=True).wait_for()
  await panel.get_by_role('button',name='Approve once').click()
  await panel.get_by_text('The fixture page was read successfully.',exact=True).wait_for()
  await panel.locator('#status').filter(has_text='Done').wait_for()
  # UI was rendered without page errors.
  options=await context.new_page();await options.goto(f'chrome-extension://{eid}/options/index.html')
  await options.locator('[name=allowlist]').fill('example.com\n*.example.org');await options.get_by_role('button',name='Save settings').click();await options.get_by_text('Settings saved.',exact=True).wait_for()
  await options.locator('[name=blocklist]').fill('https://bad.example');await options.get_by_role('button',name='Save settings').click();await options.get_by_text('Invalid hostname: https://bad.example',exact=True).wait_for()
  assert not errors,errors
  print(json.dumps({'real_browser_tools':['read_page','get_accessibility_tree','form_input','click_element','take_screenshot','get_tabs_context'],'agent_loop':'mock OpenAI stream → approval UI → real page read → streamed answer','options':'save and invalid host rejection','page_errors':errors},indent=2))
  await context.close()
asyncio.run(main());server.shutdown()
