# Daymark data migration

Daymark must never delete or overwrite the original D1 data during the move to Supabase.

## Safety rules

1. Treat D1 as read-only during migration.
2. Export the signed-in user's D1 response before copying records.
3. Create the Supabase tables and Row Level Security policies from `supabase/migrations/0001_daymark_schema.sql`.
4. Copy records using the verified Supabase user ID as `user_id`.
5. Compare profile, task, and entry counts.
6. Compare every record's ID and meaningful fields, not only the totals.
7. Test create, edit, complete, delete, journal save, refresh, sign out, and sign in against Supabase.
8. Switch the production frontend only after every comparison passes.
9. Keep D1 unchanged for at least 30 days after the switch.

## Verification report

Record the following for each migrated account:

- Supabase user ID
- D1 profile count and Supabase profile count
- D1 task count and Supabase task count
- D1 entry count and Supabase entry count
- Earliest and latest entry dates in both stores
- Field comparison result
- Migration time
- Verifier

If any value differs, stop. Continue serving D1 and investigate before switching.

## Rollback

The rollback is a frontend configuration change back to the existing D1 API. Do not modify Supabase or D1 while investigating. Export both versions first, compare them, and decide which records must be reconciled.
