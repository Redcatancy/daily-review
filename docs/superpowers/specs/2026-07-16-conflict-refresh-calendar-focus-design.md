# Conflict-Safe Refresh and PC UI Cleanup Design

## Goal

Prevent unsynced local edits from disappearing after cloud synchronization or page refresh, while simplifying calendar previews and removing the unwanted purple focus outline from diary fields.

## Data Safety Rules

- A field present in the authenticated user's outbox is an unsynced local edit.
- If the cloud has a different value for that field, archive both values as a conflict, keep the local value visible, and keep the outbox item queued for upload.
- After the local value uploads successfully, acknowledge only that uploaded outbox field.
- If a local field has no pending outbox item, the cloud value may refresh the local cache without being reported as a conflict.
- Existing entries, outbox data, conflict archives, legacy backups, and cloud rows must never be cleared as part of this change.

## Calendar Rule

Calendar cells may display a diary title only. Highlights, improvements, diary body text, and other core content must not be used as fallback preview text.

## Focus Styling Rule

Diary title and body fields must not show the global purple focus outline. Keyboard focus indication remains on buttons and explicitly focusable controls.

## Verification

- Automated regression tests reproduce the stale-cloud conflict and prove the local pending value survives and uploads.
- Automated tests verify remote-only cache refreshes do not create false conflicts.
- Automated tests verify calendar preview selection and diary focus CSS.
- Full unit suite, syntax checks, production build, and PC-only Playwright checks must pass.
