# Calls

Read when the work adds or changes an API endpoint, a client, a retry policy, or a call between modules or services.

## Decide

- The public API style. Default: REST over HTTPS.
- The internal call style for each module pair: a function call inside the monolith, or REST or RPC across a process boundary. Write it in `MODULES.md`.
- For each outbound call: the timeout, the retry policy, and a flag: SAFE_TO_RETRY or NEEDS_IDEMPOTENCY_KEY.

## Which calls can be retried

| Verb | Idempotent | Retry rule |
|---|---|---|
| GET | yes, and safe | retry |
| PUT | yes | retry |
| DELETE | yes | retry |
| PATCH | treat as no | needs an idempotency key |
| POST | no | needs an idempotency key |

## Idempotency keys

Every POST that creates a resource accepts an `Idempotency-Key` header and stores the key with the result. The IETF draft for this header (still a draft) describes the server side:

- A first request with a key: process it, and store the key with the response.
- A retry with the same key and the same payload: return the stored response.
- The same key with a different payload: reply 422.
- A retry while the first request is still in progress: reply 409.

## Rules

| Rule | Default | Enforcer (level) |
|---|---|---|
| Every outbound call has a timeout and a retry flag | a shared client that takes both as required arguments | the client signature (type) |
| A create POST is safe to retry | Idempotency-Key, stored with the result | `create_retry_creates_once` (test) |
| A reused key with a different payload is rejected | 422 | `same_key_different_payload_rejected` (test) |
| Retry middleware never retries a POST without a key | the middleware checks the verb and the header | `create_retry_creates_once` (test) |
| A call across a service boundary matches its contract | a contract test on each side | Pact or a schema check in CI (test) |

## Red tests

### `create_retry_creates_once`

- Run: send `POST /posts` with key K. Drop the response before the client receives it. Send it again with K.
- Assert: exactly 1 post exists, and both responses return its ID.
- Break: ignore the Idempotency-Key header.
- Expect: 2 posts exist.

### `same_key_different_payload_rejected`

- Run: send `POST /posts` with key K and body A. Then send key K with body B.
- Assert: the second reply is 422, and the post still holds body A.
- Break: look up the stored result by key only, with no payload check.
- Expect: the second reply returns the first post as if body B was saved.

## Audit

- Client retry settings that cover POST.
- Create endpoints with no Idempotency-Key handling.
- Keys made by the server, or new keys made on each client retry.
- TCP or UDP choices: TCP for web and API traffic, UDP only for realtime voice, video, and games. The agent seldom needs to choose.
