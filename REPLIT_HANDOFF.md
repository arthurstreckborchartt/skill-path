# Replit handoff — Supabase persistence

This branch was created by Replit from main at 30d1a69. It is intentionally isolated so Claude/Lovable can continue working on main without overwriting these changes.

## Do not merge automatically

- Do not force-push, rebase, amend, or squash the published history.
- Do not copy these files into main until the draft PR is reviewed.
- The source of truth for this work is branch replit/persistence-supabase.

## What changed

- Added supabase/pathly_persistence.sql with two RLS-protected tables.
- Added src/lib/cloud-sync.ts with resilient load/save helpers.
- Onboarding now restores cloud data for authenticated users and mirrors autosaves to Supabase.
- Route progress now hydrates from Supabase and mirrors changes while preserving localStorage fallback.
- Updated Supabase TypeScript types for the new tables.

## Required one-time setup

Run supabase/pathly_persistence.sql in the Supabase SQL Editor for project qfkzalijwqbpxskgttsg. Until then, the app logs a warning and continues using localStorage.

## Review point

After the credits return, review this branch and the draft PR before merging anything into main.
