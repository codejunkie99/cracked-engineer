# Recovery

Read when the work touches backups, restores, data deletion, or the RPO and RTO targets.

## Decide

- RPO (recovery point objective): how much recent data you can lose. A daily backup alone gives an RPO of up to a day.
- RTO (recovery time objective): how long a recovery can take.
- Where backups live, and which roles can delete them. The app and the agent must not be among those roles.

## Rules

| Rule | Default | Enforcer (level) |
|---|---|---|
| Recovery meets the RPO | daily base backup plus continuous write-ahead log (WAL) archiving, or the managed service's point-in-time recovery | `restore_meets_rpo` (test) |
| Backups survive the loss of the app's account | a separate account or project, write-once retention (object lock) | bucket policy (permission), `backup_delete_denied` (test) |
| A restore drill runs on a schedule | monthly, and its result is logged | a scheduled CI job (test) |

## Red tests

### `restore_meets_rpo`

- Run: restore the latest base backup to a scratch database. Replay the archived WAL to a recovery point 5 minutes before now.
- Assert: no committed write older than the recovery point is lost. The total recovery time is under the RTO.
- Break: turn off WAL archiving in the database configuration.
- Expect: the newest recovery point is the base backup, so the RPO is missed.

### `backup_delete_denied`

- Run: with the app's credentials and then the agent's credentials, try to delete a backup object.
- Assert: both deletes are denied.
- Break: grant delete on the backup bucket to the app role.
- Expect: the delete succeeds.

## Audit

- Backups in the same account as production, with delete rights for the app role.
- No record of a restore in the last 90 days.
- WAL archiving or point-in-time recovery turned off.
- Retention shorter than the time it takes to notice a bad write.

## Example

In January 2017, GitLab.com lost production data after an engineer removed data from the primary while rebuilding replication. Several backup methods had failed, and a six-hour-old snapshot allowed only a partial restore. The fix is not "be careful". It is a restore drill that runs on a schedule and fails loudly.
