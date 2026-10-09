# SWOOP 1.2.0 — bulk and schedule verification

Date: 2026-10-09. Source updated in the existing unpacked extension folder. No real posts were scheduled, published, or uploaded during this task.

## Delivered

- Bulk queue: pasted links, add loaded Instagram posts, shortcode deduplication, persistent selection queue of up to 100 links, sequential download, per-post complete/partial/failed status, stop after current post, and rate-limit stop.
- Each downloaded bundle keeps account-named numbered media, caption, metadata, and actual Chrome download-completion checks.
- Scheduling: standalone Zernio connection, session-only API key, explicit account/media selection, editable caption, date/time/timezone, review/confirm, upload before scheduling, submission receipts, idempotency-preserving retries, and provider GET readback checks.
- Original purple post button and single-post saving remain available. Post previews expose Add to bulk queue, Bulk downloads, and Schedule this post.

## Passed

- 33 dependency-free automated tests, including existing collector, post-button, and download tests plus bulk and scheduler tests. Coverage includes concurrent queue writes, trust checks, mixed carousels, partial transfers, metadata failure, rate-limit stop, DST edge cases, future-only scheduling, destination restrictions, media upload host validation, credential isolation, provider errors, idempotent retries, and mismatched readback.
- Syntax checks and archive integrity/resource validation for the packaged runtime files.
- Browser exercise against the shipped pages with a clearly labeled localhost fixture: three-post bulk batch completed, full media/caption/metadata progress shown; account selection, date/time entry, schedule review, mocked upload/submission/readback, and local receipt rendering completed.
- Rendered screenshots use fictional sample media/accounts and simulated Chrome/Zernio APIs. They are interface evidence, not live provider receipts or real download evidence.
- Read-only account discovery through the current Codex Zernio connector returned three Instagram accounts (highrisetv, highrise.agency, highriserin). No LinkedIn or X account was returned. The standalone extension must separately connect using its own entered key.

## Activation and unverified portions

Chrome must reload SWOOP and Instagram tabs must refresh to activate these source changes. Browser automation rejected the internal Chrome extensions page, so reload and any permission prompt require the user; no bypass was attempted. This task did not establish an activated 1.2.0 extension runtime.

The extension has no Zernio API key configured by this task. Connect in SWOOP and select accounts before scheduling. No real API uploads, scheduled post creation, eventual publication, or cancellation were tested. The browser fixture and unit tests cannot prove those live workflows. Mandatory storage/optional host permission behavior remains unverified in the newly loaded extension.

Schedule verification checks provider scheduled status, timestamp, account/platform targets, and caption. If readback includes media items, their count/types are checked; the provider may rewrite media URLs. This is submission verification, not proof of eventual publication.

Bulk scheduling, entire-account crawling, recurring schedules, NexusOS database writes, and other requested future features are outside this update. Chrome Web Store publication/review was not performed; the upload ZIP is a runtime package, not a claim of policy approval.

## API references

- [Create a scheduled post](https://docs.zernio.com/posts/create-post)
- [Upload through a presigned URL](https://docs.zernio.com/media/get-media-presigned-url)
- [List connected accounts](https://docs.zernio.com/accounts/list-accounts)
- [Read a saved post](https://docs.zernio.com/posts/get-post)
- [Chrome extension storage](https://developer.chrome.com/docs/extensions/reference/api/storage)
