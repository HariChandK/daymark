# Daymark recovery policy

## User protection

- Journal drafts remain in the user's browser until the backend confirms the save.
- The interface says `Saved securely` only after a successful backend response.
- Failed saves remain visible and provide a retry action.
- Users can export all current tasks and entries as JSON or Markdown.

## Backup targets

- Keep encrypted daily database backups for 30 days.
- Keep encrypted monthly backups for one year.
- Store backups separately from the production database account.
- Restrict backup access to the Daymark owner.

## Restore test

Test restoration at least once every three months:

1. Restore the newest backup into a separate non-production project.
2. Count profiles, tasks, and entries.
3. Compare a sample of records, including the oldest and newest entries.
4. Sign in with a test account and verify its private data is available.
5. Confirm that a second test account cannot read the first account's records.
6. Record the date, backup used, results, and any corrective action.

A backup is not considered reliable until this restore test passes.

## Incident response

If saving fails or data appears missing:

1. Stop deployments and database migrations.
2. Keep browser drafts and both databases untouched.
3. Show a maintenance message instead of claiming saves succeeded.
4. Export current production data and logs.
5. Identify the last verified backup.
6. Restore into a separate project and compare before changing production.
7. Document what happened and how recurrence will be prevented.
