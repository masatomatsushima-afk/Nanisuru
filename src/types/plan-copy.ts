export type PlanCopyMetadata = {
  inspiredByDisplayName: string;
  sourcePublicPlanId: string;
  sourceCreatorUserId: string;
  sourcePublicPlanTitle?: string;
};

export const PLAN_AI_ADJUST_PRESETS = [
  {
    id: 'cheaper',
    label: '予算を安くして',
    instruction: '予算を抑え、コスパの良いスポット中心にプランを組み直してください。高額な体験は避け、費用見積もりも現実的に下げてください。',
  },
  {
    id: 'date',
    label: 'デート向けにして',
    instruction: 'カップル・初デート向けのロマンチックな雰囲気に調整してください。会話が弾む場所、二人だけの時間を大切にした行程にしてください。',
  },
  {
    id: 'rainy',
    label: '雨の日向けにして',
    instruction: '雨や悪天候でも楽しめる屋内中心のプランに調整してください。weatherBackup も充実させ、移動も最小限にしてください。',
  },
  {
    id: 'less_travel',
    label: '移動を少なくして',
    instruction: '移動時間と乗り換えを最小限にし、近いエリアにスポットを集約してください。各スポット間の交通手段も具体的に短距離で。',
  },
  {
    id: 'night_view',
    label: '夜景を追加して',
    instruction: '夜景やライトアップスポットを行程に追加・強調してください。夕方以降の時間帯も活かしたプランにしてください。',
  },
  {
    id: 'gourmet',
    label: 'グルメ多めにして',
    instruction: '食事・カフェ・スイーツなどグルメ体験を増やし、各スポットの「食」が主役になるように調整してください。',
  },
] as const;

export type PlanAiAdjustPresetId = (typeof PLAN_AI_ADJUST_PRESETS)[number]['id'];
