# SWOOP 1.3.0 — scheduler options verification

Date: 2026-10-09. Updated existing unpacked extension source. No real social posts or uploads were created, and no real reminders/notifications were set during testing.

## Delivered

- Shared scheduler selector: Zernio, Postiz, or Local. Existing bulk and single-post downloads retained.
- Zernio connection/session key, explicit destination selection, upload, future-only reviewed submission, saved request/idempotency retry, and provider readback retained.
- Postiz Cloud and existing local Postiz (127.0.0.1:4007) adapters: independent session key, active channel list, multipart upload, platform-specific settings, future schedule payload, per-destination post IDs, and independent queued-post readback.
- Postiz uncertainty does not trigger resubmission. Provider dashboard/check-status links and user-attested resolution of local receipts prevent a hidden fallback or blind retry.
- Local mode: selected-media kit, edited caption/metadata, escaped/folded UTC .ics calendar file, optional Chrome notifications, persisted/restored alarms, due state, caption/folder list, calendar re-export, and Chrome reminder cancellation. Manual publication is explicitly stated.
- Required alarms permission added. Notifications and narrow provider/loopback hosts are optional. No all-sites permission or embedded credentials.

## Passed

- All 40 dependency-free automated tests passed. New coverage verifies Postiz Cloud/local endpoints, credential routing, channel filtering, multipart uploads and IDs, exact payloads, all-target readback/mismatch, future-only submission, uncertainty without resending, local partial-download rejection, edited caption/media selection, calendar escaping/UTF-8 folding, worker trust checks, alarm restore, due notification once, and cancellation.
- Shipped scheduler pages exercised in Chrome using a labeled localhost fixture with fictional sample content and mocked Chrome/provider APIs. Zernio and Postiz upload/submission/readback showed simulated verified receipts. Local kit/reminder creation, saved-caption display, calendar re-export, and cancellation completed.
- Screenshots are labeled local interface tests. They do not prove real provider scheduling, actual on-disk media downloads, or OS notification delivery.
- Runtime JavaScript syntax, module/classic-worker dependencies, manifest/HTML assets, and both ZIP archives were checked.

## Activation and limits

Chrome must reload SWOOP 1.3.0 and refresh Instagram tabs. The browser automation policy rejects internal chrome:// pages, so reload/permission activation requires the user; no workaround was attempted. The installed 1.3.0 extension runtime and Chrome optional-permission prompts remain unverified.

The task did not configure real Zernio/Postiz keys in SWOOP. Enter them in the selected provider's Connect screen. Existing Codex/NexusOS credentials are separate. No Postiz server, hosting, developer app, account, or subscription was provisioned. The local Postiz option requires an existing compatible server at the displayed address; local reminder mode requires no server/key.

Live uploads, scheduled-post creation, eventual publication, provider cancellation, OS notification delivery, calendar-app import, and browser-restart behavior in the installed extension were not tested. Tests cover restore/due logic with a controlled clock and mocked Chrome APIs. Code/UI verification does not establish those live outcomes.

Postiz readback validates state QUEUE, scheduled date, caption, and each provider/channel ID. Its list endpoint does not expose a full media verification result here. Uploaded media/domain restrictions and platform constraints are documented in README.md. Zernio's prior readback checks remain unchanged. Local reminders can be delayed during sleep/browser closure; imported calendar reminders are managed separately.

## Official references

- [Postiz API/authentication](https://docs.postiz.com/public-api/introduction)
- [Postiz integrations](https://docs.postiz.com/public-api/integrations/list)
- [Postiz upload](https://docs.postiz.com/public-api/uploads/upload-file)
- [Postiz scheduling](https://docs.postiz.com/public-api/posts/create)
- [Postiz readback](https://docs.postiz.com/public-api/posts/list)
- [Postiz Instagram settings](https://docs.postiz.com/public-api/providers/instagram)
- [Chrome alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms)
- [Chrome notifications](https://developer.chrome.com/docs/extensions/reference/api/notifications)
