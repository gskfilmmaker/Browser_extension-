/** Runs in Chrome's isolated scripting world. Never reads field values. */
export function inspectElement(args, tool) {
  let element;
  if (args.selector) element = document.querySelector(args.selector);
  else if (tool === 'type_text') element = document.activeElement;
  else if (args.text) element = [...document.querySelectorAll('a,button,input,[role="button"],label')].find(e => (e.innerText || e.getAttribute('aria-label') || '').trim() === args.text);
  else element = document.elementFromPoint(args.x, args.y);
  if (!element) return {found: false};
  const e = tool === 'click_element' ? element.closest('a,button,input,[role="button"],[role="menuitem"],[role="tab"],[role="switch"]') || element : element;
  const form = e.closest('form');
  const dialog = e.closest('[role="dialog"],dialog,[role="alertdialog"]');
  const search = !!e.closest('[role="search"]') || form?.getAttribute('role') === 'search' || !!form?.querySelector('input[type="search"],[role="searchbox"],input[name="q"],input[name="search"]');
  const labelled = (e.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.innerText || '').join(' ');
  return {
    found: true, tag: e.tagName, type: e.type || '', role: e.getAttribute('role') || '',
    label: (e.getAttribute('aria-label') || labelled || e.labels?.[0]?.innerText || e.innerText || e.getAttribute('placeholder') || '').slice(0,300),
    title: (e.getAttribute('title') || '').slice(0,200), name: e.getAttribute('name') || '', id: e.id || '',
    autocomplete: e.getAttribute('autocomplete') || '', href: e.closest('a')?.href || '',
    submit: !!form && (e.type === 'submit' || e.type === 'image'), search,
    crossFrame: e.tagName === 'IFRAME' || e.tagName === 'FRAME',
    context: (dialog?.innerText || form?.innerText || '').slice(0,1600),
  };
}
