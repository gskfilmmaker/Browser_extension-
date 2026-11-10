# FramePilot

<picture><source media="(prefers-color-scheme: dark)" srcset="brand/logo-dark.png"><img src="brand/logo-light.png" alt="FramePilot — Developed by GSK Productions Inc." width="720"></picture>

**Your browser. In motion.**
Developed by **GSK Productions Inc.**

A dependency-free Manifest V3 Chrome extension with a persistent side panel, OpenAI and Anthropic streaming, browser tools, and automatic routine execution with critical-action confirmation. Load the source folder directly; no bundler, server, or npm install is required. Requires Chrome 120+.

## Setup

1. Download and extract this project to a permanent folder.
2. Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
3. Pin **FramePilot** in the extensions menu. Click its toolbar icon to open the side panel.
4. Open Settings with the gear icon. Create a provider API key at [OpenAI](https://platform.openai.com/api-keys) or [Anthropic Console](https://console.anthropic.com/). API billing is separate from ChatGPT or Claude subscriptions. Enter keys only in the extension's Settings page.
5. Select a provider and a model available to that account, then **Save settings**. Suggested IDs are editable; provider availability changes.
6. Open an ordinary HTTP(S) page. Ask, for example: “Read this page and summarize the key points.” Routine steps run automatically. If a critical or unrecognized action needs confirmation, review the target and arguments and choose **Approve once** or **Deny**.
7. Try “Fill the name field with Alex, but don't submit.” Approve the exact field input. Use **Stop** to cancel pending work. Use **New chat** to erase the current session conversation.

## Permissions and safety

Only permissions actually used are declared: `sidePanel`, `storage`, `scripting`, `debugger`, `tabs`, and HTTP(S) access through `<all_urls>`. `activeTab`, `tabGroups`, `webNavigation`, `offscreen`, and `unlimitedStorage` are intentionally omitted because this implementation does not need them. There is no persistent content script or offscreen document. Chrome debugger attachment displays Chrome's native debugging notice; the side panel status and toolbar badge identify active control.

- **Automatic · confirm critical actions** (default): reading, screenshots, listing tabs, navigation, scrolling, ordinary clicks and regular field edits run without repeated prompts. Detected sending, deletion, purchases, credential/account-security actions, non-search form submissions and uninspectable targets require approval. Drafting is separate from sending.
- **Ask before every action**: optional strict mode; all tools require approval, including reads and screenshots.
- **Automatic · trusted sites only**: the automatic policy applies only to allowlisted hostnames. Critical and unrecognized controls still require confirmation.
- Settings are captured at the start of a request; stop an active run before changing site policy. The blocklist takes precedence in every mode. Use `example.com` for one hostname and `*.example.com` for subdomains. There are no URL path rules. Navigation destinations and history targets are checked as well as current page URLs. Website redirects can still navigate a tab to a different site; subsequent tools check the resulting URL and reject blocked targets.
- Approval expires after two minutes and applies once. If the tab URL changes while approval is pending, the operation is rejected. The inspected target description is checked again immediately before execution. If it changed, the action is rejected and must be planned again. Web pages can still change during dispatch; this cannot make arbitrary websites race-free.
- Critical-action detection uses the actual target labels, field types, autocomplete metadata, form/dialog context, navigation targets and an agent-supplied flag that can only raise risk. The browser executor independently checks authorization. Password, file, and hidden inputs remain unsupported. Enter passwords manually. This is heuristic protection, not a guarantee: unusual, mislabeled, non-English, or malicious controls can evade classification. Automatic mode authorizes sending page context to your selected provider and executing routine interactions without per-step approval. Use strict mode for workflows where this tradeoff is unacceptable.
- Web content is treated as untrusted input in the system prompt. There is no arbitrary JavaScript or shell tool. Selectors and text are serialized into data literals rather than executable expressions.
- Keys live in `chrome.storage.local`, restricted to trusted extension contexts, never synchronized or exposed to page scripts or tool output. They are **not encrypted at rest**. An encryption key stored beside a secret would not protect against profile access. Delete stored keys from Settings or remove the extension. Use a dedicated Chrome profile for sensitive workflows.
- Conversation messages and completed tool results live in `chrome.storage.session` and clear when the browser session ends or the extension reloads. Screenshots are forwarded to the model for the active run but are not retained in conversation checkpoints. Tool output can contain personal information. Page text, accessibility names, console logs and screenshots cannot be fully redacted; approve only the data you want to transmit.
- Only the chosen provider receives requests. No telemetry, remote scripts, external backend, or third-party dependencies. No keys in source or chat output.

## Browser tools

| Tool | Behavior |
| --- | --- |
| `read_page` | Top-frame visible text and a compact DOM outline, up to 350 elements / 24,000 text characters |
| `get_page_text` | Top-frame visible text |
| `get_accessibility_tree` | Chrome accessibility roles, names, relationships, up to 500 non-ignored nodes |
| `take_screenshot` | JPEG viewport screenshot passed as a native image to the provider |
| `click_element` | CSS selector, exact visible text, or viewport coordinates; debugger mouse events |
| `type_text` | Debugger insertion into the focused editable field, without Enter |
| `form_input` | Focus a CSS-selected field, select existing text, insert replacement text |
| `navigate` | HTTP(S) URL, back, forward, reload |
| `scroll` | Debugger wheel events with pixel deltas |
| `read_console_messages` | Last 100 console events observed since debugger attachment |
| `get_tabs_context` | Policy-filtered tab IDs, titles, URLs, active states and window IDs |
| `switch_tab`, `create_tab`, `close_tab` | Tab management; switched/created tab becomes the agent's target |
| `wait_for_element`, `wait_for_load` | Bounded polling, maximum 15 seconds |

The target is captured at the start of each user request. Tools can specify a tab ID, and switching or creating tabs updates the target for later tools. DevTools or another extension may conflict with debugger attachment. Chrome-internal pages, Chrome Web Store pages, restricted tabs, PDFs, and browser UI may reject injection or debugging; use normal web pages. DOM selectors address the top frame and do not traverse iframes or shadow roots. Native selects, file uploads, browser dialogs, downloads, drag-and-drop, and CAPTCHA are not implemented. Coordinate clicks use CSS viewport pixels and can become stale after layout changes. The agent must read and verify its work.

## Architecture

- `manifest.json`: MV3 registration and restrictive extension-page CSP.
- `service-worker.js`: authoritative run ownership, bounded tool loop, approval workflow, cancellation, session checkpoints, and toolbar activity badge.
- `lib/providers.js`: native OpenAI Chat Completions function calling and Anthropic Messages tool use. Incremental SSE parsing handles fragmented UTF-8 and CRLF. Tool results use provider-specific roles; screenshots become native image content. Tool calls run serially.
- `lib/browser.js`: Chrome Debugger Protocol tools and on-demand isolated-world extraction.
- `lib/tools.js`: shared JSON schemas for both providers.
- `lib/policy.js`: site rules, critical-action approval policy, settings migration, argument checks, and safety prompt.
- `lib/action-risk.js` and `lib/inspect-action.js`: action classification and isolated-world target inspection without reading field values.
- `content/extract.js`: injected page extraction, with no long-lived page messaging bridge.
- `sidepanel/`: accessible vanilla JavaScript chat with incremental text, expandable tool results, approval cards, and stop control.
- `options/`: API keys, model IDs, site lists, and default limits.

Only one run executes at a time. Requests are spaced by at least three seconds. Each request has a ten-minute time limit and a default limit of 20 model rounds (configurable up to 40). Provider errors, incomplete streams, malformed tool arguments, and tool errors appear in the UI. HTTP 429 reports Retry-After if present. Requests are not automatically retried to avoid duplicate costs. A 20-second Chrome API heartbeat maintains active worker activity; unexpected service-worker termination never silently resumes actions. On restart, interrupted runs are marked interrupted and pending approvals are discarded. Stop aborts provider streaming and pending approval, and prevents subsequent tools; a Chrome command already dispatched can finish. A debugger attachment is detached at run completion or cancellation.

Conversation checkpoints preserve completed turns for follow-up requests within the browser session. Start a new chat when the conversation becomes large or if an API reports a context limit. Model costs and available context windows vary; the extension does not calculate billing or automatically summarize private data.

## Validation

Run with Node 20+:

```sh
npm run check
npm test
```

The unit suite checks permission policy, site boundaries, argument validation, fragmented SSE, both provider message formats and streamed tool inputs, incomplete streams, and HTTP failures. No API key is needed for these tests.

A Chromium integration harness is included at `tests/browser_test.py`. It requires Python Playwright and a local Chromium executable (`/usr/bin/chromium` by default); run `python tests/browser_test.py`. It launches the real unpacked extension with a local fixture and mocks only provider HTTP responses. It checks debugger input/clicks, text and accessibility extraction, screenshots, options validation, and the approval-to-tool-to-answer loop. It uses a temporary profile and never accesses your normal browser profile. Live provider requests require your keys and are not exercised by this suite.

## Release considerations

This is an unpacked extension implementation, not a Chrome Web Store submission. Before distributing to other users, perform a security review and a manual cross-site test matrix, publish a privacy policy, and verify the current Chrome Web Store debugger/host-permission requirements. API accounts, paid usage, authentication workflows, site changes and browser restrictions remain outside automated coverage.

### Results from this build environment

- JavaScript syntax checks and all 12 unit tests passed.
- Real Chromium CDP checks passed for text extraction, accessibility tree, field replacement, clicking, screenshots, scrolling and element waits.
- The actual service-worker module passed strict-mode approval checks and an automatic read/fill/click sequence with no routine prompts, followed by a gated Send action. Missing approvals and changed-target approvals were rejected, using Chrome API adapters backed by real CDP and mocked provider streams.
- Approval buttons remained inside the viewport at 320×480, 380×600 and 600×820 with long action details.
- Side panel rendering and options save/hostname validation passed with no page errors.
- Native unpacked loading was blocked by the environment's managed `ExtensionInstallBlocklist` policy. Native Chrome extension API wiring and live provider requests are not verified here. The policy was not changed.

The policy-compatible CDP/worker/UI test is included as `tests/cdp_test.py`; it uses Python Playwright and the system Chromium. Run `python tests/cdp_test.py`. Chrome API adapters in this test are explicitly separate from native extension integration.

## Branding and version 1.1.0

FramePilot is developed by GSK Productions Inc. The side panel, settings page, Chrome toolbar, manifest, and assistant identity use the FramePilot brand. Existing provider settings, API keys, and safety preferences retain their storage keys, so reloading the same unpacked extension folder keeps your configuration.

The complete [brand kit](brand/README.md) includes editable SVG masters, transparent and monochrome marks, PNG wordmarks, exact-size Chrome icons, promotional tiles, and a local brand preview. [Chrome Web Store preparation notes](CHROMEWEBSTORE.md) track listing copy and remaining submission requirements. Branding assets do not change page access, approvals, or provider behavior.

To update an existing local installation:

```sh
git pull origin main
```

Then open `chrome://extensions`, find the extension (formerly AI Browser Agent), and click **Reload**. Close and reopen the side panel. If you downloaded a ZIP instead, extract the updated source and reload your existing extension from the same folder.

To create a small runtime-only installation ZIP, run `python scripts/package.py` (or `npm run package`). The result is `dist/framepilot-1.2.0.zip`; extract it and select its folder in **Load unpacked**. No build step is needed to load the source directly.

## Version 1.2.0 — automatic routine browsing

On the first start after upgrading from version 1.1, settings migrate once to Automatic mode as requested by the product owner. Existing trusted-only mode and all site lists, credentials and model choices are preserved. A subsequent explicit choice of Ask before every action is retained on later restarts. Mode changes apply to the next request; stop an active task first.

Critical approval cards now have independently scrolling details and always-visible decision buttons. Denying or expiring an approval ends the run rather than allowing repeated attempts. If a new task starts while FramePilot's own Settings tab is active, the most recently accessed ordinary web tab in that window is selected; check tool targets when multiple tabs are open. No new Chrome permissions or provider destinations were added.
