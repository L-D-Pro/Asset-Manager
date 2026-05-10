# MVP Hardening Acceptance Runbook

Use this checklist to validate the hardened MVP end to end.

## 1) Wizard + assisted/manual apply flow

1. Enable wizard: `VITE_ENABLE_APPLY_WIZARD=true`.
2. Create job, parse JD, select claims, generate resume/cover.
3. Approve resume and cover in wizard.
4. Create assisted session.
5. Verify linked `applications` row exists with `applyMode=assisted` and `status=draft`.
6. Mark final submission in wizard:
   - set date
   - set confirmation reference
   - optional notes
7. Verify application is `submitted` with `appliedAt` and confirmation saved.

## 2) Compare/promotion correctness

1. In custom compare mode, generate at least two resume candidates and two cover candidates.
2. Verify compare results include persisted candidate version IDs.
3. Select winners and promote.
4. Confirm promoted winners are the exact selected candidate versions (no re-generation).
5. Confirm non-winning candidates remain auditable as `comparison_candidate` and are not in normal approval queue.

## 3) Learning-loop correctness

1. Create feedback signals with canonical outcomes:
   - `interview`, `offer`, `hired`, `rejected`, `ghosted`, `no_response`
2. Include direct attribution fields where available:
   - `promptVersionId`, `modelName`, `jobId`, `roleProfileId`, `baseResumeVersionId`, `coverLetterVersionId`, `selectedClaimIds`, `finalResult`
3. Trigger recompute (manual button or scheduler cycle).
4. Verify variant stats update by task scope for both prompt and model variants.
5. Verify suggested/auto promotions can activate winning prompt or model per scope.

## 4) Scheduler behavior

1. Ensure scheduler cron is enabled in config.
2. Confirm recompute runs via internal service call (no self-authenticated HTTP dependency).
3. Verify logs show recompute cycle start/completion with `statsCount`.
