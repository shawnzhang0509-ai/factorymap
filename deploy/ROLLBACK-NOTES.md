# Rollback to China Factory Map

`main` was reset to the last factory-map release (before MBTI pivot, PR #11).

## After merging this PR

1. **Render** — redeploy **factorymap** from branch `main` (root: `backend`).
2. **Vercel** — redeploy frontend from `main` (root: `frontend`).
3. **Database** — `factory-map-db` may still hold MBTI rows. Factory UI expects factory/MOQ fields:
   - Re-import factory Excel via admin, **or**
   - Restore a Postgres backup from before the MBTI pivot, **or**
   - Purge listings and let `run.py` seed demo factories on empty DB.
4. **Domains** — `factorymap.onrender.com` API URL is unchanged. Any domain (mbti.wtf, factorymap.online) pointing at this Vercel project will show **China Factory Map**.

## What was removed

MBTI social map, email OTP login, region/MBTI filters, and related backend changes on `main`.

To recover MBTI code later, use git tag/commit on `main` before this merge or branch `main` history at `d35abfe`.
