import type { CompanionOption, ItineraryItem, PlanDetails, PlanParams } from '@/types/plan';

function parseTimeMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatDuration(items: ItineraryItem[]): string {
  if (items.length === 0) return '約1時間';
  const start = parseTimeMinutes(items[0].time);
  const end = parseTimeMinutes(items[items.length - 1].time);
  const totalMinutes = Math.max(end - start, 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `約${hours}時間`;
  return `約${hours}時間${minutes}分`;
}

function formatBudget(budget: string, people: string, companion: CompanionOption): string {
  const amount = parseInt(budget.replace(/[^\d]/g, ''), 10);
  const count = parseInt(people, 10) || 1;

  if (amount > 0) {
    const perPerson = Math.round(amount / count);
    return count > 1
      ? `約 ¥${amount.toLocaleString('ja-JP')}（1人あたり ¥${perPerson.toLocaleString('ja-JP')}）`
      : `約 ¥${amount.toLocaleString('ja-JP')}`;
  }

  const estimates: Record<CompanionOption, number> = {
    一人: 5000,
    友達: 8000,
    カップル: 12000,
    初デート: 15000,
    家族: 10000,
  };

  const total = estimates[companion] * count;
  return `約 ¥${total.toLocaleString('ja-JP')}（目安）`;
}

function getHighlights(location: string, companion: CompanionOption, items: ItineraryItem[]): string[] {
  const spot = location.includes('大阪')
    ? '大阪'
    : location.includes('東京')
      ? '東京'
      : 'エリア';

  const activityHint = items.map((item) => item.activity).slice(0, 2).join('・');

  const companionTips: Record<CompanionOption, string> = {
    一人: '自分のペースで無理なく回れる立て方にしています',
    友達: '移動時間を短くして、会話時間を多めに確保しています',
    カップル: '落ち着いたスポットと夜景を組み合わせたコースです',
    初デート: '初対面でも話題が途切れにくい定番スポットを厳選しました',
    家族: '小さなお子さん連れでも負担が少ない動線です',
  };

  return [
    `${spot}の人気エリア（${activityHint}）を効率よく巡るコース`,
    companionTips[companion],
    'ランチ前後の空白時間を少なめにし、移動のストレスを抑えています',
  ];
}

function getRainyAlternatives(location: string, companion: CompanionOption): string[] {
  if (location.includes('大阪')) {
    return [
      '海遊館やキッズプラザ大阪など屋内施設を中心に再構成',
      '梅田のショッピングモールでカフェ・映画・ディナーを完結',
      '道頓堀周辺の屋内フードコートで食べ歩きプランに切り替え',
    ];
  }

  if (location.includes('東京')) {
    return [
      'スカイツリー・浅草の屋内スポットを中心に再構成',
      '渋谷のショッピング施設内でカフェ・映画・ディナーを完結',
      '美術館や水族館など雨でも楽しめる屋内施設に差し替え',
    ];
  }

  const generic: Record<CompanionOption, string[]> = {
    一人: ['駅近のブックカフェで読書', 'ショッピングモール内の映画館', '近場のラーメン店で温まる'],
    友達: ['屋内アミューズメント施設', 'ショッピングモールで食べ歩き', 'カラオケ＋居酒屋'],
    カップル: ['美術館やギャラリー', 'ホテルラウンジでカフェ', '映画館＋ディナー'],
    初デート: ['水族館や博物館', '駅ビル内のカフェ＆ランチ', '屋内展望スポット'],
    家族: ['科学館やキッズ施設', 'ショッピングモール', '屋内プレイグラウンド'],
  };

  return generic[companion];
}

export function buildPlanDetails(params: PlanParams): PlanDetails {
  return {
    totalBudget: formatBudget(params.budget, params.people, params.companion),
    duration: formatDuration(params.items),
    highlights: getHighlights(params.location, params.companion, params.items),
    rainyDayAlternatives: getRainyAlternatives(params.location, params.companion),
  };
}
