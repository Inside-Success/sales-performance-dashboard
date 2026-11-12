# Dislike voice feedback — November 12, 2026

## Authorized scope

Add optional voice-to-text only to dislike/Needs changes feedback in coaching (official and manual reports) and Ask Sales FAQ. Likes remain one-click ratings. Do not change coaching generation, FAQ answering, Script Adherence, scoring, governance or unrelated provider credentials.

## Implementation

- One shared recorder lives in the existing feedback forms. Record, Stop, Cancel, a visible timer, transcription status and inline errors; the user reviews/edits the text and explicitly submits. Existing typed text is appended to rather than overwritten. Navigation invalidates late microphone/network callbacks. Only one microphone session can run at a time.
- At most two minutes and 4,000,000 audio bytes per recording. Feature-detected WebM/MP4/Ogg recording; browser failures retain typing. Empty/too-short recordings and detected silence are rejected before paid work. Web Audio suspension cannot block recording; if sound analysis is unavailable the provider result still requires user review. Raw audio is held in browser/server memory only, not stored in the database or n8n.
- `POST /api/feedback/transcribe` requires an approved authenticated user. FAQ requires its existing feature access and exact conversation/message ownership; coaching requires an existing Enhanced official/manual report. MIME/container and context validation happen before a paid request. Server origin check, file limit, twenty reservations per account/hour and one pending transcription/account protect the paid endpoint.
- Only server-side `FEEDBACK_TRANSCRIPTION_OPENAI_API_KEY` is used; there is no fallback to chat/coaching/FAQ/adherence keys. Fixed model `gpt-transcribe`; no extra rewrite/reviewer models. `FEEDBACK_VOICE_ENABLED=true` is the independent production switch. Preview/development remain unconfigured by default and fail closed while typing remains available.
- Durable transcription receipts bind request UUID, account, exact context and audio hash. Completed retries reuse saved text. Pending, failed or uncertain paid requests are never automatically replayed. A crashed pending request becomes an uncertain hold after five minutes, allowing a genuinely new recording without replaying the old one. Transcript text older than a day is cleared on that account's next request; identity/status/usage receipts remain, and expired transcript receipts cannot trigger a new charge. This is lazy cleanup, not a scheduled deletion guarantee.
- The recorder disables sending while recording/transcribing, rejects oversized resulting feedback visibly, and releases tracks/timers/audio context on cancellation, failure or unmount. Retry reuses the same UUID. Late timers/controllers cannot cancel another recording/request.

## Feedback delivery

- Coaching dislikes now save their original approved text and source context into additive `coaching_report_feedback` before forwarding to the existing collector. Stable submission IDs prevent blind duplicate Sheet appends. Failed/uncertain forwarding does not discard the database record or pretend that an n8n acknowledgement proves a Sheet write.
- `sheet_status=received` means webhook acceptance only; `pending`/`uncertain` require receipt inspection before any resend. The existing collector remains unchanged; there is no new schedule or automatic uncertain-write replay. Operational verification must reconcile the database submission against the collector execution and Sheet row. Logs identify retained submissions needing mirror verification.
- FAQ continues using `ask_sales_faq_feedback` as its durable record and the same existing Sheet mirror/review flows. New dislikes use exact submission-ID deduplication plus SQL account/message/assistant ownership checks; an exact retry does not forward twice. Existing likes and old clients keep the original path.
- Transcription itself creates no feedback rating/Sheet row and uses no n8n execution. Only explicit final submission forwards feedback. Coaching Sheet-bound strings are escaped as plain text for the current USER_ENTERED collector; stored original text is preserved.

## Verification evidence (in progress)

- Dedicated-key real provider pilot: a system-generated 10-second recording returned HTTP 200 in 2,308ms. Negation survived exactly: `I did not refuse the payment.` Provider duration usage was 10 seconds; estimated published-rate cost $0.00075. One saved intent/receipt prevents accidental replay. This is synthetic speech, not a claim about real reps, noise or accents.
- Production additive storage initialized and that exact pilot receipt imported under explicit verification context, with `notSubmittedAsRepFeedback=true`. Re-reading its UUID returned the completed receipt without another provider request. No rep rating, Sheet row or coaching report was created by this pilot.
- Focused tests cover recorder lifecycle, permissions, silence, two-minute cutoff, cancellation/late callbacks, concurrent microphone attempts, transcription identity, timeouts, dedicated-key isolation, exact FAQ ownership, real isolated PostgreSQL rate limits/deduplication, and coaching save-before-forward behavior. Hosted acceptance and final counts will be recorded after checks/deployment.
- Production build passed; TypeScript/scoped ESLint passed before final changes and will be rerun on the final commit. Broad FAQ run had ten timeouts in the unchanged source-preservation suite while build/tests overlapped; isolated rerun is pending. Do not report that first run as fully passing.

## Operations and rollback

Tables `feedback_transcriptions` and `coaching_report_feedback` are additive. No historical coaching, FAQ, adherence or workflow records are rewritten. There are no n8n workflow or schedule edits.

To disable paid transcription, set `FEEDBACK_VOICE_ENABLED=false` and redeploy; text feedback remains. A code revert restores prior controls. Preserve durable feedback/usage receipts on rollback. Never blind-resend `received`/`uncertain` Sheet submissions or uncertain paid requests. User will perform the final real spoken-accuracy check.
