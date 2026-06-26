import type { CurrencyCode } from '@/constants/currency';
import { getCurrency } from '@/constants/currency';
import type { CompanionOption, ItineraryDay, PersonalityOption, PlanDetails, TripDurationOption } from '@/types/plan';
import { isDateRelatedCompanion } from '@/types/plan';
import type { SpontaneousContext } from '@/types/imafima';
import type { BestDayContext } from '@/types/best-day';

import { buildImaHimaPromptSection, resolveMoodPreferences } from './imafima';
import { buildBestDayPromptSection } from './best-day';
import { buildPreAnalysisBriefing } from './plan-analysis';
import { getDurationDisplayLabel, resolveDurationConfig } from './trip-duration';
import type { CustomTripDuration } from '@/types/trip-schedule';
import type { WeatherForecast } from './weather';
import { formatTripDateLabel } from './weather';
import { buildUserMemoryPromptSection } from './user-memory';
import { buildTravelMemoryPromptSection } from './travel-memory';
import { buildRealPlacesPromptSection } from './location-places';
import type { UserPreferences } from '@/types/user-memory';
import type { TravelMemory } from '@/types/travel-memory';
import type { LocalHiddenSpot } from '@/types/local-hidden-spot';
import type { NearbyPlacesContext } from '@/types/nearby-places';
import type { PlanCustomPreferences } from '@/types/plan-preferences';
import type { PlanCreationType } from '@/types/plan-creation';
import { buildCustomPreferencesPromptSection, formatCombinedMood } from './custom-preferences';
import { buildPlanCreationPromptSection, formatCombinedTravelIntent } from './plan-creation';
import { buildVagueLocationPromptSection } from './location-input-copy';
import { buildLocalHiddenSpotsPromptSection } from './local-hidden-spots-prompt';
import { resolveEffectiveMoodForPrompt } from './plan-generation-log';
import {
  buildFoodHeavyRebalanceInstruction,
  buildHumanRhythmPromptSection,
} from './itinerary-balance';
import {
  buildItineraryDiversityPromptSection,
  buildItineraryQualityFixInstruction,
  buildTourSuggestionPromptSection,
  buildTravelTimingPromptSection,
} from './itinerary-quality';
import type { BudgetScopeSettings } from '@/types/budget-scope';
import type { TravelTimingSettings } from '@/types/travel-timing';
import type { OutfitStyleMode } from '@/types/outfit-advice';
import { buildBudgetScopePromptSection } from './budget-scope';
import { ITINERARY_ACTIVITY_CATEGORIES } from './itinerary-balance';

export type PlanInput = {
  location: string;
  budget: string;
  currency: CurrencyCode;
  people: string;
  companion: CompanionOption;
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
  tripDate: string;
  tripEndDate?: string;
  customDuration?: CustomTripDuration;
  mood: string;
  customPreferences?: PlanCustomPreferences;
  weather?: WeatherForecast;
  userPreferences?: UserPreferences;
  travelMemories?: TravelMemory[];
  localHiddenSpots?: LocalHiddenSpot[];
  realPlaces?: NearbyPlacesContext;
  avoidActivities?: string[];
  spontaneous?: SpontaneousContext;
  bestDay?: BestDayContext;
  planAdjustment?: {
    instruction: string;
    baseDays: ItineraryDay[];
    baseDetails: PlanDetails;
    notes?: string;
  };
  itineraryBalanceFix?: {
    baseDays: ItineraryDay[];
    baseDetails: PlanDetails;
  };
  itineraryQualityFix?: {
    baseDays: ItineraryDay[];
    baseDetails: PlanDetails;
    issues: string[];
    targetDayNumbers?: number[];
  };
  travelTiming?: TravelTimingSettings;
  planCreationType?: PlanCreationType;
  travelIntent?: string;
  travelPurpose?: string;
  planType?: PlanCreationType;
  departureDate?: string;
  returnDate?: string;
  durationLabel?: string;
  companionType?: CompanionOption;
  mustVisitPlaces?: string;
  avoidPreferences?: string;
  budgetScope?: BudgetScopeSettings;
  abortSignal?: AbortSignal;
  outfitStyleMode?: OutfitStyleMode;
};

const PERSONALITY_GUIDE: Record<PersonalityOption, string> = {
  冒険家:
    'アクティビティ・体験型スポットを中心に（ハイキング、体験施設、非日常体験、ローカルな冒険）。' +
    '定番観光より「試したことのないこと」を優先。移動に余裕を持たせ、体力を使う要素を入れる。',
  グルメ:
    '食事・グルメをプランの主役に（名店、B級グルメ、市場、スイーツ、地元の名物料理）。' +
    'ランチ・カフェ・ディナーに十分な時間を配し、各スポットの「食」が選定理由の中心になるようにする。',
  のんびり:
    'スポット数は少なめ、各所の滞在時間を長めに。カフェ、公園、温泉、のんびり散策を中心に。' +
    '移動は最小限。時間に余白を持たせ、「急がない」ペースで組む。',
  映え重視:
    '写真映えするスポットを最優先（絶景、おしゃれカフェ、ネオン街、フォトスポット、デザイン性の高い施設）。' +
    '各スポットの選定理由に「映えるポイント」を必ず含める。光の条件（夕方の黄金時間など）も考慮する。',
  穴場好き:
    'メジャー観光地・行列店は避け、地元民向けの店、路地裏、小さなギャラリー、知る人ぞ知る名所を選ぶ。' +
    '「観光客が少ない」「地元の人が通う」理由を各スポットで説明する。',
};

export function buildConciergePrompt(input: PlanInput): string {
  const normalized = {
    planType: input.planCreationType ?? input.planType,
    location: input.location.trim() || '未指定',
    departureDate: input.departureDate ?? input.tripDate,
    returnDate: input.returnDate ?? input.tripEndDate ?? input.tripDate,
    budget: input.budget.trim() || '未指定',
    people: input.people.trim() || '未指定',
    mood: input.mood?.trim() ?? '',
    travelPurpose:
      input.travelPurpose?.trim() ||
      formatCombinedTravelIntent(
        (input.travelIntent ?? '') as import('@/types/plan-creation').TravelIntentOption | '',
        input.customPreferences?.customTravelIntent,
      ),
    mustVisitPlaces:
      input.mustVisitPlaces?.trim() || input.customPreferences?.desiredPlaces?.trim() || '',
    avoidPreferences:
      input.avoidPreferences?.trim() || input.customPreferences?.avoidPreferences?.trim() || '',
  };

  const location = normalized.location;
  const budget = normalized.budget;
  const people = normalized.people;
  const mood = formatCombinedMood(input.mood, input.customPreferences?.customMood) || '未指定';
  const travelIntent = normalized.travelPurpose || '未指定';
  const isTravelPlan =
    normalized.planType === '旅行プラン' || normalized.planType === '週末プラン';
  const isOutingPlan =
    normalized.planType === '今日のお出かけ' || normalized.planType === 'デートプラン';
  const effectiveMood = resolveEffectiveMoodForPrompt({
    planType: normalized.planType,
    location: normalized.location,
    departureDate: normalized.departureDate,
    returnDate: normalized.returnDate,
    durationLabel: input.durationLabel ?? '',
    tripDuration: input.tripDuration,
    customDuration: input.customDuration,
    budget: normalized.budget,
    currency: input.currency,
    people: normalized.people,
    companion: input.companion,
    personality: input.personality,
    mood: formatCombinedMood(input.mood, input.customPreferences?.customMood),
    travelPurpose: normalized.travelPurpose,
    mustVisitPlaces: normalized.mustVisitPlaces,
    avoidPreferences: normalized.avoidPreferences,
    customPreferences: input.customPreferences,
  });
  const { symbol, label } = getCurrency(input.currency);
  const personalityGuide = PERSONALITY_GUIDE[input.personality];
  const includeAiAdvice = isDateRelatedCompanion(input.companion);
  const durationConfig = resolveDurationConfig(input.tripDuration, input.customDuration);
  const durationLabel = getDurationDisplayLabel(input.tripDuration, input.customDuration);
  const departureDate = input.tripDate;
  const returnDate = input.tripEndDate ?? input.tripDate;
  const itemsMin = input.spontaneous?.itemsMin ?? durationConfig.itemsMin;
  const itemsMax = input.spontaneous?.itemsMax ?? durationConfig.itemsMax;
  const isMultiDay = durationConfig.dayCount > 1 && !input.spontaneous;
  const dayLabel =
    input.spontaneous?.dayLabel ??
    (input.tripDuration === '半日' ? '半日プラン' : '1日目');

  const dateAdviceSection = includeAiAdvice
    ? `

## デート向けAIアドバイス（必須・すべて日本語）
「${input.companion}」同士のお出かけ向けに、上記プランのスポット内容を踏まえて aiAdvice を作成してください。
- **conversationTips（会話のヒント）**: 3〜4件。自然に会話が続く具体的なヒント。プランの場所・体験に触れること。
- **recommendedTopics（おすすめの話題）**: 3〜4件。その日のプランや相手との関係性に合った話題。
- **topicsToAvoid（避けた方がいい話題）**: 2〜3件。${input.companion === '初デート' ? '初デートで盛り上がりにくい・距離が縮まらない' : 'カップルのデートで雰囲気を損なう'}話題。

トーンは温かく、押し付けがましくない日本語にしてください。`
    : '';

  const aiAdviceJson = includeAiAdvice
    ? `,
  "aiAdvice": {
    "conversationTips": ["会話のヒント1", "ヒント2", "ヒント3"],
    "recommendedTopics": ["おすすめの話題1", "話題2", "話題3"],
    "topicsToAvoid": ["避けた方がいい話題1", "話題2"]
  }`
    : '';

  const variationSection =
    input.avoidActivities && input.avoidActivities.length > 0
      ? `

## 別プラン提案（最重要）
お客様にはすでに以下のスポットを含むプランを提案済みです。**これらの店名・施設名・スポットは一切使わないでください。** 同じ条件（場所・予算・期間・誰と・旅行タイプ・気分）を維持しつつ、全く異なるルート・体験の新しいプランを作成してください。

前回提案済み（使用禁止）:
${input.avoidActivities.map((name) => `- ${name}`).join('\n')}

- 上記と同名・同系統の店舗も避け、別エリアや別ジャンルも積極的に検討すること
- 旅行タイプ「${input.personality}」の方針は維持し、前回とは違う魅力が伝わるプランにすること`
      : '';

  const adjustmentSection = input.planAdjustment
    ? `

## プラン調整（最重要）
お客様は公開プランをベースに、自分用にカスタマイズしています。
**ベースプランの良さを活かしつつ**、以下の調整指示に従ってプラン全体を更新してください。
元の作成者クレジットはアプリ側で表示するため、JSON内には含めないでください。

### 調整指示
${input.planAdjustment.instruction}

### 現在のベースプラン
${JSON.stringify(
  {
    days: input.planAdjustment.baseDays,
    totalBudget: input.planAdjustment.baseDetails.totalBudget,
    duration: input.planAdjustment.baseDetails.duration,
    highlights: input.planAdjustment.baseDetails.highlights,
  },
  null,
  2,
)}

${input.planAdjustment.notes?.trim() ? `### ユーザーメモ\n${input.planAdjustment.notes.trim()}` : ''}

- 画面上で編集された条件（場所・予算・人数・同行者・気分・行きたい/避けたい場所）を最優先すること
- 調整指示に沿って timeline・費用・選定理由を更新すること
- ベースプランの良い要素は残しつつ、指示に沿って改善すること`
    : '';

  const balanceFixSection = input.itineraryBalanceFix
    ? `\n\n${buildFoodHeavyRebalanceInstruction(input.itineraryBalanceFix.baseDays)}`
    : '';

  const qualityFixSection = input.itineraryQualityFix
    ? `\n\n${buildItineraryQualityFixInstruction({
        isValid: false,
        duplicatePlaces: [],
        categoryCounts: {},
        areaDistribution: {},
        balanceIssues: [],
        arrivalDepartureIssues: [],
        diversityIssues: [],
        issues: input.itineraryQualityFix.issues,
      })}${
        input.itineraryQualityFix.targetDayNumbers?.length
          ? `\n\n**重要**: Day ${input.itineraryQualityFix.targetDayNumbers.join(', Day ')} のみ修正し、他の日の timeline は baseDays をそのまま維持すること。`
          : ''
      }`
    : '';

  const diversitySection =
    isMultiDay && isTravelPlan
      ? `\n\n${buildItineraryDiversityPromptSection(durationConfig.dayCount)}`
      : isMultiDay
        ? `\n\n${buildItineraryDiversityPromptSection(durationConfig.dayCount)}`
        : '';

  const travelTimingSection =
    isTravelPlan && durationConfig.dayCount >= 2
      ? `\n\n${buildTravelTimingPromptSection(input.travelTiming, durationConfig.dayCount)}`
      : '';

  const tourSuggestionSection =
    isTravelPlan && durationConfig.dayCount >= 3
      ? `\n\n${buildTourSuggestionPromptSection(durationConfig.dayCount, location)}`
      : '';

  const humanRhythmSection = buildHumanRhythmPromptSection({
    personality: input.personality,
    companion: input.companion,
    mood: input.mood,
    customPreferences: input.customPreferences,
  });

  const activityCategoryGuide = ITINERARY_ACTIVITY_CATEGORIES.join(' / ');

  const daysJsonExample = isMultiDay
    ? `"days": [
    {
      "dayNumber": 1,
      "label": "1日目",
      "theme": "到着・市内散策",
      "items": [
        {
          "time": "10:00",
          "activity": "実在店名・施設名",
          "activityCategory": "散歩",
          "placeCategory": "観光スポット",
          "reason": "選定理由（2〜3文・分析反映）",
          "estimatedCost": "概算（${symbol}・人数考慮）",
          "transportation": "具体的な移動手段（路線・駅名・料金目安）",
          "reservationUrl": "予約URL（不要なら空文字）",
          "websiteUrl": "公式サイトURL（不明なら空文字）",
          "travelTimeToNext": "約15分（徒歩800m）",
          "weatherBackup": "雨の場合: 代替スポットまたは過ごし方"
        }
      ]
    }
  ]`
    : `"days": [
    {
      "dayNumber": 1,
      "label": "${dayLabel}",
      "theme": "プランのテーマ（例：グルメと散策）",
      "items": [
        {
          "time": "10:00",
          "activity": "実在店名・施設名",
          "activityCategory": "散歩",
          "placeCategory": "観光スポット",
          "reason": "選定理由（2〜3文・分析反映）",
          "estimatedCost": "概算（${symbol}・人数考慮）",
          "transportation": "具体的な移動手段（路線・駅名・料金目安）",
          "reservationUrl": "予約URL（不要なら空文字）",
          "websiteUrl": "公式サイトURL（不明なら空文字）",
          "travelTimeToNext": "約12分（電車・${symbol}210）",
          "weatherBackup": "雨の場合: 代替スポットまたは過ごし方"
        }
      ]
    }
  ]`;

  const durationRules = isMultiDay
    ? `- **days配列は必ず${durationConfig.dayCount}件**（${durationLabel}）
- 各日は独立した itinerary を持つ（label: "1日目"〜"${durationConfig.dayCount}日目"）
- 各日の theme にその日のコンセプトを日本語で記載
- 各日の items は${durationConfig.itemsMin}〜${durationConfig.itemsMax}件
- 日を跨ぐ移動（新幹線・宿泊等）も該当日の items / transportation に含める
- 合計予算は旅行全体（宿泊・交通・食事・体験）の概算`
    : `- days配列は1件（${input.spontaneous ? input.spontaneous.availableTime : durationLabel}）
- itemsは${itemsMin}〜${itemsMax}件
- ${input.tripDuration === '半日' ? '半日プランは午前または午後の短い行程（朝・昼・夜のうち該当時間帯）' : input.tripDuration === '1日' ? '1日プランは朝・昼・夜の流れで組む' : '合計予算はこの期間の概算'}`;

  const accommodationRule = isMultiDay
    ? '- **宿泊費**: 泊数・人数・エリア相場に合わせて配分（旅行タイプ「' + input.personality + '」も反映）'
    : `- **宿泊費**: 半日・日帰りのため「${symbol}0（不要）」と記載`;

  const budgetScopeSection = input.budgetScope
    ? buildBudgetScopePromptSection(
        input.budgetScope,
        budget,
        input.currency,
        people,
        durationLabel,
      )
    : '';

  const budgetOptimizationSection = input.budgetScope
    ? `${budgetScopeSection}`
    : `
## 予算の最適配分（必須）
お客様の予算「${budget} ${input.currency}」をもとに、budgetBreakdown でカテゴリ別の概算を作成してください。
人数${people}人・期間「${durationLabel}」・旅行タイプ「${input.personality}」を考慮し、無理のない配分にすること。

- **total（合計予算）**: 旅行全体の概算合計（${symbol}付き）。お客様予算を超えないよう調整
${accommodationRule}
- **food（食事）**: ランチ・カフェ・ディナー等の食事費合計
- **transportation（交通費）**: 電車・バス・タクシー・新幹線等の移動費合計
- **activity（アクティビティ）**: 入場料・体験・お土産・その他娯楽費合計

各カテゴリの合計が total におおむね一致するよう配分してください。totalBudget は budgetBreakdown.total と同じ値にしてください。`;

  const currencySection = `
## 通貨（最重要・すべての金額表示に適用）
- 目的地の現地通貨: **${input.currency}（${label} · ${symbol}）**
- estimatedCost、budgetBreakdown の全項目、totalBudget には**必ず ${symbol} を付ける**こと
- 日本円（¥）や他通貨に変換しないこと。現地の物価水準に合った現実的な金額にすること
- 例（AUD）: A$45、A$120 — 例（USD）: $35、$80 — 例（KRW）: ₩15,000
- highlights や rainyDayAlternatives に金額を含める場合も ${symbol} を使用すること`;

  const tripDateLabel = formatTripDateLabel(input.tripDate);
  const tripEndDateLabel = input.tripEndDate
    ? formatTripDateLabel(input.tripEndDate)
    : tripDateLabel;
  const dateRangeLabel =
    input.tripEndDate && input.tripEndDate !== input.tripDate
      ? `${tripDateLabel}〜${tripEndDateLabel}`
      : tripDateLabel;

  const weatherSection = input.weather
    ? `

## 天気予報（${input.weather.locationName}・必ず反映）
${input.weather.summary}

${isMultiDay ? '日別予報:' : '当日予報:'}
${input.weather.days
  .map((day) => {
    const guidance = day.preferIndoor
      ? ' → **屋内アクティビティ優先**'
      : day.preferOutdoor
        ? ' → **屋外アクティビティ優先**'
        : '';
    return `- ${day.label}: ${day.condition}（${day.summary}）${guidance}`;
  })
  .join('\n')}

### 天気に基づくスポット選定（最重要）
${
  input.weather.hasRainExpected
    ? `- **雨の予報あり**: 美術館、ショッピングモール、カフェ、水族館、屋内展望など**屋内施設を優先**してください
- 屋外スポットを選ぶ場合は、短時間の移動・雨具不要な場所に限定すること
- 各スポットの選定理由に「天候（雨）への配慮」を必ず記載`
    : ''
}
${
  input.weather.isMostlySunny
    ? `- **晴れの予報**: 公園、散策、テラス席、屋外体験、展望スポットなど**屋外アクティビティを積極的に**組み込んでください
- 各スポットの選定理由に「天候（晴れ）を活かせる」旨を記載`
    : ''
}
${
  !input.weather.hasRainExpected && !input.weather.isMostlySunny
    ? `- 曇りや天候変化の可能性あり。**屋内・屋外をバランスよく**組み合わせ、柔軟に楽しめるプランにすること`
    : ''
}
${isMultiDay ? '- **複数日の場合、日ごとの天気予報に合わせて**その日の items を調整すること（雨の日は屋内、晴れの日は屋外）' : ''}
- plannerMessage に天候への一言（例：「晴れの予報なので屋外も楽しめます」等）を含めること
- rainyDayAlternatives には、雨の日でも楽しめる具体的な代替スポットを記載すること`
    : '';

  const userMemorySection = input.userPreferences
    ? buildUserMemoryPromptSection(input.userPreferences)
    : '';

  const travelMemorySection = input.travelMemories?.length
    ? buildTravelMemoryPromptSection(input.travelMemories)
    : '';

  const localHiddenSpotsSection = input.localHiddenSpots?.length
    ? buildLocalHiddenSpotsPromptSection(input.localHiddenSpots)
    : '';

  const realPlacesSection =
    input.realPlaces && input.realPlaces.places.length > 0
      ? `\n\n${buildRealPlacesPromptSection(input.realPlaces)}`
      : input.realPlaces?.notice
        ? `\n\n${buildRealPlacesPromptSection(input.realPlaces)}`
        : '';

  const spontaneousSection = input.spontaneous
    ? buildImaHimaPromptSection(
        input.spontaneous,
        resolveMoodPreferences(input.spontaneous.moodLabel),
      )
    : '';

  const bestDaySection = input.bestDay ? buildBestDayPromptSection(input.bestDay) : '';

  const customPreferencesSection = buildCustomPreferencesPromptSection(
    input.customPreferences,
    isTravelPlan ? normalized.travelPurpose : input.mood,
  );

  const conciergeSection = `

## コンシェルジュモード（必須・各 items に設定）
各スポットの items に、予約・アクセス情報を必ず含めてください。

- **reservationUrl**: レストラン・体験施設・美術館等の**直接予約URL**（食べログ予約、公式予約ページ、チケット購入ページ等）。予約不要なスポット（公園・散策等）は**空文字**
- **websiteUrl**: 施設・店舗の**公式サイトURL**。不明・存在しない場合は**空文字**（架空URLは禁止）
- **travelTimeToNext**: 次のスポットまでの**目安移動時間**（例：約15分（徒歩800m）、約8分（地下鉄））。移動手段も含める。各日の**最終 item** は「—」
- transportation には移動手段の説明、travelTimeToNext には時間の目安を記載（両方セットで使う）
- URLは https:// で始まる有効な形式のみ。確信がない場合は空文字にすること`;

  const preAnalysisSection = buildPreAnalysisBriefing(input);

  const planCreationSection = normalized.planType
    ? buildPlanCreationPromptSection({
        planType: normalized.planType,
        mood: input.mood,
        travelIntent: normalized.travelPurpose,
        customPreferences: input.customPreferences,
      })
    : '';

  const vagueLocationSection =
    normalized.planType && location.trim()
      ? buildVagueLocationPromptSection({
          location,
          planType: normalized.planType,
          companion: input.companion,
          spotInterests: normalized.mustVisitPlaces,
        })
      : '';

  const intentConditionLine = isTravelPlan
    ? `- 旅行の目的: ${travelIntent}`
    : isOutingPlan
      ? `- 今日の気分: ${effectiveMood}`
      : `- 気分・目的: ${effectiveMood !== '未指定' ? effectiveMood : travelIntent}`;

  const mustVisitLine = normalized.mustVisitPlaces
    ? `- 行きたい場所: ${normalized.mustVisitPlaces}`
    : '';
  const avoidLine = normalized.avoidPreferences
    ? `- 避けたいこと: ${normalized.avoidPreferences}`
    : '';

  return `あなたは日本トップクラスの旅行コンシェルジュ兼プランナーです。
高級ホテルの専属コンシェルジュのように、分析に基づいた説得力のある提案を、温かみのある自然な日本語で作成してください。
**感情的に満たされ、現実的な「物語のある1日（または旅）」を設計すること。効率だけの詰め込みプランにしない。**
${input.spontaneous ? '\n**⚡ 今暇モード**: ユーザーは今すぐ出かけたい。近場・今すぐ行けるスポットを最優先に。' : ''}
${input.bestDay ? '\n**🔥 最高の1日**: ユーザーは計画を任せた。プレミアムコンシェルジュとして最高の体験を設計すること。' : ''}

${preAnalysisSection}
${planCreationSection}
${vagueLocationSection}

## お客様の条件
- プラン種別: ${normalized.planType ?? '未指定'}
- 行きたいエリア・都市: ${location}
- departureDate（出発日）: ${tripDateLabel}（${departureDate}）
- returnDate（帰宅日 / 最終日）: ${tripEndDateLabel}（${returnDate}）
- 日程: ${dateRangeLabel}
- durationLabel（旅行期間）: ${durationLabel}
- 予算: ${budget} ${input.currency}（${symbol}）※${isMultiDay ? '旅行全体' : 'この期間'}の目安
- 通貨: ${input.currency}（${label}）
- 人数: ${people}人
- 誰と: ${input.companion}
- 旅行タイプ: ${input.personality}
${intentConditionLine}
${mustVisitLine}
${avoidLine}

## 期間「${durationLabel}」の方針
${durationConfig.guide}

${durationRules}

## 旅行タイプ「${input.personality}」の方針（最重要・必ず反映）
${personalityGuide}

**旅行タイプはプラン全体の軸です。** 各日・各スポットの選定理由・plannerMessage で「${input.personality}」らしさが一貫して伝わるようにしてください。

## 作成ルール（コンシェルジュ品質）
1. **conciergeAnalysis を先に完成**させてから days を設計すること
2. ${
    input.realPlaces
      ? '**実在スポットリストに記載されたスポットのみ**を使用すること（架空の店名・施設名は禁止）'
      : '**実在のスポット**を可能な限り使う（店名・施設名・エリア名を具体的に）'
  }
3. 各アクティビティに**開始時刻**（HH:MM）を付ける
4. reason は**2〜3文**で、分析（好み・天候・予算・期間・スタイル）を反映
5. estimatedCost は${symbol}付き・**人数${people}人考慮**の現実的な概算
6. transportation は**路線名・駅名・徒歩分数・料金目安**を含む具体的な指示
7. travelTimeToNext は transportation と整合した移動時間
8. weatherBackup で各スポットの**天候変化時の代替**を1文で記載
9. **budgetBreakdown** でカテゴリ別概算を${symbol}付きで記載
10. **合計予算（totalBudget）**は budgetBreakdown.total と一致
11. 地理的に近い順に並べ、移動が不自然にならないルートにする
12. **同じスポット名を旅全体で2回以上使わない**（ユーザーが明示的に希望した場合のみ例外）
13. rainyDayAlternatives は**3〜5件**の具体的な代替案${
    input.realPlaces ? '（実在スポットリスト内のみ）' : '（実在スポット名必須）'
  }
14. 各 item に **activityCategory** を必ず付ける（${activityCategoryGuide}）
15. 文体は丁寧で親しみやすい日本語。プロのコンシェルジュとして信頼感のあるトーン

${humanRhythmSection}${diversitySection}${travelTimingSection}${tourSuggestionSection}
${budgetOptimizationSection}${currencySection}${weatherSection}${customPreferencesSection}${localHiddenSpotsSection}${travelMemorySection}${userMemorySection}${realPlacesSection}${bestDaySection}${spontaneousSection}${conciergeSection}

## 出力JSON（この形式のみ、余計な文章は禁止）
{
  "conciergeAnalysis": {
    "userPreferences": "好み分析（2〜3文）",
    "weather": "天気分析と対策方針（2〜3文）",
    "budget": "予算分析と配分方針（2〜3文）",
    "tripDuration": "期間・日程分析（2〜3文）",
    "travelStyle": "旅行スタイル分析（2〜3文）",
    "overallStrategy": "総合設計方針（2〜4文）"
  },
  "plannerMessage": "コンシェルジュからの提案メッセージ（分析への共感・2〜3文）",
  ${daysJsonExample},
  "budgetBreakdown": {
    "total": "合計概算（${symbol}）",
    "accommodation": "宿泊費概算（${symbol}）",
    "food": "食事費概算（${symbol}）",
    "transportation": "交通費概算（${symbol}）",
    "activity": "アクティビティ費概算（${symbol}）"
  },
  "totalBudget": "合計概算（budgetBreakdown.total と同じ）",
  "duration": "期間・所要時間（例：${durationLabel}・約8時間 / ${durationLabel}）",
  "highlights": ["このプランの魅力1", "魅力2", "魅力3"],
  "rainyDayAlternatives": ["雨の場合: ○○の代わりに△△（屋内）", "代替案2", "代替案3", "代替案4"]${aiAdviceJson}
}

totalBudget・budgetBreakdown・estimatedCostには必ず${symbol}を使用してください。${dateAdviceSection}${variationSection}${adjustmentSection}${balanceFixSection}${qualityFixSection}`;
}
