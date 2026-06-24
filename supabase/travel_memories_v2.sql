-- Nanisuru: 旅行メモリー — カテゴリ拡張（苦手なこと・行きたい場所）
-- 既存テーブルがある場合は SQL Editor で実行してください

alter table public.travel_memories
  drop constraint if exists travel_memories_category_check;

alter table public.travel_memories
  add constraint travel_memories_category_check
  check (
    category in (
      'food',
      'travel_style',
      'budget',
      'activities',
      'dislikes',
      'companion',
      'destinations'
    )
  );
