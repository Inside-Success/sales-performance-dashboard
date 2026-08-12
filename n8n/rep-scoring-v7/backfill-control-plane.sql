-- DESIGN ONLY. Do not apply until the user explicitly approves the V7 full backfill.
-- Postgres is the control plane because a primary key plus row locks provide true
-- atomic leases; Airtable remains the scoring evidence store and is not used as a lock.

CREATE TABLE IF NOT EXISTS rep_scoring_v7_work (
  idempotency_key text PRIMARY KEY,
  source_record_id text NOT NULL,
  scorer_version text NOT NULL,
  lane text NOT NULL CHECK (lane IN ('live', 'backfill')),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'leased', 'retry_wait', 'completed', 'fair_exclusion', 'dead_letter')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0 AND attempt <= 4),
  lease_owner text,
  lease_token uuid,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz,
  final_assessment_id text,
  failure_class text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_record_id, scorer_version)
);

CREATE INDEX IF NOT EXISTS rep_scoring_v7_claimable_idx
  ON rep_scoring_v7_work (lane, state, next_attempt_at, lease_expires_at, created_at);

-- The approved coordinator runs this statement in one short transaction. SKIP LOCKED
-- lets parallel coordinators refill safely without purchasing the same call twice.
WITH claimable AS (
  SELECT idempotency_key
  FROM rep_scoring_v7_work
  WHERE lane = $1
    AND (
      state = 'pending'
      OR (state = 'retry_wait' AND next_attempt_at <= now())
      OR (state = 'leased' AND lease_expires_at <= now())
    )
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT LEAST($2::integer, 200)
)
UPDATE rep_scoring_v7_work AS work
SET state = 'leased',
    attempt = work.attempt + 1,
    lease_owner = $3,
    lease_token = $4,
    lease_expires_at = now() + interval '8 minutes',
    updated_at = now()
FROM claimable
WHERE work.idempotency_key = claimable.idempotency_key
RETURNING work.*;

-- A healthy worker renews before the lease expires. Renewal is conditional on the
-- current owner/token pair, so it cannot revive a lease already reclaimed elsewhere.
UPDATE rep_scoring_v7_work
SET lease_expires_at = now() + interval '8 minutes',
    updated_at = now()
WHERE idempotency_key = $1
  AND state = 'leased'
  AND lease_owner = $2
  AND lease_token = $3
  AND lease_expires_at > now()
RETURNING lease_expires_at;

-- Completion is accepted only from the current lease holder. A stale worker therefore
-- cannot overwrite a later successful retry.
UPDATE rep_scoring_v7_work
SET state = $5,
    final_assessment_id = $6,
    lease_owner = NULL,
    lease_token = NULL,
    lease_expires_at = NULL,
    updated_at = now()
WHERE idempotency_key = $1
  AND state = 'leased'
  AND lease_owner = $2
  AND lease_token = $3
  AND lease_expires_at > now()
  AND $5 IN ('completed', 'fair_exclusion')
RETURNING *;

-- A worker failure is settled independently. The caller supplies a deterministic
-- backoff time from the tested policy; exhausted or non-retryable work is dead-lettered.
UPDATE rep_scoring_v7_work
SET state = CASE WHEN $5::boolean = false OR attempt >= 4 THEN 'dead_letter' ELSE 'retry_wait' END,
    next_attempt_at = CASE WHEN $5::boolean = false OR attempt >= 4 THEN NULL ELSE $6::timestamptz END,
    failure_class = $7,
    lease_owner = NULL,
    lease_token = NULL,
    lease_expires_at = NULL,
    updated_at = now()
WHERE idempotency_key = $1
  AND state = 'leased'
  AND lease_owner = $2
  AND lease_token = $3
RETURNING *;
