# FramePilot 1.4.1 personal acceptance tests

This release has passed controlled Chromium/CDP tests, including a mocked-provider email loop. It has not been verified in your authenticated Gmail/Outlook accounts. Use this checklist on your Mac before trusting important workflows. Start with a test account, test messages, and a recipient you control.

## Activate the update

```sh
cd ~/Downloads/FramePilot
git pull origin main
open -a "Google Chrome" "chrome://extensions/"
```

Reload FramePilot, check version 1.4.1, reopen the side panel, and review any Chrome permission changes. Keep Automatic mode for routine steps. Your API key should remain saved. Test with a normal web tab active. Chrome-internal pages are not supported. Close other debugging tools if debugger attachment fails.

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

## Download-to-upload acceptance

Controlled tests use a local Drive-style source, intercepted Studio fixture, actual 40 MB download and real CDP file assignment through Chrome API shims. They do not authenticate to Google or load a native installed extension under the managed environment policy. Run `python tests/transfers_test.py` to reproduce.

On your Mac, test one disposable video first:

1. Open the source Drive folder and intended Studio channel. Specify exact filename, title, description, audience and Unlisted visibility.
2. Approve the batch. Confirm routine source downloads do not prompt repeatedly and Transfers reaches ready. HTML warning pages or unsafe downloads must be rejected.
3. Confirm the video appears in Studio without dragging. Wait for upload and checks. Review actual filename, channel, title, description, audience and visibility before final approval.
4. Change the title while approval is open: the old approval must fail. Restore it and request fresh review.
5. Verify the saved video in Studio, including playback and visibility. A website save confirmation alone does not prove processing or delivery.
6. Stop, restart Chrome and continue the job: saved progress remains, approval must be renewed, and attached/saved files must not be duplicated. If an attempt is uncertain, inspect Studio manually before proceeding.
7. Forget the job: its local registry disappears, but downloaded files remain on disk. Delete those separately if needed.

A native installed-extension test, current live Drive download variants and current live YouTube Studio remain required. Do not describe the whole workflow as verified until these pass in your Chrome profile. Test Gmail/Outlook independently; this media update does not establish live email compatibility.

## 1.4.1 diagnostics and provider recovery

- With a stalled job, request `diagnose_upload_job`. It must report observed conditions rather than claim creating the job starts a download or that all manual downloads are forbidden. A matching manual download begun during approval can become ready; a preapproval download stays excluded with a reason.
- Provider unit tests mock 429 responses, verify backoff respects Retry-After, unchanged request content, bounded retries, quota errors without retries, privacy of error bodies, and cancellation. Existing partial-stream tests must continue to fail without replaying tools.
- On a real transient 429 the panel should display retry number/wait. Stop must cancel. An insufficient-quota error must identify billing/project quota and stop instead of waiting. Do not deliberately exhaust paid API quota to test this; mocks cover the branches without charges.
