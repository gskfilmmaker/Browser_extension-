# Chrome Web Store Listing — FramePilot

> Last Updated: 2026-11-10
> Version 1.3.0 · Draft, not submitted or published.

## Store Listing

**Extension Name:** FramePilot

**Short Description:** Your AI browser copilot: read pages, navigate tabs, and complete tasks with you in control. Developed by GSK Productions Inc.

**Detailed Description:**

FramePilot helps you read web pages, work across tabs, and complete browser tasks from a persistent side chat.

Ask questions about a page, summarize text, inspect what is on screen, navigate websites, and fill supported form fields. Choose OpenAI or Anthropic as your AI provider. Routine browsing and drafting run automatically. Detected critical actions and unrecognized controls require confirmation, and you can stop the agent at any time. Detection is heuristic; optional strict mode asks before every tool.

Install FramePilot, open the toolbar icon, and configure your provider key in Settings. Provider access and usage charges are separate from FramePilot. Start with a simple page summary, then review the exact target and arguments before approving actions.

FramePilot stores provider keys locally in your Chrome profile. Page text, screenshots, accessibility information, tab details, and requested tool results may be sent to the selected provider to complete your task. Choose trusted and blocked sites in Settings. There is no telemetry or developer-operated server. Optional user-selected attachments remain local until an approved upload; uploads send them to the chosen website.

Your browser. In motion.
Developed by GSK Productions Inc.

Support: https://github.com/gskfilmmaker/Browser_extension-/issues

**Category:** Productivity

**Single Purpose:** Assist users with reading web pages and completing explicitly requested browser workflows, including forms and reviewed email submission.

**Primary Language:** English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
| --- | --- | --- | --- |
| Store icon | 128×128 PNG | Created | `icons/icon-128.png` |
| Chrome icons | 16, 32, 48px PNG | Created | `icons/icon-*.png` |
| Required screenshot | 1280×800 or 640×400 | Pending native installed-extension capture | Not yet created |
| Email review preview | 380×820 PNG | Controlled-fixture preview; not a store screenshot | `brand/email-review-preview.png` |
| UI preview | 380×820 PNG | Updated for 1.3 Files UI; generated with a test adapter; not a store screenshot | `brand/ui-preview.png` |
| Small promo tile | 440×280 PNG | Created; review before submission | `brand/promo-small.png` |
| Marquee promo tile | 1400×560 PNG | Created; review before submission | `brand/promo-marquee.png` |
| Logo masters and exports | SVG, PNG | Created | `brand/logo-light.*`, `brand/logo-dark.*` |

Capture a native installed FramePilot summary and approval card for the required store screenshots. Do not submit the test-runtime UI preview as evidence of native extension operation. The bundled cinematic artwork is supplemental; use the exact-size promo assets for listing fields.

## Permissions Justification

| Permission | Type | Justification |
| --- | --- | --- |
| `sidePanel` | permissions | Keeps the user's conversation and approval controls beside the page while browsing. |
| `storage` | permissions | Saves the user's provider credentials, preferences, and temporary conversation checkpoints. |
| `scripting` | permissions | Reads page text and a compact element outline when a user-requested task needs page context. |
| `debugger` | permissions | Captures the visible page and accessibility information and performs approved mouse and keyboard actions. |
| `tabs` | permissions | Shows tab titles and URLs, identifies the target, and opens, switches, navigates or closes tabs for approved tasks. |
| `webNavigation` | permissions | Identifies embedded frame IDs and parent frames so requested input is directed to the correct document and site restrictions apply to frame ancestry. |
| `downloads` | permissions | Initiates downloads the user requested after approval, and verifies completion without automatically opening or executing files. |
| `<all_urls>` | host_permissions | Supports user-directed tasks across arbitrary websites rather than a fixed site. HTTP(S) access is constrained by FramePilot's allowlist, blocklist, approval mode, and rejection of privileged URLs. |

Version 1.3 adds webNavigation and downloads for the features listed above. No remotely hosted code is executed.

## Privacy & Data Use

**Does the extension collect/process user data?** Yes. It stores settings locally and sends task context directly to the user's selected provider. GSK Productions Inc. does not receive that data through a developer-operated server in this implementation.

| Data Type | Processed? | Transmitted off-device? | Purpose / recipients |
| --- | --- | --- | --- |
| Personally identifiable information | May appear in page/task content | If included in requested context | Task execution by selected provider |
| Health information | May appear in page/task content | If included in requested context | Task execution by selected provider |
| Financial information | May appear in page/task content | If included in requested context | Task execution by selected provider |
| Authentication information | Provider keys stored locally; password inputs refused | Provider key sent only to its provider for authentication; page tokens could appear in context | Authenticate provider requests |
| Personal communications | May appear in page/task content | If included in requested context | Task execution by selected provider |
| Location | May appear in page/task content; no geolocation permission | If included in requested context | Task execution by selected provider |
| Web history | Open tab titles/URLs, page URLs, requested navigation context; no history collection service | When requested as task context | Multi-tab assistance by selected provider |
| User activity | Chat prompts, task progress, tool actions/results, screenshots and session send-attempt records | As task context | Carry out user requests |
| Website content | Text, DOM outline, accessibility names, screenshots, console output and email drafts | As task context | Understand and act on pages |
| User-selected files | Stored in local IndexedDB; names/sizes can enter task context | Bytes only on approved website upload; metadata to selected AI provider | Attach documents the user selected to the requested workflow |

### Data Use Certification

Implementation audit: no sale of data, advertising, unrelated data use, or creditworthiness/lending processing. The publisher must verify the final disclosure form and provider terms before certifying the submission.

- [ ] Publisher certification that data is not sold to third parties.
- [ ] Publisher certification that data is not used for unrelated purposes.
- [ ] Publisher certification that data is not used for creditworthiness or lending.

## Privacy Policy

**Public Privacy Policy URL:** Required before submission. No public policy has been published as part of this release. It must accurately cover local credentials, session data, provider transmission, screenshots, incidental sensitive page content, deletion, and support contact.

## Distribution

**Visibility / regions:** Publisher decision required before submission. Repository is public; the extension is currently loaded unpacked.

## Developer Info

**Publisher Name:** GSK Productions Inc.

The store developer account's displayed publisher identity is configured in the Chrome Developer Dashboard; the manifest author field does not verify a company identity or configure that account.

**Contact Email:** Required from GSK Productions Inc. before submission; not supplied.

**Support URL:** https://github.com/gskfilmmaker/Browser_extension-/issues

**Project URL:** https://github.com/gskfilmmaker/Browser_extension-

## Version History

| Version | Date | Changes | Status |
| --- | --- | --- | --- |
| 1.3.0 | 2026-11-10 | Expanded input, snapshot references, frames, selected files, downloads, task progress/continuation, reviewed email with attempt ledger and fresh confirmation. | Draft |
| 1.2.0 | 2026-11-10 | Automatic routine browsing; critical-action detection and revalidation; visible approval buttons; one-time settings migration. | Draft |
| 1.1.0 | 2026-11-10 | FramePilot identity, GSK Productions Inc. attribution, vector logo kit, Chrome icons, updated UI and promotional assets. | Draft |
| 1.0.0 | 2026-11-09 | Initial AI Browser Agent implementation with two providers, page tools and approvals. | Unpacked development build |

## Review Notes

Native unpacked extension loading is blocked by the development environment's managed Chrome policy. Syntax and provider/policy unit tests and a CDP-backed tool/worker/UI test are available; live provider calls and native extension integration still require verification on the publisher's computer. Password entry, CAPTCHA, browser/OS dialogs, closed shadow roots and native desktop apps are not supported. Frame and upload restrictions are documented in README. Email composer support is heuristic and has not been validated in live Gmail/Outlook accounts. Automatic mode is the default and executes routine page reads and interactions without per-step confirmation. Critical and unrecognized targets require approval; strict mode remains available. Labels and form context are heuristic evidence, not a guarantee. Version 1.3 adds frame inspection and downloads permissions. User-selected files are stored in local IndexedDB (10 MB/file, 25 MB total) until removed or uninstalled, and are sent to a target website only on approved upload. Draft emails are sent as task context to the AI provider and shown locally for review. Content-keyed send attempts and download IDs are retained in session storage. Default automatic reads mean page context can be transmitted without a separate per-read dialog; disclose all of this in the public policy and onboarding. Existing installs migrate once to Automatic mode, preserving trusted-only restrictions and credentials.

Before submission: verify native installation and live provider calls; capture correctly sized screenshots; publish an accurate privacy policy; supply a support email; verify publisher identity and name availability; complete the store disclosure form. `python scripts/package.py` creates a runtime-only ZIP excluding `.git`, tests, artwork, scripts, and this listing document.
