export const PUBLIC_PLAN_IMAGE_BUCKET = 'public-plan-images';
export const PUBLIC_PLAN_IMAGE_MAX_COUNT = 5;

export type PublicPlanImage = {
  id: string;
  publicPlanId: string;
  imageUrl: string;
  storagePath: string;
  orderIndex: number;
  createdAt: string;
};

export type PublishPlanImageDraft = {
  key: string;
  localUri?: string;
  imageUrl?: string;
  storagePath?: string;
  orderIndex: number;
};

export function createEmptyImageDraft(orderIndex: number): PublishPlanImageDraft {
  return {
    key: `draft-${orderIndex}-${Date.now()}`,
    orderIndex,
  };
}

export function getPrimaryPlanImageUrl(
  images: PublicPlanImage[] | undefined,
): string | undefined {
  if (!images || images.length === 0) return undefined;
  const sorted = [...images].sort((a, b) => a.orderIndex - b.orderIndex);
  return sorted[0]?.imageUrl;
}
