export const SHARED_REACTION_TYPES = [
  '行きたい',
  '微妙',
  'ここ良い',
  '変更したい',
  '高そう',
  '楽しそう',
] as const;

export type SharedReactionType = (typeof SHARED_REACTION_TYPES)[number];

export type SharedReactionCounts = Record<SharedReactionType, number>;

export type SharedReactionMeta = {
  type: SharedReactionType;
  emoji: string;
  hint: string;
};

export const SHARED_REACTION_META: readonly SharedReactionMeta[] = [
  { type: '行きたい', emoji: '🙌', hint: '行ってみたい！' },
  { type: '微妙', emoji: '😐', hint: 'ちょっと微妙…' },
  { type: 'ここ良い', emoji: '👍', hint: 'このスポットいいね' },
  { type: '変更したい', emoji: '✏️', hint: 'ここを変えたい' },
  { type: '高そう', emoji: '💸', hint: '予算が心配' },
  { type: '楽しそう', emoji: '🎉', hint: '楽しそう！' },
];
