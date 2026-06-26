import { formatAmount, getCurrency, type CurrencyCode } from '@/constants/currency';
import { COMPANION_SUBTITLES, PERSONALITY_SUBTITLES } from '@/lib/itineraries';
import { resolveDurationConfig, getDurationDisplayLabel } from '@/lib/trip-duration';
import { formatTripDateRangeLabel } from '@/lib/trip-schedule';
import type { WeatherForecast } from '@/lib/weather';
import { formatTripDateLabel } from '@/lib/weather';
import type { SpontaneousContext } from '@/types/imafima';
import type { CompanionOption, PersonalityOption } from '@/types/plan';
import type { PlanAnalysisInput } from '@/types/plan-analysis';
import type { UserPreferences } from '@/types/user-memory';
import type { TravelMemory } from '@/types/travel-memory';
import { summarizeTravelMemoriesForAnalysis } from '@/lib/travel-memory';
import { formatCombinedMood } from '@/lib/custom-preferences';
import type { PlanCustomPreferences } from '@/types/plan-preferences';

const COMPANION_GUIDE: Record<CompanionOption, string> = {
  一人: '一人旅向け。自分のペースで、内省・発見・静かな時間を大切にした選定。',
  友達: '友達同士。会話が弾む、シェアしやすい、写真も撮りやすいスポットを優先。',
  カップル: 'カップル向け。ロマンチックな雰囲気、二人の時間を邪魔しない選定。',
  初デート: '初デート向け。会話が続きやすく、距離が縮まる、失敗しにくい定番〜準定番。',
  家族: '家族向け。老若男女が楽しめる、移動負担が少なく、休憩しやすいルート。',
};

function analyzeBudget(
  budget: string,
  people: string,
  currency: CurrencyCode,
  tripDuration: string,
): string {
  const amount = parseInt(budget.replace(/[^\d]/g, ''), 10);
  const count = parseInt(people, 10) || 1;
  const { symbol } = getCurrency(currency);

  if (amount <= 0) {
    return `予算未入力のため、${tripDuration}・${count}人に適した**現実的な中価格帯**で提案。各スポットの estimatedCost は相場に基づく概算を記載。`;
  }

  const perPerson = Math.round(amount / count);
  const perDay =
    tripDuration === '1週間'
      ? Math.round(amount / 7)
      : tripDuration === '3泊4日'
        ? Math.round(amount / 4)
        : tripDuration === '2泊3日'
          ? Math.round(amount / 3)
          : tripDuration === '1日'
            ? amount
            : Math.round(amount * 0.85);

  return (
    `総予算 ${formatAmount(amount, currency)}（${count}人・1人あたり約 ${formatAmount(perPerson, currency)}）。` +
    `期間「${tripDuration}」に対し1日あたり目安 ${symbol}${perDay.toLocaleString('ja-JP')} 前後。` +
    `budgetBreakdown で宿泊・食事・交通・アクティビティに**無理のない配分**を行い、合計が予算内に収まるよう調整。`
  );
}

function analyzeWeather(weather?: WeatherForecast): string {
  if (!weather) {
    return (
      '天気データ未取得のため、**屋内・屋外をバランスよく**組み合わせた柔軟なプランに。' +
      '各スポットに weatherBackup（雨の場合の代替）を設定し、rainyDayAlternatives にも具体的な代替ルートを記載。'
    );
  }

  const daySummaries = weather.days
    .map((d) => `${d.label}: ${d.condition}（降水${d.precipitationProbability}%）`)
    .join(' / ');

  let strategy = weather.summary;
  if (weather.hasRainExpected) {
    strategy +=
      ' **雨対策最優先**: 屋内メイン＋屋外は短時間のみ。weatherBackup と rainyDayAlternatives を必ず具体化。';
  } else if (weather.isMostlySunny) {
    strategy += ' **晴れを活かす**: 屋外・テラス・散策を積極的に。雨天時の代替も併記。';
  } else {
    strategy += ' 天候変化に備え、**午前屋内・午後屋外**など切り替えやすい構成を推奨。';
  }

  return `${weather.locationName} — ${daySummaries}。${strategy}`;
}

function analyzePreferences(
  prefs?: UserPreferences,
  currentPersonality?: PersonalityOption,
  travelMemories?: TravelMemory[],
): string {
  const lines: string[] = [];

  if (travelMemories && travelMemories.length > 0) {
    lines.push(`【旅行メモリー・最優先】${summarizeTravelMemoriesForAnalysis(travelMemories)}`);
  }

  if (!prefs?.hasData) {
    if (lines.length === 0) {
      return '過去の利用履歴なし。今回入力された条件のみを最優先で反映。';
    }
    return lines.join('。') + '。矛盾しない範囲で今回プランに反映。';
  }

  if (prefs.favoriteTravelStyle) {
    const matches = prefs.favoriteTravelStyle === currentPersonality;
    lines.push(
      `好みの旅行タイプ: ${prefs.favoriteTravelStyle}${matches ? '（今回と一致）' : `（今回は ${currentPersonality} を優先）`}`,
    );
  }
  if (prefs.budgetPreference) lines.push(`過去の予算傾向: ${prefs.budgetPreference}`);
  if (prefs.preferredTripDuration) lines.push(`好みの期間: ${prefs.preferredTripDuration}`);
  if (prefs.favoriteActivities.length > 0) {
    lines.push(`よく選ぶスポット: ${prefs.favoriteActivities.slice(0, 5).join('、')}`);
  }

  return lines.join('。') + '。矛盾しない範囲で今回プランに反映。';
}

export function buildPreAnalysisBriefing(input: PlanAnalysisInput): string {
  const durationConfig = resolveDurationConfig(input.tripDuration, input.customDuration);
  const durationLabel = getDurationDisplayLabel(input.tripDuration, input.customDuration);
  const dateRange = formatTripDateRangeLabel(input.tripDate, input.tripEndDate);
  const { symbol } = getCurrency(input.currency);
  const people = input.people.trim() || '1';
  const budget = input.budget.trim() || '未指定';
  const moodLine = input.travelIntent?.trim()
    ? `旅行の目的: ${input.travelIntent}`
    : `気分: ${formatCombinedMood(input.mood, input.customPreferences?.customMood) || '未指定'}`;

  return `## ステップ1: コンシェルジュ事前分析（必須・ itinerary 作成前に実施）

以下5項目を分析し、結果を **conciergeAnalysis** に日本語2〜3文ずつ記載してから行程を設計してください。
分析内容は各スポットの reason・予算配分・天候対策に必ず反映すること。

### 1. ユーザー好み（userPreferences）
${analyzePreferences(input.userPreferences, input.personality, input.travelMemories)}

### 2. 天気（weather）
${analyzeWeather(input.weather)}

### 3. 予算（budget）
${analyzeBudget(budget, people, input.currency, input.tripDuration)}

### 4. 期間・日程（tripDuration）
期間: **${durationLabel}**（${durationConfig.dayCount > 1 ? `${durationConfig.dayCount}日構成` : '日帰り'}）
${dateRange ? `日程: **${dateRange}**` : `出発日: **${formatTripDateLabel(input.tripDate)}**`}
方針: ${durationConfig.guide}
スポット数: 各日 ${input.spontaneous?.itemsMin ?? durationConfig.itemsMin}〜${input.spontaneous?.itemsMax ?? durationConfig.itemsMax} 件。移動と滞在のバランスを期間に合わせる。

### 5. 旅行スタイル（travelStyle）
旅行タイプ **${input.personality}**: ${PERSONALITY_SUBTITLES[input.personality]}
同行者 **${input.companion}**: ${COMPANION_GUIDE[input.companion]}
${COMPANION_SUBTITLES[input.companion]}
${moodLine}

### 総合戦略（overallStrategy）
上記5項目を統合した**このプランの設計方針**を2〜4文で記載。エリアの選び方、1日の流れ、予算・天候・同行者への配慮を含める。

---

## ステップ2: プロ級コンシェルジュ行程の作成

分析を踏まえ、高級旅行会社の専属コンシェルジュが手書きしたようなプランを作成してください。

### 各スポット（items）の品質基準
- **reason（選定理由）**: 2〜3文。旅行タイプ・同行者・気分・予算・天候のうち**2つ以上**に触れる。なぜ今の順番かも説明。
- **estimatedCost**: ${symbol}付き。**人数${people}人考慮**の概算（1人あたり内訳がわかる形式推奨）
- **transportation**: 次のスポットへの**具体的な移動手段**（路線名・駅名・徒歩分数・目安料金）
- **travelTimeToNext**: 移動時間の目安（transportation と整合）
- **weatherBackup**: 雨・猛暑・強風時の**代替スポットまたは代替過ごし方**（1文。不要なら「天候に関わらず可」）

### 天候変化時のバックアップ（rainyDayAlternatives）
- **3〜5件**、具体的な**実在スポット名**と「いつ・何の代わりに使うか」を記載
- 例: 「雨の場合: 代々木公園の代わりに国立新美術館（屋内・${symbol}1,000程度）」

### plannerMessage
分析結果への共感と、プラン全体の**コンシェルジュとしての提案意図**を温かく2〜3文で。`;
}
