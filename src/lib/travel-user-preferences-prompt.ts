import {
  hasTravelUserPreferences,
  type TravelUserPreferences,
} from '@/types/travel-user-preferences';

export function buildTravelUserPreferencesPromptSection(
  prefs: TravelUserPreferences,
): string {
  if (!hasTravelUserPreferences(prefs)) return '';

  const lines = [
    `- 好きなジャンル: ${prefs.favoriteCategories.length ? prefs.favoriteCategories.join('、') : '未設定'}`,
    `- 旅行ペース: ${prefs.travelPace ?? '未設定'}`,
    `- 移動許容: ${prefs.walkingTolerance ?? '未設定'}`,
    `- 予算感: ${prefs.budgetStyle ?? '未設定'}`,
    `- 避けたいもの: ${prefs.avoidThings.length ? prefs.avoidThings.join('、') : '特になし'}`,
    `- よく一緒に行く相手: ${prefs.companionTypes.length ? prefs.companionTypes.join('、') : '未設定'}`,
  ];

  if (prefs.freeTextPreference.trim()) {
    lines.push(`- その他: ${prefs.freeTextPreference.trim()}`);
  }

  return `

## ユーザーの好み（参考情報）
${lines.join('\n')}

重要:
- 上記は普段の傾向です。**今回のプラン入力（personality / mood / companion / 行きたい場所など）を優先**してください
- 好みは補助的なヒントとして使い、無理に全部反映しないこと
- 避けたいものは可能な範囲で配慮すること`;
}

export function buildTripAssistantPreferencesGuidance(prefs: TravelUserPreferences): string {
  if (!hasTravelUserPreferences(prefs)) return '';

  const hints: string[] = [];
  if (prefs.walkingTolerance === '歩き少なめ' || prefs.avoidThings.includes('長時間歩く')) {
    hints.push('徒歩負担の少ない移動・近場提案を優先');
  }
  if (prefs.avoidThings.includes('人混み')) {
    hints.push('混雑スポットは避け、空いている時間帯を提案');
  }
  if (prefs.travelPace === 'ゆっくり') {
    hints.push('詰め込みすぎず、余裕のある提案');
  }
  if (prefs.favoriteCategories.includes('ローカル穴場')) {
    hints.push('観光地より地元感のある選択肢も検討');
  }

  return hints.length
    ? `\n\n【ユーザーの好み診断】\n${buildTravelUserPreferencesPromptSection(prefs)}\n\n提案時の配慮:\n${hints.map((h) => `- ${h}`).join('\n')}`
    : buildTravelUserPreferencesPromptSection(prefs);
}
