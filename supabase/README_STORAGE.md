# Supabase Storage buckets (Nanisuru)

Bucket creation uses `INSERT INTO storage.buckets` in SQL (see `migrations/007_trip_memories.sql`). If your project restricts bucket DDL via SQL, create buckets manually in Dashboard → Storage.

## trip-memories (required for photo/video uploads)

| Setting | Value |
|---|---|
| Bucket name | `trip-memories` |
| Public | **Yes** (public read URLs for album media) |
| Used in | `src/lib/trip-memories.ts` — `TRIP_MEMORY_BUCKET` |
| Path pattern | `{user_id}/{memory_id}/{filename}` |
| RLS | Users may insert/update/delete only under their own `{user_id}/` prefix; anyone can read |

Upload flow: `uploadTripMemoryFile()` → `supabase.storage.from('trip-memories').upload(...)`.

## local-gems (future)

| Setting | Value |
|---|---|
| Bucket name | `local-gems` |
| Public | **Recommended: Yes** (thumbnail URLs in feed) |
| Used in | Not wired yet — spot images currently use `image_url` text field on `local_hidden_spots` |
| Path pattern (planned) | `{user_id}/{spot_id}/{filename}` |

When implemented, mirror the `trip-memories` storage policies: public read, owner-scoped write.

## Other buckets (outside this task)

- `public-plan-images` — `src/lib/public-plan-images.ts`
