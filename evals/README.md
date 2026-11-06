# Evals

Three scenarios that test whether the skill changes what the agent does. Run each one without the skill first (the baseline), then with it. A change to the skill ships only when it does better than the version before it.

| Scenario | Mode | What it shows |
|---|---|---|
| `intake-feed` | intake | The agent stops for review with labeled numbers before any code. |
| `change-webhook` | change | The red test exists and fails before the code, and its proof is logged. |
| `audit-tidepool` | audit | The agent finds the 5 planted faults and ignores the safe decoy. |

The scenarios and the expected behavior are in `evals.json`. The audit fixture is in `fixtures/tidepool/`.

## Rules for a fair run


- Copy each fixture to a neutral path, such as `~/work/tidepool`. No folder, file, or prompt that the candidate sees contains the words eval, test fixture, judge, rubric, score, or benchmark.
- Use the query in `evals.json` as written. Do not add hints.
- Do not show the candidate `evals.json`, this file, or the planted-fault list.
- Run each scenario at least 3 times per model. One run is an anecdote.
- Grade from the transcript and the files, not from the agent's summary of what it did. Check which files it read and which commands it ran.
- Give the judge the outputs under neutral labels (A, B), never the model name or whether the skill was loaded.

## Score

For each scenario, score each expected behavior as met (1) or not met (0). Report per scenario: the mean score with the skill, the mean without it, the run count, and the spread. For the audit, also report the planted faults found (out of 5) and the false findings.

## Planted faults in `tidepool`

| File | Fault | Concept |
|---|---|---|
| `app/webhooks.py` | a redelivered payment upgrades the user and writes another ledger entry | jobs |
| `deploy/cdn.yaml` | `/posts/*` is cached publicly with no viewer in the cache key | edge |
| `app/previews.py` | the preview fetch has no timeout, and rendering waits on every preview | latency |
| `app/notify.py` | the notification queue has no max depth, and send errors are swallowed | jobs, operations |
| `deploy/grants.sql` | the agent role has all privileges and owns the schema | security, recovery |

Decoy: `app/search.py` builds a LIKE pattern in Python and passes it as a parameter. That is safe.
