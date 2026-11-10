/** DOM evidence can raise risk; a model-supplied critical flag can never lower it. */
const critical = /\b(delete|trash|discard|remove|erase|destroy|send|publish|post|share|invite|purchase|checkout|subscribe|unsubscribe|transfer|withdraw|revoke|authorize|grant)\b|\b(pay|buy|order)\s+(now|order|payment)|\b(place order|complete payment|confirm payment|change password|reset password|save password|change email|close account|cancel subscription|sign in|log in|sign out|log out)\b/i;
const sensitive = /password|passkey|security|privacy|account.settings|two.factor|\b2fa\b|security key|credit.card|card.number|\bcvv\b|\bcvc\b|bank.account|routing.number|social.security|\bssn\b|api.?key|secret|access.?token|recovery.code|one.time.code|verification.code|payment|billing|permission|account deletion/i;
const generic = /^(continue|confirm|yes|ok|okay|submit|save|update|done|apply|allow|accept|next)(\b|$)/i;
const destructiveURL = /(?:\/|[?&])(?:delete|remove|destroy|logout|signout|unsubscribe|purchase|pay|transfer)(?:[/?=&]|$)/i;
const decision = (level, reason) => ({level, reason});
export function classifyAction(name, args = {}, evidence = null) {
  if (args.critical === true) return decision('critical', 'The requested action is marked sensitive by the agent.');
  if (['navigate', 'create_tab'].includes(name) && destructiveURL.test(args.url || '')) return decision('critical', 'The destination may perform a destructive, financial, or account action.');
  if (!['click_element', 'type_text', 'form_input'].includes(name)) return decision('routine', 'Routine browser operation.');
  if (!evidence?.found) return decision('unknown', 'The target could not be inspected reliably.');
  const label = [evidence.label, evidence.title, evidence.name, evidence.id].filter(Boolean).join(' ');
  if (['type_text', 'form_input'].includes(name)) {
    // Search text may contain sensitive words; it is not a credential field.
    if (evidence.type === 'search' || evidence.role === 'searchbox') return decision('routine', 'Search field input.');
    if (evidence.type === 'password' || sensitive.test(label + ' ' + evidence.autocomplete)) return decision('critical', 'This field may contain credentials, payment information, or account-security data.');
    return decision('routine', 'Drafting or editing a regular field; this does not submit it.');
  }
  if (evidence.crossFrame) return decision('unknown', 'An embedded-frame target cannot be inspected reliably.');
  if (evidence.type === 'password' || sensitive.test(label) || critical.test(label) || destructiveURL.test(evidence.href || '')) return decision('critical', 'This control may send, delete, purchase, share, authenticate, or change account settings.');
  if ((evidence.role==='switch'||['checkbox','radio'].includes(evidence.type)) && sensitive.test(evidence.context||'')) return decision('critical','This control changes a sensitive account or payment setting.');
  if ((generic.test(label.trim()) || evidence.submit) && (sensitive.test(evidence.context || '') || critical.test(evidence.context || ''))) return decision('critical', 'This confirmation belongs to a sensitive form or dialog.');
  if (evidence.submit && !evidence.search) return decision('critical', 'Submitting a non-search form can send information or commit a change.');
  if (!label.trim() && !evidence.href) return decision('unknown', 'This unlabeled control has no reliable action description.');
  return decision('routine', 'Ordinary page interaction.');
}
