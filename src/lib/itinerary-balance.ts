import type { CompanionOption, ItineraryDay, ItineraryItem, PersonalityOption } from '@/types/plan';
import { isDateRelatedCompanion } from '@/types/plan';
import type { PlanCustomPreferences } from '@/types/plan-preferences';

export const MAX_FOOD_RATIO = 0.4;

export const ITINERARY_ACTIVITY_CATEGORIES = [
  '食事',
  'カフェ',
  '散歩',
  '体験',
  '景色',
  '買い物',
  '文化',
  '休憩',
  '夜景',
  '移動',
] as const;

export type ItineraryActivityCategory = (typeof ITINERARY_ACTIVITY_CATEGORIES)[number];

const FOOD_ACTIVITY_CATEGORIES = new Set<ItineraryActivityCategory>(['食事', 'カフェ']);

const FOOD_KEYWORD_PATTERN =
  /レストラン|restaurant|caf[eé]|カフェ|coffee|コーヒー|喫茶|brunch|ランチ|lunch|ディナー|dinner|食事|グルメ|gourmet|bistro|dining|bakery|ベーカリー|スイーツ|デザート|dessert|bar(?!\s*celona)|バー|居酒屋|焼肉|寿司|ramen|ラーメン|うどん|そば|イタリアン|フレンチ|中華|韓国料理|タイ料理|ビストロ|食堂|定食|タパス|food/i;

const NON_FOOD_CATEGORY_PATTERN =
  /散歩|体験|景色|買い物|文化|休憩|夜景|公園|park|museum|美術|gallery|観光|attraction|view|展望|散策|book|書店|market|マーケット|shopping|ショップ/i;

function parseHour(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):/);
  if (!match) return null;
  const hour = Number.parseInt(match[1], 10);
  return Number.isFinite(hour) ? hour : null;
}

function inferFoodKind(
  item: ItineraryItem,
): 'food' | 'cafe' | 'non-food' {
  const category = item.activityCategory?.trim();
  if (category === '食事') return 'food';
  if (category === 'カフェ') return 'cafe';
  if (category && FOOD_ACTIVITY_CATEGORIES.has(category as ItineraryActivityCategory)) {
    return category === 'カフェ' ? 'cafe' : 'food';
  }
  if (category && ITINERARY_ACTIVITY_CATEGORIES.includes(category as ItineraryActivityCategory)) {
    return 'non-food';
  }

  const haystack = [item.activity, item.placeCategory, item.reason].filter(Boolean).join(' ');
  if (/カフェ|coffee|コーヒー|喫茶|caf[eé]|スイーツ|デザート|dessert|ベーカリー|bakery/i.test(haystack)) {
    return 'cafe';
  }
  if (FOOD_KEYWORD_PATTERN.test(haystack) && !NON_FOOD_CATEGORY_PATTERN.test(haystack)) {
    return 'food';
  }
  return 'non-food';
}

export type ItineraryBalanceReport = {
  isTooFoodHeavy: boolean;
  foodRatio: number;
  lunchCount: number;
  dinnerCount: number;
  cafeCount: number;
  nonFoodCategoryCount: number;
  issues: string[];
};

export function analyzeDayBalance(items: ItineraryItem[]): ItineraryBalanceReport {
  const issues: string[] = [];
  let foodLikeCount = 0;
  let lunchCount = 0;
  let dinnerCount = 0;
  let cafeCount = 0;
  const categories = new Set<string>();

  const countableItems = items.filter((item) => item.activityCategory !== '移動');
  if (countableItems.length <= 3) {
    return {
      isTooFoodHeavy: false,
      foodRatio: 0,
      lunchCount: 0,
      dinnerCount: 0,
      cafeCount: 0,
      nonFoodCategoryCount: 0,
      issues: [],
    };
  }

  for (const item of items) {
    const kind = inferFoodKind(item);
    const hour = parseHour(item.time);

    if (item.activityCategory?.trim()) {
      categories.add(item.activityCategory.trim());
    }

    if (kind === 'cafe') {
      foodLikeCount += 1;
      cafeCount += 1;
      continue;
    }

    if (kind === 'food') {
      foodLikeCount += 1;
      if (hour != null && hour >= 11 && hour <= 14) lunchCount += 1;
      else if (hour != null && hour >= 17) dinnerCount += 1;
      else if (hour != null && hour <= 10) cafeCount += 1;
      else lunchCount += 1;
      continue;
    }

    if (item.activityCategory?.trim()) {
      categories.add(item.activityCategory.trim());
    }
  }

  const total = Math.max(countableItems.length, 1);
  const foodRatio = foodLikeCount / total;

  if (foodRatio > MAX_FOOD_RATIO) {
    issues.push(`食事・カフェが${Math.round(foodRatio * 100)}%を占めています（${Math.round(MAX_FOOD_RATIO * 100)}%以下が理想）`);
  }
  if (lunchCount > 1) issues.push(`ランチ系が${lunchCount}件あります（最大1件）`);
  if (dinnerCount > 1) issues.push(`ディナー系が${dinnerCount}件あります（最大1件）`);
  if (cafeCount > 1) issues.push(`カフェ・軽食が${cafeCount}件あります（最大1件）`);
  if (total >= 4 && categories.size < 3) {
    issues.push('カテゴリのバラエティが不足しています');
  }

  const nonFoodCategoryCount = [...categories].filter(
    (category) => !FOOD_ACTIVITY_CATEGORIES.has(category as ItineraryActivityCategory) && category !== '移動',
  ).length;

  return {
    isTooFoodHeavy: issues.length > 0,
    foodRatio,
    lunchCount,
    dinnerCount,
    cafeCount,
    nonFoodCategoryCount,
    issues,
  };
}

export function analyzeItineraryBalance(days: ItineraryDay[]): ItineraryBalanceReport {
  const reports = days.map((day) => analyzeDayBalance(day.items));
  const totalItems = days.reduce((sum, day) => sum + day.items.length, 0);
  const totalFoodLike = reports.reduce(
    (sum, report, index) => sum + Math.round(report.foodRatio * days[index].items.length),
    0,
  );

  return {
    isTooFoodHeavy: reports.some((report) => report.isTooFoodHeavy),
    foodRatio: totalItems > 0 ? totalFoodLike / totalItems : 0,
    lunchCount: reports.reduce((sum, report) => sum + report.lunchCount, 0),
    dinnerCount: reports.reduce((sum, report) => sum + report.dinnerCount, 0),
    cafeCount: reports.reduce((sum, report) => sum + report.cafeCount, 0),
    nonFoodCategoryCount: Math.max(...reports.map((report) => report.nonFoodCategoryCount), 0),
    issues: reports.flatMap((report) => report.issues),
  };
}

export function isGourmetTourIntent(input: {
  personality: PersonalityOption;
  mood?: string;
  travelIntent?: string;
  customPreferences?: PlanCustomPreferences;
}): boolean {
  if (input.personality === 'グルメ') return true;

  const moodText = [input.mood?.trim(), input.travelIntent?.trim()].filter(Boolean).join(' ');
  if (/グルメ|食べ歩き|フード|food|gourmet/i.test(moodText)) return true;

  const customText = [
    input.customPreferences?.customMood,
    input.customPreferences?.customTravelIntent,
    input.customPreferences?.desiredPlaces,
  ]
    .filter(Boolean)
    .join(' ');

  return /グルメ|食べ歩き|フード|food|gourmet|レストラン巡/i.test(customText);
}

export function buildHumanRhythmPromptSection(input: {
  personality: PersonalityOption;
  companion: CompanionOption;
  mood?: string;
  customPreferences?: PlanCustomPreferences;
}): string {
  const gourmetTour = isGourmetTourIntent(input);
  const datePlan = isDateRelatedCompanion(input.companion);

  const foodLimits = gourmetTour
    ? `- グルメ・食事重視の希望あり。**食事の比率は高めでもよい**が、散歩・景色・体験も少し混ぜて「食べ歩きの物語」にすること`
    : `- **食事偏重禁止**: ランチ1・ディナー1・カフェ/デザート1まで。1日を食事で埋めない
- 食事・カフェ以外（散歩・体験・景色・文化・買い物・休憩）を**必ず半分以上**含める`;

  const dateSection = datePlan
    ? `
### カップル・デート向け（感情体験を優先）
- レストランだけでなく、**散歩・景色・写真・落ち着ける場所・思い出になる瞬間**を入れる
- 例: 景色の良い通りを歩く → マーケットや書店 → 静かな場所で会話 → ゆったりディナー → 夜景`
    : '';

  return `
## 人間らしい1日のリズム（最重要）
Create a day that feels emotionally satisfying and realistic, not just efficient. The user should feel like the day has a story.

- 効率だけの詰め込みは禁止。**会話・写真・休憩・景色を楽しむ余白**を必ず入れる
- 次々と店に入るのではなく、**歩く時間・移動のバッファ・休憩**を自然に配置
- 各 item に **activityCategory** を必ず付ける（食事 / カフェ / 散歩 / 体験 / 景色 / 買い物 / 文化 / 休憩 / 夜景 / 移動）
${foodLimits}

### 1日の理想バランス（参考）
10:00 カフェで軽くスタート（カフェ）
11:00 公園や街並みを散歩（散歩）
12:30 ランチ（食事）
14:00 美術館・マーケット・体験（文化 / 体験 / 買い物）
16:00 休憩 or 写真スポット（休憩 / 景色）
18:30 ディナー（食事）
20:00 夜景 or ゆっくり帰る（夜景 / 散歩）
${dateSection}
`.trim();
}

export function buildFoodHeavyRebalanceInstruction(days: ItineraryDay[]): string {
  const report = analyzeItineraryBalance(days);
  return `
## プラン再調整（食事偏重の修正 · 必須）
前回生成したプランは**食事・カフェが多すぎ**ました。以下の問題を解消した**新しいプラン全体**を作成してください。

問題点:
${report.issues.map((issue) => `- ${issue}`).join('\n')}

修正方針:
- レストラン・カフェの数を減らし、散歩・公園・体験・文化・景色・買い物・休憩を増やす
- ランチ1・ディナー1・カフェ1まで。それ以外は非食事カテゴリに
- 移動・休憩の時間を増やし、人間が無理なく回れるペースに
- 各 item の activityCategory を正しく付ける
- 実在スポットリストがある場合は、**リスト内の非飲食スポット**を積極的に使う
`.trim();
}
