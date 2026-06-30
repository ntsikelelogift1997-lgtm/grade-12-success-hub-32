## What you'll get

1. **Bookmark questions** — star icon on every question (during a test and in the results review). A new **"Bookmarked"** page lists all starred questions across subjects, showing the correct answer and explanation so you can come back to tricky ones any time.
2. **Resume in-progress tests** — leave a test halfway and pick it up later from exactly where you stopped: same question, same answers selected, same time remaining. Timer **pauses** when you exit and resumes when you return.

## Changes

### Database (1 migration)

- New table **`question_bookmarks`** (per-user, per-question; toggle on/off). Only the user who created a bookmark can see or remove it.
- Add columns to **`test_attempts`**:
  - `seconds_remaining` — time left at last save
  - `last_seen_question_index` — which question you were on
  - `status` defaults to `in_progress` until you submit (kept consistent with existing `completed_at`)
- New table **`attempt_progress_answers`** — auto-saves your currently selected option for each question while a test is in progress. On submit, these are converted into the final scored `attempt_answers` rows. Keeping in-progress answers separate from final scored answers means we never accidentally show a half-finished attempt as a "result".

### Test-taking page (`/practice/$testId`)

- On open, check for an **existing in-progress attempt** for this test:
  - If one exists → show a small "Resume" / "Start fresh" prompt, then restore previous answers, current question index, and remaining seconds.
  - If none → create a new in-progress attempt row up front (so it can be resumed even if you close the tab immediately).
- **Auto-save** every answer change to `attempt_progress_answers` and persist `seconds_remaining` + current question index every ~10 seconds and on tab close (using `visibilitychange`).
- New **star button** on each question that toggles a bookmark.
- An **"Exit & save"** button replaces today's plain Exit link.
- Final submit clears the in-progress rows and writes scored `attempt_answers` exactly like today.

### Results / review page

- Star button next to each question (same bookmark behavior).

### Practice list (`/practice`)

- Surfaces any in-progress attempt with a **"Resume"** badge and CTA at the top.

### New page `/bookmarks`

- Lists all bookmarked questions grouped by subject, with the question, correct answer highlighted, and the explanation.
- Unstar button to remove.
- Linked from the dashboard and from the practice list.

### Dashboard

- New "Bookmarked questions" card alongside the existing practice/progress cards.

## Technical details

- All new tables use the same RLS pattern: `auth.uid() = user_id`, plus `GRANT`s for `authenticated` and `service_role`.
- Scoring stays server-trusted: on submit we re-fetch `is_correct` from `question_options` rather than trusting whatever is in `attempt_progress_answers`.
- Auto-save uses a debounced `upsert` keyed on `(attempt_id, question_id)` so rapid changes don't flood the network.
- Timer is pause-on-exit by storing `seconds_remaining` rather than an `expires_at` deadline.
- No changes to the existing auth, roles, profiles, or scoring logic.