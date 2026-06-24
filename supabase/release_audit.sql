-- Nanisuru: リリース前データ監査メモ（実行用 SQL ではありません）
-- スキーマのセットアップは supabase/SUPABASE_SAFE_SETUP.sql を使用してください。

-- テーブル名マップ（アプリ概念 → Supabase 実テーブル）
--   profiles              → user_profiles
--   saved_trips           → trips
--   public_plans          → public_plans
--   public_plan_likes     → public_plan_likes
--   public_plan_saves     → public_plan_saves
--   public_plan_comments  → public_plan_comments
--   public_plan_requests  → public_plan_requests
--   public_plan_versions  → public_plan_versions
--   public_plan_images    → public_plan_images
--   public_plan_videos    → public_plan_videos
--   public_plan_copies    → public_plan_copies
--   shared_trips          → shared_trips
--   shared_trip_reactions → shared_trip_reactions
--   travel_memories       → travel_memories
--   plan_ratings          → plan_ratings
--   user_follows          → user_follows
--   notifications         → notifications
--   reports               → reports
--   blocked_users         → blocked_users

-- created_at / updated_at 確認済み:
--   trips, shared_trips, public_plans, public_plan_*, user_profiles,
--   user_follows, travel_memories, notifications, reports, blocked_users,
--   plan_ratings, shared_trip_reactions

-- 公開プランの Discover 表示条件（アプリ + RLS）:
--   visibility = 'public'
--   AND is_public = true
--   AND is_removed = false
--   AND moderation_status = 'active'
--   ブロックしたユーザーのプランはクライアント側でも除外

-- 非公開 trips は user_id = auth.uid() の RLS で保護。
-- 公開プラン payload に個人メール等を含めない（UI は creatorDisplayName のみ）。
