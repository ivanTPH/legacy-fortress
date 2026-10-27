# Legacy Fortress project state (stable context)

Legacy Fortress is a Next.js Personal Vault with Supabase database, Auth and Storage, plus separately bounded Platform Admin, Partner and estate workflows. Canonical assets and legacy records coexist. Contacts, record associations, invitations, identity verification and effective access grants are distinct; only server-enforced grant scope creates visibility. This file is background, not a live release tracker.

The live release, current branch SHAs, blockers and next authorised task are maintained in `docs/CAPABILITY_BACKLOG.json` and reported by `node scripts/dev/bootstrap.mjs`. Detailed work evidence is in `docs/CODEX_HANDOVER.md`. Protected application release procedure is in `docs/BUILD_AND_RELEASE.md`; TEST database migration approval and recovery rules are in `docs/STAGING_DATABASE_MIGRATIONS.md`.

Production is outside ordinary Codex sessions. TEST is `https://test.mylegacyfortress.com` on Coolify. Local browser review uses `http://127.0.0.1:3012`; local Supabase uses `127.0.0.1:55421`. Do not infer the PostgreSQL target from a public Supabase API URL. The TEST database cluster, production separation, migration history and isolated restore must be independently verified before a hosted SQL write.
