# Supabase persistence audit (Nanisuru)

Generated for the persistence setup task. Documents what the app uses vs. what SQL exists.

## Tables used via `supabase.from()` (src/)

| Table | Lib file(s) | SQL file | Status |
|---|---|---|---|
| `trips` | `saved-trips.ts` | `trips.sql`, `migrations/001` | **Active** — primary saved plans |
| `saved_travel_plans` | — (not wired) | `saved_travel_plans.sql`, `migrations/002` | Future normalized schema |
| `trip_folders` | `trip-folders.ts` | `trip_folders.sql`, `migrations/003` | Active |
| `trip_assistant_messages` | `trip-folders.ts` | `trip_folders.sql`, `migrations/003` | Active (`trip_folder_id` column) |
| `trip_folder_plans` | — (not wired) | `saved_travel_plans.sql`, `migrations/004` | Future M:N folder↔plan |
| `itinerary_edits` | `itinerary-edits.ts` | `itinerary_edits.sql`, `migrations/005` | Active; optional `folder_id`/`source` via `itinerary_edits_trip_assistant.sql` |
| `weather_replans` | `weather-replans.ts` | `weather_replans.sql`, `migrations/006` | Active |
| `trip_memories` | `trip-memories.ts` | `trip_memories.sql`, `migrations/007` | Active (album model) |
| `trip_memory_media` | `trip-memories.ts` | `trip_memories.sql` | Active |
| `trip_memory_likes/saves/comments` | `trip-memories.ts` | `trip_memories.sql` | Active |
| `local_hidden_spots` | `local-hidden-spots.ts`, `local-gems-feed.ts` | `local_hidden_spots.sql` | **Active** local gems |
| `local_gems` | — (not wired) | `migrations/008` | Future normalized schema |
| `user_preferences` | `travel-user-preferences.ts` | `user_preferences.sql`, `migrations/009` | Active + AsyncStorage fallback |
| `public_plans` + social | `public-plans.ts`, discover | `public_plans.sql` | Active (publish flow) |
| `user_profiles`, `user_follows` | profile libs | `user_profiles.sql` | Active |
| `travel_memories` | `travel-memory.ts` | `travel_memories*.sql` | Legacy / separate feature |

## Storage buckets

| Bucket | Wired | SQL |
|---|---|---|
| `trip-memories` | Yes — `trip-memories.ts` | `trip_memories.sql`, `migrations/007` |
| `local-gems` | No (future) | Documented in `README_STORAGE.md` |
| `public-plan-images` | Yes | `public_plan_images.sql` |

## Gaps fixed by this setup

1. Organized `supabase/migrations/` with full schemas A–I.
2. Extended `saved_travel_plans`, `itinerary_edits`, `local_gems` with missing columns.
3. Unified public-read RLS (`migrations/010`) for `'公開する'` and `'public'`.
4. `src/lib/supabase-persistence.ts` — safe typed facade over existing libs.
5. `checkSupabaseSetup()` — dev console diagnostics.

## Not changed (by design)

- App still saves plans to `trips` (not `saved_travel_plans`).
- App still reads local gems from `local_hidden_spots`.
- Local AsyncStorage / mock fallbacks unchanged.
- No UI changes.
