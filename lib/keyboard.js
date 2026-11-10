/** Normalize a bounded set of renderer keyboard events; Primary is Command on Mac. */
export function keyEvent(combo, os='linux') {
  if(typeof combo!=='string')throw Error('key must be a string.');
  const parts=combo.split('+');let key=parts.pop(),modifiers=0;
  for(const part of parts){const p=part.toLowerCase();const bit={shift:8,alt:1,ctrl:2,control:2,meta:4,cmd:4,command:4,primary:os==='mac'?4:2}[p];if(!bit)throw Error('Unknown key modifier.');modifiers|=bit;}
  const named={Enter:[13,'Enter'],Return:[13,'Enter'],Escape:[27,'Escape'],Esc:[27,'Escape'],Tab:[9,'Tab'],Space:[32,'Space'],Backspace:[8,'Backspace'],Delete:[46,'Delete'],ArrowLeft:[37,'ArrowLeft'],ArrowUp:[38,'ArrowUp'],ArrowRight:[39,'ArrowRight'],ArrowDown:[40,'ArrowDown'],Home:[36,'Home'],End:[35,'End'],PageUp:[33,'PageUp'],PageDown:[34,'PageDown']};
  let windowsVirtualKeyCode,code;
  if(named[key]){[windowsVirtualKeyCode,code]=named[key];key=code==='Space'?' ':code;}
  else if(/^[a-z]$/i.test(key)){windowsVirtualKeyCode=key.toUpperCase().charCodeAt(0);code='Key'+key.toUpperCase();if(!(modifiers&6))throw Error('Use type_text for letters; press_key letters require Control or Command.');}
  else throw Error('Unsupported key. Use named keys such as Enter, Tab, Escape, ArrowDown, or Primary+A.');
  // Renderer events must not be used as a hidden route around send review or browser controls.
  if((modifiers&6)&&key==='Enter')throw Error('Send/submit shortcuts are disabled. Use send_email or the visible submit control.');
  return {key,code,windowsVirtualKeyCode,modifiers};
}
