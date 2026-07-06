# Supabase migrations (Nanisuru)

Idempotent SQL migrations for Nanisuru persistence. Safe to run in Supabase Dashboard → SQL Editor, in numeric order, or all at once.

## Quick start

1. Run `001` through `010` in order, **or** continue using the monolithic `../SUPABASE_SAFE_SETUP.sql`.
2. Configure `.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (never commit).
3. In dev, launch the app — console shows `[SupabaseSetup]` table status via `checkSupabaseSetup()`.

## Table name map (app ↔ SQL)

| App code (`supabase.from`) | Migration / notes |
|---|---|
| `trips` | **Primary saved plans** — `001_trips.sql`. App uses `payload` jsonb. |
| `saved_travel_plans` | Normalized future schema — `002_saved_travel_plans.sql` (not wired in app yet). |
| `trip_folders`, `trip_assistant_messages` | `003_trip_folders.sql` |
| `trip_folder_plans` | `004_trip_folder_plans.sql` (app uses `trip_folders.plan_payload` today) |
| `itinerary_edits` | `005_itinerary_edits.sql` |
| `weather_replans` | `006_weather_replans.sql` |
| `trip_memories` (+ media/likes/saves) | `007_trip_memories.sql` |
| `local_hidden_spots` | **Primary local gems** — existing `../local_hidden_spots.sql` + extensions |
| `local_gems` | Normalized future schema — `008_local_gems.sql` (app reads `local_hidden_spots`) |
| `user_preferences` | `009_user_preferences.sql` |

## Visibility values

RLS accepts both Japanese UI labels and English codes:

- Private: `'自分だけ'`, `'private'`
- Public: `'公開する'`, `'public'`

## Storage buckets

See `../README_STORAGE.md`.
