import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { PublicPlanVisibility } from '@/types/public-plan';
import {
  PUBLIC_PLAN_IMAGE_BUCKET,
  PUBLIC_PLAN_IMAGE_MAX_COUNT,
  type PublicPlanImage,
  type PublishPlanImageDraft,
} from '@/types/public-plan-image';

type PublicPlanImageRow = {
  id: string;
  public_plan_id: string;
  image_url: string;
  storage_path: string;
  order_index: number;
  created_at: string;
};

function assertImagesConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      '画像アップロードには Supabase の設定が必要です。\npublic_plan_images テーブルと Storage バケットを作成してください。',
    );
  }
}

function rowToImage(row: PublicPlanImageRow): PublicPlanImage {
  return {
    id: row.id,
    publicPlanId: row.public_plan_id,
    imageUrl: row.image_url,
    storagePath: row.storage_path,
    orderIndex: row.order_index,
    createdAt: row.created_at,
  };
}

function guessContentType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.heic')) return 'image/heic';
  return 'image/jpeg';
}

function buildStoragePath(userId: string, publicPlanId: string, orderIndex: number, uri: string): string {
  const extension = guessContentType(uri).split('/')[1] ?? 'jpg';
  return `${userId}/${publicPlanId}/${orderIndex}-${Date.now()}.${extension}`;
}

async function uploadLocalImage(
  localUri: string,
  storagePath: string,
): Promise<string> {
  const supabase = getSupabase();
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();
  const contentType = guessContentType(localUri);

  const { error } = await supabase.storage.from(PUBLIC_PLAN_IMAGE_BUCKET).upload(storagePath, arrayBuffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(error.message ?? '画像のアップロードに失敗しました');
  }

  const { data } = supabase.storage.from(PUBLIC_PLAN_IMAGE_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function deleteStorageObject(storagePath: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(PUBLIC_PLAN_IMAGE_BUCKET).remove([storagePath]);
  if (error) {
    throw new Error(error.message ?? '画像の削除に失敗しました');
  }
}

export async function fetchImagesForPlan(publicPlanId: string): Promise<PublicPlanImage[]> {
  assertImagesConfigured();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('public_plan_images')
    .select('id, public_plan_id, image_url, storage_path, order_index, created_at')
    .eq('public_plan_id', publicPlanId)
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(error.message ?? '画像の取得に失敗しました');
  }

  return (data as PublicPlanImageRow[]).map(rowToImage);
}

export async function fetchImagesForPlans(
  publicPlanIds: string[],
): Promise<Map<string, PublicPlanImage[]>> {
  assertImagesConfigured();

  const uniqueIds = [...new Set(publicPlanIds.filter(Boolean))];
  const map = new Map<string, PublicPlanImage[]>();
  if (uniqueIds.length === 0) return map;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('public_plan_images')
    .select('id, public_plan_id, image_url, storage_path, order_index, created_at')
    .in('public_plan_id', uniqueIds)
    .order('order_index', { ascending: true });

  if (error || !data) return map;

  for (const row of data as PublicPlanImageRow[]) {
    const image = rowToImage(row);
    const existing = map.get(image.publicPlanId) ?? [];
    existing.push(image);
    map.set(image.publicPlanId, existing);
  }

  return map;
}

export async function syncPublicPlanImages(
  publicPlanId: string,
  userId: string,
  drafts: PublishPlanImageDraft[],
  visibility: PublicPlanVisibility,
): Promise<PublicPlanImage[]> {
  assertImagesConfigured();

  if (drafts.length > PUBLIC_PLAN_IMAGE_MAX_COUNT) {
    throw new Error(`画像は最大${PUBLIC_PLAN_IMAGE_MAX_COUNT}枚までです`);
  }

  const supabase = getSupabase();
  const existing = await fetchImagesForPlan(publicPlanId);
  const keptStoragePaths = new Set(
    drafts.filter((draft) => draft.storagePath).map((draft) => draft.storagePath as string),
  );

  for (const image of existing) {
    if (!keptStoragePaths.has(image.storagePath)) {
      await deleteStorageObject(image.storagePath);
    }
  }

  const { error: deleteError } = await supabase
    .from('public_plan_images')
    .delete()
    .eq('public_plan_id', publicPlanId);

  if (deleteError) {
    throw new Error(deleteError.message ?? '既存画像の更新に失敗しました');
  }

  if (visibility === 'private' && drafts.length === 0) {
    return [];
  }

  const savedImages: PublicPlanImage[] = [];

  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index];
    let imageUrl = draft.imageUrl;
    let storagePath = draft.storagePath;

    if (draft.localUri) {
      storagePath = buildStoragePath(userId, publicPlanId, index, draft.localUri);
      imageUrl = await uploadLocalImage(draft.localUri, storagePath);
    }

    if (!imageUrl || !storagePath) continue;

    const { data, error } = await supabase
      .from('public_plan_images')
      .insert({
        public_plan_id: publicPlanId,
        image_url: imageUrl,
        storage_path: storagePath,
        order_index: index,
      })
      .select('id, public_plan_id, image_url, storage_path, order_index, created_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? '画像情報の保存に失敗しました');
    }

    savedImages.push(rowToImage(data as PublicPlanImageRow));
  }

  return savedImages;
}

export function draftsFromPublicPlanImages(images: PublicPlanImage[]): PublishPlanImageDraft[] {
  return [...images]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((image, index) => ({
      key: image.id,
      imageUrl: image.imageUrl,
      storagePath: image.storagePath,
      orderIndex: index,
    }));
}
