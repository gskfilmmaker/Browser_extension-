const str={type:'string'},num={type:'number'};
const target={tabId:{type:'integer',description:'Target tab ID; defaults to task tab.'},frameId:{type:'integer',description:'Chrome frame ID from get_frames; defaults to top frame.'}};
const locator={elementRef:{type:'string',description:'Preferred: exact reference from the latest read_page. Stale references require a fresh read.'},selector:str,role:str,name:{type:'string',description:'Exact accessible name when role is provided.'},targetText:{type:'string',description:'Exact target label; use elementRef when labels repeat.'}};
const def=(name,description,properties={},required=[])=>({name,description,parameters:{type:'object',properties:{...target,critical:{type:'boolean',description:'Set true for sensitive commitments. This only raises risk; false never bypasses checks.'},...properties},required,additionalProperties:false}});
export const tools=[
 def('read_page','Read this frame, visible text, open shadow DOM, interactive elements and stable elementRefs.'),
 def('get_accessibility_tree','Read Chrome accessibility roles and names.'),
 def('get_page_text','Read page text.'),
 def('get_frames','List embedded frames and Chrome frameIds. Read and act with frameId.'),
 def('take_screenshot','Capture the tab viewport as an image. Coordinates refer to the top-frame viewport.'),
 def('click_element','Click a unique target; default single left click. Read the result after acting.',{...locator,text:str,x:num,y:num,button:{type:'string',enum:['left','right']},clickCount:{type:'integer',enum:[1,2]}}),
 def('hover_element','Move the pointer to reveal menus or tooltips.',locator),
 def('drag_element','Drag one target to another. Read the resulting page state.',{...locator,toElementRef:str,toSelector:str}),
 def('type_text','Insert text in the focused editable field without submitting.',{text:str},['text']),
 def('form_input','Replace a targeted editable field, including a rich-text message body.',{...locator,text:str},['text']),
 def('press_key','Press Enter, Escape, Tab, arrows, Home/End, PageUp/Down, or shortcuts such as Primary+A. Send shortcuts are prohibited; use send_email.',{key:str,...locator},['key']),
 def('select_option','Choose an option in a native select. For custom dropdowns use click and arrow keys.',{...locator,value:str,option:str}),
 def('set_checked','Set a checkbox or radio to the requested state.',{...locator,checked:{type:'boolean'}},['checked']),
 def('get_element_value','Read a field value/selection to verify input; password values are never returned.',locator),
 def('navigate','Navigate to HTTP(S) or use history.',{url:str,history:{type:'string',enum:['back','forward','reload']}}),
 def('scroll','Scroll the page by pixels; supply a locator to scroll an inner panel.',{...locator,x:num,y:num}),
 def('read_console_messages','Read console events collected since debugger attachment.'),
 def('get_tabs_context','List permitted tabs and identify the correct account/site before acting.'),
 def('switch_tab','Switch task target to a tab.',{},['tabId']),
 def('create_tab','Create and target an HTTP(S) tab.',{url:str},['url']),
 def('close_tab','Close a tab.',{},['tabId']),
 def('wait_for_element','Wait up to 15 seconds for a unique visible target.',{...locator,timeout:num}),
 def('wait_for_load','Wait up to 15 seconds for document readyState complete.',{timeout:num}),
 def('inspect_email_draft','Read actual recipients, subject, body and visible attachment names from one composer. Use a composer/send selector or send elementRef. Does not send.',locator),
 def('send_email','Send the inspected email only after the extension displays its actual contents for approval. Records the attempt and never automatically retries an uncertain send.',locator),
 def('list_files','List files the user explicitly selected in the side panel. Returns metadata, never contents.'),
 def('attach_files','Upload selected file IDs to a file input after approval. Only user-selected files are accessible.',{...locator,fileIds:{type:'array',items:str,minItems:1,maxItems:10}},['fileIds']),
 def('download_file','Download an HTTP(S) file after approval and monitor completion. Never runs downloaded files.',{url:str},['url']),
 def('get_download_status','Check an extension-initiated download.',{downloadId:{type:'integer'}},['downloadId']),
 def('update_task','Show a short plan/progress checklist. Mark completed only when evidence verifies the outcome.',{steps:{type:'array',items:{type:'object',properties:{text:str,status:{type:'string',enum:['pending','working','done','blocked']}},required:['text','status'],additionalProperties:false},maxItems:12}},['steps'])
];
