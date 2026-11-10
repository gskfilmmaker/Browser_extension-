# FramePilot 1.3 personal acceptance tests

This release has passed controlled Chromium/CDP tests, including a mocked-provider email loop. It has not been verified in your authenticated Gmail/Outlook accounts. Use this checklist on your Mac before trusting important workflows. Start with a test account, test messages, and a recipient you control.

## Activate the update

```sh
cd ~/Downloads/FramePilot
git pull origin main
open -a "Google Chrome" "chrome://extensions/"
```

Reload FramePilot, check version 1.3.0, reopen the side panel, and review any Chrome permission changes. Keep Automatic mode for routine steps. Your API key should remain saved. Test with a normal web tab active. Chrome-internal pages are not supported. Close other debugging tools if debugger attachment fails.

## Test matrix

| Test | Suggested instruction | Expected result |
| --- | --- | --- |
| Page read | Read this page and summarize it. | Real read tools run; summary reflects the page. |
| Search | Search this site for [term], then summarize the results. | Types, submits with keyboard or button, and reads results. |
| Forms | Fill [test form] but do not submit. | Values match your instruction; no final submission. |
| Tabs | Compare these two open pages and cite the differences. | Correct tab IDs/URLs used; no unintended tabs closed. |
| Gmail read | Find my latest test message from [your address]. Do not send or delete. | Correct thread and account; no send action. |
| Gmail draft | Reply with “This is a FramePilot test.” Stop before sending. | Correct thread, recipient and draft content visible in Gmail. |
| Gmail send | Send that test reply after showing me the completed email. | Content-aware approval appears; inspect it and the page. One send after approval; verify Sent yourself. |
| Outlook web | Repeat the same read, draft, then reviewed-send tests. | Correct account, recipient and message. If extraction fails, stop and report the error. |
| Rich text | Draft a multi-paragraph email without sending. | Paragraphs remain editable; no send shortcut used. |
| File upload | Select a harmless file using Files, then ask the agent to attach it to your test draft. | File metadata is visible locally; upload asks for approval; filename appears on the website after processing. |
| Download | Download a harmless file from [trusted test URL] and check completion. | Approval appears; download status says complete. File is never automatically run. |
| Changed draft | While send approval is open, change the email body on the website, then approve. | The original approval is rejected; no send until fresh review. |
| Denial | Deny a critical action. | Task ends; the action is not repeated. |
| Stop | Stop during a routine multi-step task. | No new tools are dispatched after stopping; an already-dispatched action may finish. |
| Continue | After stopping, choose Continue task. | The page is re-inspected; completed actions are not blindly replayed. |

After a send, check Sent and the recipient mailbox. FramePilot's website confirmation is not proof of recipient delivery. If the result is uncertain, do **not** ask it to send again; inspect Sent manually first. Attempt records are session-scoped and disappear after browser exit or extension reload.

## Report a failure

Record extension version, browser version, provider/model, tool name, exact error, and a sanitized screenshot. Do not include API keys, passwords, private message contents, or client details. A disabled Send control, ambiguous composer, unrecognized recipient chips, reply subject not exposed in the page, or attachment still processing should lead to a blocker or warning rather than an invented success.

Universal site compatibility, native desktop control, CAPTCHA, OS file dialogs, scheduled workflows and service-specific OAuth connectors are outside this release. Document a workflow as verified only after it actually passes on the relevant site/account.
