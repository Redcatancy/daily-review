# Historical AI Analysis and Conflict Accuracy Design

## Goals

- Generate analysis prompts for the date selected in the left navigation, not the computer's current date.
- Use the selected date's complete Monday-to-Sunday week and complete calendar month.
- Make prompts evidence-led, direct, detailed, and operational instead of generic encouragement.
- Stop reporting normal cloud lag as a conflict while continuing to preserve both sides of genuine multi-client conflicts.
- Prevent an older upload acknowledgement from deleting a newer queued edit.

## Analysis Semantics

The analysis screen remains a prompt generator. It does not call an AI service and does not store AI answers.

- Daily: exactly the selected date.
- Weekly: the complete natural week containing the selected date, Monday through Sunday.
- Monthly: the complete calendar month containing the selected date.
- Missing dates are missing observations, never zero scores.
- Cards and prompt output show the exact target date or date range.

Date-range calculation and prompt construction live in a pure `analysis-core.js` module. The existing `analysis.js` module owns DOM rendering and store reads.

## Prompt Standard

All prompts require the model to:

- cite concrete dates, scores, notes, highlights, or diary text for every material conclusion;
- separate observed facts, hypotheses, and missing information;
- rank the top one to three problems by impact and urgency;
- examine triggers, behavior, result, repetition, contradictions, and likely root causes;
- avoid invented causality, empty encouragement, and medical or psychological diagnosis;
- provide recommendations with priority, trigger, steps, minimum viable version, success measure, and review time;
- ask at most three high-value follow-up questions when evidence is insufficient.

Weekly and monthly prompts additionally require coverage rates, observed-only score trends, repeated patterns, stage changes, and comparisons that explicitly account for missing data.

## Conflict Classification

Store the last confirmed remote value for each user/date/field in a local remote snapshot.

For a pending local field:

- Remote equals the snapshot: normal cloud lag; retain and upload local data without a conflict.
- Remote differs from the snapshot and pending local value: genuine concurrent change; archive both values and report one conflict.
- Snapshot is absent: preserve both values conservatively, initialize the snapshot, but do not show a false conflict warning during the upgrade.
- Remote already equals the pending local value: treat it as synchronized, not conflicted.

After an upload succeeds, update the remote snapshot. Remove an outbox field only if its current value still equals the uploaded value. A newer edit therefore remains queued for the next serialized sync.

Existing entries, outbox values, conflict archives, legacy backups, and cloud rows are never deleted by migration. The exported backup adds the remote snapshot for diagnosis and recovery.

## Verification

- Pure tests cover historical day, cross-month week, leap/month boundaries, complete periods, prompt evidence rules, and missing-data language.
- Store tests cover normal stale-cloud saves, genuine remote divergence, baseline initialization, conflict deduplication, and overlapping uploads.
- Existing data-safety tests remain green.
- PC-only browser tests cover date navigation into AI analysis, exact card ranges, historical prompt output, no-data states, rapid edits, refresh persistence, and absence of false conflict warnings.
