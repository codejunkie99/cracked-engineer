# Edge

Read when the work touches DNS, the CDN, cache headers, the load balancer, the reverse proxy, or TLS.

## Decide

- For every response: public (the same for every viewer) or private (depends on the viewer). Decide this before you set cache headers.
- The number of app instances behind the load balancer (at least 2), and the health check each one answers.
- Where TLS terminates.
- For a DNS move: the current TTL of each record.

## Rules

| Rule | Default | Enforcer (level) |
|---|---|---|
| The CDN caches public responses only | a response that depends on the viewer sends `Cache-Control: private, no-store` | `private_response_not_in_shared_cache` (test) |
| The CDN never ignores the Authorization header or the session cookie on an authenticated route | the cache key includes them, or the route is not cached | CDN configuration check (lint), `private_response_not_in_shared_cache` (test) |
| At least 2 stateless app instances run behind a load balancer with health checks | readiness checks remove an instance that cannot serve | `kill_one_instance_under_load` (test) |
| TLS on every external connection | TLS terminates at the proxy or load balancer. Internal hops that cross a network boundary are encrypted. | load balancer configuration (permission) |
| A DNS change respects the TTL | lower the TTL before a planned move. Keep the old target alive until the old TTL has passed. | runbook (doc) |

## Red tests

### `private_response_not_in_shared_cache`

- Run: user A, who may see the resource, requests it through the CDN. Then user B, who may not, requests the same URL through the CDN.
- Assert: A receives 200 and the body. B receives 403 or 404 and no part of the body.
- Break: configure the CDN to cache the route and ignore authorization.
- Expect: B receives A's cached body.
- Prove the first assert first. A test that checks only B can pass for the wrong reason, for example when the route is down for everyone.

### `kill_one_instance_under_load`

- Run: a load test at TARGET peak against 2 instances. Kill one instance in the middle of the test.
- Assert: the error rate stays under the TARGET budget. The load balancer removes the dead instance within the health check window.
- Break: store sessions in process memory.
- Expect: users on the killed instance lose their sessions and get 401.

## Audit

- CDN rules that cache `/api/*`, `/posts/*`, or any authenticated route, or that strip cookies and the Authorization header from the cache key.
- `Cache-Control: public` or a long `max-age` on a response built from the session.
- A health check that returns 200 while the instance cannot serve.
- One instance, or one load balancer with no managed failover.

## Traps

- The CDN is a shared cache. A private response that enters it reaches the next user.
- Some resolvers hold DNS records longer than the TTL.
- A load balancer is useful when you run several servers. A reverse proxy is useful even with one (TLS, compression, static files).
