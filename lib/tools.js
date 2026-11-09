const str={type:'string'}, num={type:'number'}, tabId={type:'integer',description:'Explicit target tab ID; defaults to the session target.'};
const def=(name,description,properties={},required=[])=>({name,description,parameters:{type:'object',properties:{tabId,...properties},required,additionalProperties:false}});
export const tools=[
 def('read_page','Read top-frame page text and a compact DOM outline. Password values are excluded.'),
 def('get_accessibility_tree','Read Chrome accessibility nodes for the current page.'),
 def('get_page_text','Read visible top-frame text.'),
 def('take_screenshot','Capture the viewport as an image for visual analysis. May include private information.'),
 def('click_element','Click a visible element using CSS selector, exact visible text, or viewport coordinates.',{selector:str,text:str,x:num,y:num}),
 def('type_text','Insert text at the focused editable element; does not press Enter.',{text:str},['text']),
 def('form_input','Focus a CSS-selected editable field and replace its value using keyboard input.',{selector:str,text:str},['selector','text']),
 def('navigate','Navigate to an HTTP(S) URL or use back, forward, reload.',{url:str,history:{type:'string',enum:['back','forward','reload']}}),
 def('scroll','Scroll the viewport by pixels.',{x:num,y:num}),
 def('read_console_messages','Read bounded console events collected since debugger attachment.'),
 def('get_tabs_context','List open HTTP(S) tabs allowed by site policy.'),
 def('switch_tab','Activate a tab.',{},['tabId']),
 def('create_tab','Create and target an HTTP(S) tab.',{url:str},['url']),
 def('close_tab','Close a tab.',{},['tabId']),
 def('wait_for_element','Wait up to 15 seconds for a visible CSS-selected element.',{selector:str,timeout:num},['selector']),
 def('wait_for_load','Wait up to 15 seconds for document readyState complete.',{timeout:num})];
