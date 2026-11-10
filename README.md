# FramePilot

<picture><source media="(prefers-color-scheme: dark)" srcset="brand/logo-dark.png"><img src="brand/logo-light.png" alt="FramePilot — Developed by GSK Productions Inc." width="720"></picture>

**Your browser. In motion.**

Developed by **GSK Productions Inc.**

FramePilot is a Manifest V3 browser agent with a persistent side panel, streaming OpenAI/Anthropic support, automatic routine interactions, and confirmation for detected critical actions. Version 1.3 expands the execution engine with keyboard controls, element references, frames, richer forms, selected-file attachments, downloads, task progress, and reviewed email submission.

This is a development release. Controlled Chromium tests cover the engine and a complete email-composer workflow. Live Gmail/Outlook accounts, live provider requests, and native extension integration require validation on your computer. It does not promise compatibility with every website or parity with another commercial browser agent.

## Install on your Mac

```sh
cd ~/Downloads
git clone https://github.com/gskfilmmaker/Browser_extension-.git FramePilot
open -a "Google Chrome" "chrome://extensions/"
```

Enable **Developer mode**, click **Load unpacked**, and select `Downloads/FramePilot`, the folder containing `manifest.json`. Pin FramePilot, open it, then choose **Settings**. Enter your OpenAI or Anthropic API key, choose the matching provider and an available model, and save. Provider billing is separate from chat subscriptions. Never put API keys in Git, email drafts, screenshots, or prompts.

There are no runtime dependencies and no build step.

## Update an existing installation

```sh
cd ~/Downloads/FramePilot
git pull origin main
```

Open `chrome://extensions`, click **Reload** on FramePilot, and close/reopen its side panel. Version **1.3.0** adds `webNavigation` for frame ancestry and `downloads` for requested file downloads; Chrome may show updated permission information. Keys, model choices, and your selected permission mode keep their existing storage keys. A fresh installation defaults to automatic mode; the one-time 1.2 migration is not repeated on already-migrated settings.

## First tasks to try

Start on a normal HTTP(S) page, not a Chrome-internal page:

- “Read this page and summarize it. Perform the reading yourself.”
- “Fill this form with the following information, but stop before submitting.”
- “Find the latest email from [sender] and summarize the conversation. Do not send or delete anything.”
- “Draft a reply to [recipient] saying [message]. Show me the actual email for approval before sending.”

For email testing, use an account and recipient you control first. Check the correct account, recipients, subject, body, links, and attachments on the actual website as well as in the review. If FramePilot cannot identify the composer or recipients, it should stop rather than invent them. The email inspector recognizes common Gmail/Outlook-style composer attributes and standard labeled forms; it is not a verified universal email adapter. Reply subjects, aliases, custom attachment chips, localized controls, or a changed website layout may need manual verification or fail extraction.

The agent is instructed to execute tasks rather than give tutorials, read state after meaningful changes, use a short task checklist, and stop after repeated identical failures. **Continue task** starts a new bounded run using prior checkpoints and re-inspects the page; it does not automatically replay an interrupted action. If a message may have been sent, check Sent before doing anything else.

## Permissions and autonomy

- **Automatic · confirm critical actions:** routine reads, screenshots, searching, navigation, ordinary clicks, and drafting run automatically. Detected sending, deletion, purchases, account/security changes, sensitive fields, non-search form submissions, ambiguous controls, uploads, and downloads require confirmation.
- **Ask before every action:** every tool requires approval.
- **Automatic · trusted sites only:** the automatic policy is restricted to the allowlist.

Blocked sites take precedence. Rules accept exact hostnames or `*.example.com` for subdomains (not the apex). Settings are captured at the start of a task; stop before changing access rules. Redirects can move a tab elsewhere; subsequent operations check the resulting URL. Frame ancestors must also pass policy.

Critical detection combines actual DOM labels, types, context, and an agent flag that can only raise risk. This is heuristic, not a trained or foolproof safety classifier: unusual, mislabeled, non-English, or malicious controls can evade it. Do not equate fewer prompts with guaranteed safety. Web pages and emails are untrusted data, never instructions. There is no arbitrary model-authored JavaScript or shell tool. All page code is bundled and fixed.

Approval expires after two minutes. The inspected target and reviewed email are checked again before execution. A changed target invalidates approval. Denial ends the task. A webpage can still change during dispatch; these checks cannot make arbitrary websites race-free.

The toolbar badge, side panel status, and Chrome's native debugger notice indicate control. Stop aborts streaming and pending approval and prevents subsequent tools; an action already dispatched can finish. Password entry, CAPTCHA, OS dialogs, and native desktop applications require manual handling. Keyboard send shortcuts are blocked; email should use `send_email` for content-aware review.

## Browser tools

| Tool | Behavior |
| --- | --- |
| `read_page` / `get_page_text` | Visible text and up to 500 elements, with per-document `elementRef` identifiers and open-shadow-root traversal; text capped at 30,000 characters |
| `get_accessibility_tree` | Bounded Chrome accessibility snapshot; use frame-specific `read_page` for actionable references |
| `get_frames` | Policy-filtered Chrome frame IDs and ancestry |
| `take_screenshot` | JPEG of the tab viewport, supplied as a native image to the model |
| `click_element` | Single/double left click or right click by reference, role/name, CSS, exact label, or coordinates |
| `hover_element` / `drag_element` | Pointer movement and bounded drag sequence |
| `form_input` / `type_text` | Replace a targeted field or insert at focus; supports ordinary rich-text editors and verifies replacement value |
| `press_key` | Enter, Tab, Escape, arrows, navigation keys and bounded modifier shortcuts; `Primary+A` maps to Command on Mac / Control elsewhere |
| `select_option` / `set_checked` | Native selects, checkboxes and radios with resulting-state checks |
| `get_element_value` | Read back a field value/selection; password/hidden/file inputs are redacted |
| `navigate` / `scroll` | URL/history/reload and viewport or element scrolling |
| `get_tabs_context` / `switch_tab` / `create_tab` / `close_tab` | Multi-tab context and explicit task target management |
| `wait_for_element` / `wait_for_load` | Bounded waits, up to 15 seconds |
| `read_console_messages` | Last 100 observed console events since debugger attachment |
| `inspect_email_draft` / `send_email` | Real composer review, critical approval, send-attempt ledger, and fresh website-status verification |
| `list_files` / `attach_files` | Metadata for user-selected files and approved assignment to an upload input |
| `download_file` / `get_download_status` | Approved HTTP(S) download and inspection of extension-initiated download state; no file execution |
| `update_task` | A visible task checklist, with completion based on observed results |

Prefer fresh element references. Detached elements and ambiguous selectors fail instead of silently choosing the first match. Frame-specific operations use `frameId`; mouse translation uses frame ancestry and viewport geometry. Identical iframe URLs, redirects that hide the owner, rotated frames, sandbox restrictions, privileged/about frames, and closed shadow roots may be unsupported and should fail safely. Custom drag-and-drop implementations may not accept the pointer sequence. Native right-click menus and browser chrome remain outside DOM control.

## Email submission safeguards

The review is extracted from the composer, not supplied by the model. It includes recipients, subject, body, visible attachments and links, and account/alias warnings. Body markup is hashed so changing a link or formatting can invalidate approval even if visible text is unchanged. Email review requires a secure page context. Unknown recipients or composers produce errors rather than a blind send. Raw recognized Send clicks in Gmail/Outlook are routed through the same reviewed path.

Before dispatch, FramePilot records a content-keyed attempt in `chrome.storage.session`. Repeating the same submission during that session is rejected. A fresh mutation in a visible sent-status message is required to report **submission-confirmed**. A stale toast does not count. Missing evidence produces **uncertain**, not success; the agent is instructed to inspect Sent and never retry blindly. This is a session-level guard, not an exactly-once delivery guarantee, and a browser restart clears it. Recipient delivery is not established by a website's sent confirmation. No Gmail or Microsoft Graph OAuth integration is included in this release.

## Selected files and downloads

Click **Files** in the chat composer and select files explicitly. They are stored only in the extension's local IndexedDB; the model receives file metadata, not bytes. Each file is limited to 10 MB and the vault to 25 MB total. The model can upload only these IDs, and upload requires approval. Remove files with **Remove**. They persist across browser restarts until removed or the extension is uninstalled; **New chat** does not delete files. They are not encrypted by FramePilot.

File assignment uses standard upload inputs and events. A website may reject it or still be processing; inspect the website's attachment state before submitting. The extension cannot browse arbitrary disk paths or choose files from an OS dialog for you. Downloads use Chrome's download API, retain normal Chrome security checks, and are not automatically opened. Only extension-initiated download IDs are exposed through the status tool.

## Data and storage

Provider keys are in `chrome.storage.local`, restricted to trusted extension contexts, never synced or included in prompts. They are not encrypted at rest. Conversation checkpoints, UI state, send-attempt records and download IDs are in session storage and clear on browser exit/extension reload. Screenshot bytes are not retained in checkpoints. Selected files use local IndexedDB as described above.

Page text, screenshots, accessibility names, task prompts, email drafts, selected-file metadata and requested tool results can be sent to the chosen provider. Limited text redaction recognizes some OpenAI/Anthropic-style keys and Bearer tokens, but cannot guarantee sensitive-data removal and does not redact screenshots. There is no developer-operated server, telemetry, remotely loaded code, or analytics.

## Architecture

- `service-worker.js`: sole task runner, provider loop, approvals, cancellation, checkpoints, progress and bounded failure recovery.
- `lib/providers.js`: native OpenAI Chat Completions / Anthropic Messages streaming, shared custom tools, provider-specific image and tool-result formats.
- `lib/browser.js`: Chrome API and CDP transport, frame mapping, authorization revalidation, email attempt ledger, downloads and input tools.
- `lib/page.js`: one isolated-world resolver for DOM snapshots, stable references, open shadow roots and fixed page operations.
- `lib/mail.js`: composer inspection and content fingerprints.
- `lib/keyboard.js`: bounded platform-aware keyboard event normalization.
- `lib/files.js`: explicitly selected local file vault.
- `lib/policy.js`, `lib/action-risk.js`, `lib/tools.js`: validation, permissions, classification and tool schemas.
- `sidepanel/`, `options/`, `ui.css`: local interface; no build required.

One run executes at a time; requests are spaced by three seconds. Fresh settings default to 35 model rounds, configurable up to 40; saved limits are preserved. Runs are limited to ten minutes. Provider errors and incomplete streams are reported, not silently retried. HTTP 429 exposes Retry-After when supplied. Three identical tool failures stop the run. Browser worker termination requires explicit user continuation; critical operations never resume unattended. Debugger attachment is detached when a run ends. Other debugging extensions or DevTools can conflict.

## Validation

Node 20+:

```sh
npm run check
npm test
```

Browser integration tests require Python Playwright and a Chromium executable:

```sh
python tests/cdp_test.py
python tests/advanced_test.py
python tests/browser_test.py
```

Tests default to `/usr/bin/chromium`. Override on a Mac, for example:

```sh
FRAMEPILOT_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" python tests/advanced_test.py
```

See [TESTING.md](TESTING.md) for personal Gmail/Outlook acceptance tests.

The CDP suites use explicit Chrome API adapters backed by a real controlled browser and mocked provider transport. They never use your normal profile or send actual email. Coverage includes strict/automatic worker runs, small-panel approval layout, selected-file uploads, shadow DOM, embedded frames, native controls, keyboard input, stale-target rejection, content-change approval rejection, reviewed submission, duplicate prevention and uncertainty handling. Native unpacked loading remains blocked by this development environment's managed extension policy. No live provider requests or authenticated Gmail/Outlook sessions were tested here.

## Packaging, branding, and remaining scope

`python scripts/package.py` creates `dist/framepilot-1.3.0.zip` containing only runtime files. Extract it before using **Load unpacked**. The [brand kit](brand/README.md) includes vector masters, PNG icons and promotional assets; `python scripts/render-brand.py` regenerates vector exports. [Chrome Web Store notes](CHROMEWEBSTORE.md) track submission requirements.

Scheduling, recorded/reusable workflows, desktop companion control, vendor-native browser toolsets, Gmail/Graph connectors, subscription billing, unrestricted local files and guaranteed universal website support are not included. These are subsequent projects, not hidden features. Before broad distribution, verify native installation and live accounts, review security, publish an accurate privacy policy, capture authentic store screenshots, and complete publisher details.
