export const PUBLIC_PLAN_REQUEST_TYPES = [
  { id: 'cheaper', label: 'もっと安くしてほしい' },
  { id: 'less_travel', label: '移動少なめがいい' },
  { id: 'rainy_day', label: '雨の日版がほしい' },
  { id: 'date_oriented', label: 'デート向けにしてほしい' },
  { id: 'night_plan', label: '夜プランも見たい' },
  { id: 'more_gourmet', label: 'グルメ多めがいい' },
] as const;

export type PublicPlanRequestType = (typeof PUBLIC_PLAN_REQUEST_TYPES)[number]['id'];

export type PublicPlanComment = {
  id: string;
  publicPlanId: string;
  userId: string;
  commentText: string;
  createdAt: string;
  displayName: string;
};

export type PublicPlanRequestCounts = Record<PublicPlanRequestType, number>;

export type PublicPlanRequestSummary = {
  counts: PublicPlanRequestCounts;
  myRequestTypes: PublicPlanRequestType[];
  totalCount: number;
};

export function createEmptyRequestCounts(): PublicPlanRequestCounts {
  return {
    cheaper: 0,
    less_travel: 0,
    rainy_day: 0,
    date_oriented: 0,
    night_plan: 0,
    more_gourmet: 0,
  };
}

export function getRequestTypeLabel(requestType: PublicPlanRequestType): string {
  return (
    PUBLIC_PLAN_REQUEST_TYPES.find((item) => item.id === requestType)?.label ?? requestType
  );
}

export const PUBLIC_PLAN_VERSION_SHORT_LABELS: Record<PublicPlanRequestType, string> = {
  rainy_day: '雨の日版',
  cheaper: '低予算版',
  less_travel: '移動少なめ版',
  night_plan: '夜デート版',
  date_oriented: 'デート版',
  more_gourmet: 'グルメ版',
};

export const PUBLIC_PLAN_VERSION_AI_INSTRUCTIONS: Record<PublicPlanRequestType, string> = {
  rainy_day:
    '雨や悪天候でも楽しめる屋内中心のプランに全面調整してください。weatherBackup を充実させ、移動も最小限にしてください。',
  cheaper:
    '予算を抑え、コスパの良いレストラン・アクティビティ中心に組み直してください。高額な体験は避け、費用見積もりも現実的に下げてください。',
  less_travel:
    '移動時間と乗り換えを最小限にし、近いエリアにスポットを集約してください。スポット数も適度に絞ってください。',
  night_plan:
    '夕方以降の夜時間帯を活かしたプランに調整してください。夜景、ライトアップ、バー、ナイトスポットを中心に組んでください。',
  date_oriented:
    'カップル・初デート向けのロマンチックな雰囲気に調整してください。会話が弾む場所、二人だけの時間を大切にした行程にしてください。',
  more_gourmet:
    '食事・カフェ・スイーツなどグルメ体験を増やし、各スポットの「食」が主役になるように調整してください。',
};

export type PublicPlanVersion = {
  id: string;
  originalPublicPlanId: string;
  versionPublicPlanId: string;
  versionType: PublicPlanRequestType;
  createdBy: string;
  createdAt: string;
};

import type { PublicPlan } from '@/types/public-plan';

export type PublicPlanVersionWithPlan = PublicPlanVersion & {
  plan: PublicPlan;
};

export function getVersionShortLabel(versionType: PublicPlanRequestType): string {
  return PUBLIC_PLAN_VERSION_SHORT_LABELS[versionType] ?? versionType;
}
