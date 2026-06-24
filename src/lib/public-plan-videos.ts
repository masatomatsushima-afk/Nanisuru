import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  INVALID_VIDEO_URL_MESSAGE,
  PUBLIC_PLAN_VIDEO_MAX_COUNT,
  type PublicPlanVideo,
  type PublishPlanVideoDraft,
  type VideoPlatform,
} from '@/types/public-plan-video';

type PublicPlanVideoRow = {
  id: string;
  public_plan_id: string;
  video_url: string;
  platform: VideoPlatform;
  order_index: number;
  created_at: string;
};

function assertVideosConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      '動画リンクには Supabase の設定が必要です。\npublic_plan_videos テーブルを作成してください。',
    );
  }
}

function rowToVideo(row: PublicPlanVideoRow): PublicPlanVideo {
  return {
    id: row.id,
    publicPlanId: row.public_plan_id,
    videoUrl: row.video_url,
    platform: row.platform,
    orderIndex: row.order_index,
    createdAt: row.created_at,
  };
}

export function normalizeVideoUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function detectVideoPlatform(raw: string): VideoPlatform | null {
  const normalized = normalizeVideoUrl(raw);
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
      return 'Instagram';
    }

    if (
      host === 'tiktok.com' ||
      host === 'vm.tiktok.com' ||
      host.endsWith('.tiktok.com')
    ) {
      return 'TikTok';
    }

    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtu.be' ||
      host.endsWith('.youtube.com')
    ) {
      return 'YouTube';
    }

    return null;
  } catch {
    return null;
  }
}

export function parseVideoUrl(raw: string): { videoUrl: string; platform: VideoPlatform } | null {
  const normalized = normalizeVideoUrl(raw);
  const platform = detectVideoPlatform(normalized);
  if (!platform) return null;
  return { videoUrl: normalized, platform };
}

export function validateVideoDrafts(drafts: PublishPlanVideoDraft[]): string | null {
  const filled = drafts.filter((draft) => draft.videoUrl.trim());
  if (filled.length > PUBLIC_PLAN_VIDEO_MAX_COUNT) {
    return `動画リンクは最大${PUBLIC_PLAN_VIDEO_MAX_COUNT}件までです`;
  }

  for (const draft of filled) {
    if (!parseVideoUrl(draft.videoUrl)) {
      return INVALID_VIDEO_URL_MESSAGE;
    }
  }

  return null;
}

export async function fetchVideosForPlan(publicPlanId: string): Promise<PublicPlanVideo[]> {
  assertVideosConfigured();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('public_plan_videos')
    .select('id, public_plan_id, video_url, platform, order_index, created_at')
    .eq('public_plan_id', publicPlanId)
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(error.message ?? '動画リンクの取得に失敗しました');
  }

  return (data as PublicPlanVideoRow[]).map(rowToVideo);
}

export async function fetchVideosForPlans(
  publicPlanIds: string[],
): Promise<Map<string, PublicPlanVideo[]>> {
  assertVideosConfigured();

  const uniqueIds = [...new Set(publicPlanIds.filter(Boolean))];
  const map = new Map<string, PublicPlanVideo[]>();
  if (uniqueIds.length === 0) return map;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('public_plan_videos')
    .select('id, public_plan_id, video_url, platform, order_index, created_at')
    .in('public_plan_id', uniqueIds)
    .order('order_index', { ascending: true });

  if (error || !data) return map;

  for (const row of data as PublicPlanVideoRow[]) {
    const video = rowToVideo(row);
    const existing = map.get(video.publicPlanId) ?? [];
    existing.push(video);
    map.set(video.publicPlanId, existing);
  }

  return map;
}

export async function syncPublicPlanVideos(
  publicPlanId: string,
  drafts: PublishPlanVideoDraft[],
): Promise<PublicPlanVideo[]> {
  assertVideosConfigured();

  const validationError = validateVideoDrafts(drafts);
  if (validationError) {
    throw new Error(validationError);
  }

  const supabase = getSupabase();
  const filled = drafts
    .map((draft) => {
      const parsed = parseVideoUrl(draft.videoUrl);
      if (!parsed) return null;
      return {
        ...draft,
        videoUrl: parsed.videoUrl,
        platform: parsed.platform,
      };
    })
    .filter(Boolean) as PublishPlanVideoDraft[];

  const { error: deleteError } = await supabase
    .from('public_plan_videos')
    .delete()
    .eq('public_plan_id', publicPlanId);

  if (deleteError) {
    throw new Error(deleteError.message ?? '既存の動画リンク更新に失敗しました');
  }

  if (filled.length === 0) return [];

  const saved: PublicPlanVideo[] = [];

  for (let index = 0; index < filled.length; index += 1) {
    const draft = filled[index];
    const { data, error } = await supabase
      .from('public_plan_videos')
      .insert({
        public_plan_id: publicPlanId,
        video_url: draft.videoUrl,
        platform: draft.platform,
        order_index: index,
      })
      .select('id, public_plan_id, video_url, platform, order_index, created_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? '動画リンクの保存に失敗しました');
    }

    saved.push(rowToVideo(data as PublicPlanVideoRow));
  }

  return saved;
}

export function draftsFromPublicPlanVideos(videos: PublicPlanVideo[]): PublishPlanVideoDraft[] {
  return [...videos]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((video, index) => ({
      key: video.id,
      videoUrl: video.videoUrl,
      platform: video.platform,
      orderIndex: index,
    }));
}

export function createEmptyVideoDraft(orderIndex: number): PublishPlanVideoDraft {
  return {
    key: `video-draft-${orderIndex}-${Date.now()}`,
    videoUrl: '',
    platform: 'YouTube',
    orderIndex,
  };
}
