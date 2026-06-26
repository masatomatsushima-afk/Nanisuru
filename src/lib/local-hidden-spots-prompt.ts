import type { LocalHiddenSpot } from '@/types/local-hidden-spot';
import { getLocalHiddenSpotCategoryIcon } from '@/types/local-hidden-spot';

export function buildLocalHiddenSpotsPromptSection(spots: LocalHiddenSpot[]): string {
  if (spots.length === 0) return '';

  const lines = spots.map((spot, index) => {
    const icon = getLocalHiddenSpotCategoryIcon(spot.category);
    const tags = spot.tags.length > 0 ? ` [${spot.tags.join('・')}]` : '';
    const contributor = spot.isLocalContributor ? '（ローカル投稿者）' : '';
    const parts = [
      `${index + 1}. ${icon} **${spot.name}**（${spot.area} / ${spot.category}）${contributor}${tags}`,
      `   理由: ${spot.description}`,
    ];
    if (spot.bestTime.trim()) parts.push(`   ベスト時間: ${spot.bestTime}`);
    if (spot.estimatedBudget.trim()) parts.push(`   予算目安: ${spot.estimatedBudget}`);
    if (spot.crowdTip.trim()) parts.push(`   混雑: ${spot.crowdTip}`);
    if (spot.caution.trim()) parts.push(`   注意: ${spot.caution}`);
    if (spot.googleMapsUrl.trim()) parts.push(`   Maps: ${spot.googleMapsUrl}`);
    return parts.join('\n');
  });

  return `

## ローカルの穴場スポット（Discover · 現地投稿 ★優先候補★）
ユーザーは穴場・ローカル感・観光客の少ない場所を希望しています。
以下は地元ユーザーの投稿です。**可能な限り itinerary に組み込む**こと（無理な場合は近いエリアの代替を reason に記載）。

${lines.join('\n\n')}

ルール:
- 投稿スポット名をそのまま activity に使う（架空名に置き換えない）
- ローカル投稿者バッジ付きは credibility 高 — reason で「地元のおすすめ」と伝える
- 個人住所・非公開施設は使わない（公開店舗・施設のみ）
- 穴場希望でも食事偏重にならないよう、他カテゴリとバランスを取る`;
}
