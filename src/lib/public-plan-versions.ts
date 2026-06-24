import { adjustCopiedPlanWithAi } from '@/lib/plan-copy';
import { ensureUserProfile } from '@/lib/user-profiles';
import { getPublicPlanById } from '@/lib/public-plans';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { flattenItineraryDays } from '@/lib/trip-duration';
import type {
  PublicPlanRequestType,
  PublicPlanVersion,
  PublicPlanVersionWithPlan,
} from '@/types/public-plan-feedback';
import {
  getRequestTypeLabel,
  getVersionShortLabel,
  PUBLIC_PLAN_VERSION_AI_INSTRUCTIONS,
} from '@/types/public-plan-feedback';
import type { PublicPlan, PublicPlanCategory } from '@/types/public-plan';
import type { SavedTripPayload } from '@/types/trip';

type VersionRow = {
  id: string;
  original_public_plan_id: string;
  version_public_plan_id: string;
  version_type: PublicPlanRequestType;
  created_by: string;
  created_at: string;
};

function assertVersionsConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      '別バージョン機能には Supabase の設定が必要です。\npublic_plan_versions テーブルを作成してください。',
    );
  }
}

function rowToVersion(row: VersionRow): PublicPlanVersion {
  return {
    id: row.id,
    originalPublicPlanId: row.original_public_plan_id,
    versionPublicPlanId: row.version_public_plan_id,
    versionType: row.version_type,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

async function getCurrentUserId(): Promise<string | null> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function categoryForVersionType(
  versionType: PublicPlanRequestType,
  fallback: PublicPlanCategory,
): PublicPlanCategory {
  switch (versionType) {
    case 'date_oriented':
    case 'night_plan':
      return 'デート';
    case 'more_gourmet':
      return 'グルメ';
    default:
      return fallback;
  }
}

export async function resolveOriginalPublicPlanId(publicPlanId: string): Promise<string> {
  assertVersionsConfigured();

  const supabase = getSupabase();
  const { data } = await supabase
    .from('public_plan_versions')
    .select('original_public_plan_id')
    .eq('version_public_plan_id', publicPlanId)
    .maybeSingle();

  if (data?.original_public_plan_id) {
    return data.original_public_plan_id as string;
  }

  return publicPlanId;
}

export async function fetchRelatedPublicPlanVersions(
  publicPlanId: string,
  viewerUserId: string | null,
): Promise<PublicPlanVersionWithPlan[]> {
  assertVersionsConfigured();

  const originalId = await resolveOriginalPublicPlanId(publicPlanId);
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('public_plan_versions')
    .select(
      'id, original_public_plan_id, version_public_plan_id, version_type, created_by, created_at',
    )
    .eq('original_public_plan_id', originalId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message ?? '別バージョンの取得に失敗しました');
  }

  const versions = ((data ?? []) as VersionRow[]).map(rowToVersion);
  const plans = await Promise.all(
    versions.map((version) => getPublicPlanById(version.versionPublicPlanId)),
  );

  return versions
    .map((version, index) => {
      const plan = plans[index];
      if (!plan) return null;
      const isOwner = viewerUserId === plan.userId;
      if (plan.visibility === 'private' && !isOwner) return null;
      if (plan.visibility === 'private' && isOwner) {
        return { ...version, plan };
      }
      if (plan.visibility === 'public' || plan.visibility === 'unlisted') {
        return { ...version, plan };
      }
      return null;
    })
    .filter((item): item is PublicPlanVersionWithPlan => item !== null);
}

export async function getVersionRecordForPlan(
  versionPublicPlanId: string,
): Promise<PublicPlanVersion | null> {
  assertVersionsConfigured();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('public_plan_versions')
    .select(
      'id, original_public_plan_id, version_public_plan_id, version_type, created_by, created_at',
    )
    .eq('version_public_plan_id', versionPublicPlanId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToVersion(data as VersionRow);
}

export async function createVersionDraftFromRequest(
  originalPublicPlanId: string,
  versionType: PublicPlanRequestType,
): Promise<{ draftPlanId: string }> {
  assertVersionsConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const original = await getPublicPlanById(originalPublicPlanId);
  if (!original) {
    throw new Error('公開プランが見つかりません');
  }
  if (original.userId !== user.id) {
    throw new Error('作成者のみ別バージョンを作成できます');
  }

  const rootPlanId = await resolveOriginalPublicPlanId(originalPublicPlanId);
  const instruction = PUBLIC_PLAN_VERSION_AI_INSTRUCTIONS[versionType];
  const adjustedPayload = await adjustCopiedPlanWithAi(original.payload, instruction);
  const versionLabel = getVersionShortLabel(versionType);
  const profile = await ensureUserProfile();

  const payload: SavedTripPayload = {
    ...adjustedPayload,
    items: flattenItineraryDays(adjustedPayload.days),
    notes:
      adjustedPayload.notes?.trim() ||
      `リクエスト「${getRequestTypeLabel(versionType)}」をもとにAIが生成した別バージョンです。`,
  };

  const title = `${original.title} · ${versionLabel}`;
  const description = `ユーザーの「${getRequestTypeLabel(versionType)}」リクエストをもとに、AIが作成した別バージョンです。`;
  const tags = [...new Set([...original.tags, versionLabel])];
  const category = categoryForVersionType(versionType, original.category);

  const { data: draftPlan, error: draftError } = await supabase
    .from('public_plans')
    .insert({
      user_id: user.id,
      source_trip_id: null,
      title,
      description,
      category,
      tags,
      visibility: 'private',
      creator_display_name: profile.displayName,
      payload,
    })
    .select('id')
    .single();

  if (draftError || !draftPlan) {
    throw new Error(draftError?.message ?? '下書きの作成に失敗しました');
  }

  const draftPlanId = draftPlan.id as string;

  const { error: versionError } = await supabase.from('public_plan_versions').insert({
    original_public_plan_id: rootPlanId,
    version_public_plan_id: draftPlanId,
    version_type: versionType,
    created_by: user.id,
  });

  if (versionError) {
    await supabase.from('public_plans').delete().eq('id', draftPlanId).eq('user_id', user.id);
    throw new Error(versionError.message ?? 'バージョン情報の保存に失敗しました');
  }

  return { draftPlanId };
}

export async function saveVersionDraft(input: {
  planId: string;
  title: string;
  description: string;
  payload: SavedTripPayload;
}): Promise<PublicPlan> {
  assertVersionsConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const versionRecord = await getVersionRecordForPlan(input.planId);
  if (!versionRecord) {
    throw new Error('このプランは別バージョンの下書きではありません');
  }
  if (versionRecord.createdBy !== user.id) {
    throw new Error('作成者のみ下書きを編集できます');
  }

  const payload: SavedTripPayload = {
    ...input.payload,
    items: flattenItineraryDays(input.payload.days),
  };

  const { data, error } = await supabase
    .from('public_plans')
    .update({
      title: input.title.trim(),
      description: input.description.trim(),
      payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.planId)
    .eq('user_id', user.id)
    .select(
      'id, user_id, source_trip_id, title, description, category, tags, visibility, creator_display_name, payload, like_count, save_count, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '下書きの保存に失敗しました');
  }

  const plan = await getPublicPlanById(data.id as string);
  if (!plan) {
    throw new Error('下書きの読み込みに失敗しました');
  }
  return plan;
}

export async function publishVersionDraft(planId: string): Promise<PublicPlan> {
  assertVersionsConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const versionRecord = await getVersionRecordForPlan(planId);
  if (!versionRecord) {
    throw new Error('このプランは別バージョンの下書きではありません');
  }
  if (versionRecord.createdBy !== user.id) {
    throw new Error('作成者のみ公開できます');
  }

  const { error } = await supabase
    .from('public_plans')
    .update({
      visibility: 'public',
      updated_at: new Date().toISOString(),
    })
    .eq('id', planId)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(error.message ?? '公開に失敗しました');
  }

  const plan = await getPublicPlanById(planId);
  if (!plan) {
    throw new Error('公開プランの読み込みに失敗しました');
  }
  return plan;
}

export { getCurrentUserId };
