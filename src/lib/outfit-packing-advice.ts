import type { CompanionOption, ItineraryDay, WeatherForecast } from '@/types/plan';
import { isDateRelatedCompanion } from '@/types/plan';
import type { PlanCreationType } from '@/types/plan-creation';
import type { OutfitPackingAdvice, OutfitStyleMode } from '@/types/outfit-advice';
import { resolveOutfitStyleMode } from '@/types/outfit-advice';

type ItinerarySignals = {
  hasFancyDinner: boolean;
  hasHikingNature: boolean;
  hasBeachWater: boolean;
  hasReligiousCultural: boolean;
  hasNightView: boolean;
  hasLongWalking: boolean;
  hasViewpoint: boolean;
  outdoorItemCount: number;
  indoorItemCount: number;
  walkItemCount: number;
};

const FANCY_DINNER_PATTERN =
  /ディナー|fine dining|フレンチ|イタリアン|記念|特別|夜景.*食|レストラン.*夜景/i;
const HIKING_PATTERN = /ハイキング|登山|トレイル|trail|国立公園|渓谷|山|ハイク|自然/i;
const BEACH_PATTERN = /海|ビーチ|beach|泳|サンゴ|マリンレ|水着|リーフ|海岸/i;
const RELIGIOUS_PATTERN = /寺|神社|mosque|教会|礼拝|参拝|モスク|礼拝堂|聖/i;
const NIGHT_VIEW_PATTERN = /夜景|night view|展望.*夜|イルミ/i;
const VIEWPOINT_PATTERN = /展望|絶景|view|スカイ|タワー|展望台|海沿い|cliff/i;
const WALK_PATTERN = /散歩|徒歩|ウォーク|walk|ハイキング|街歩き/i;

function itemHaystack(item: import('@/types/plan').ItineraryItem): string {
  return [item.activity, item.placeCategory, item.reason, item.transportation]
    .filter(Boolean)
    .join(' ');
}

function analyzeItinerary(days: ItineraryDay[]): ItinerarySignals {
  let hasFancyDinner = false;
  let hasHikingNature = false;
  let hasBeachWater = false;
  let hasReligiousCultural = false;
  let hasNightView = false;
  let hasLongWalking = false;
  let hasViewpoint = false;
  let outdoorItemCount = 0;
  let indoorItemCount = 0;
  let walkItemCount = 0;

  for (const day of days) {
    for (const item of day.items) {
      const haystack = itemHaystack(item);
      const hour = Number.parseInt(item.time.split(':')[0] ?? '12', 10);

      if (item.activityCategory === '散歩' || WALK_PATTERN.test(haystack)) walkItemCount += 1;
      if (item.activityCategory === '夜景' || NIGHT_VIEW_PATTERN.test(haystack)) hasNightView = true;
      if (item.activityCategory === '景色' || VIEWPOINT_PATTERN.test(haystack)) hasViewpoint = true;
      if (HIKING_PATTERN.test(haystack) || item.activityCategory === '体験') {
        if (HIKING_PATTERN.test(haystack)) hasHikingNature = true;
      }
      if (BEACH_PATTERN.test(haystack)) hasBeachWater = true;
      if (RELIGIOUS_PATTERN.test(haystack) || item.activityCategory === '文化') {
        if (RELIGIOUS_PATTERN.test(haystack)) hasReligiousCultural = true;
      }
      if (
        (item.activityCategory === '食事' && hour >= 17 && /記念|特別|夜景|きれい|view/i.test(haystack)) ||
        FANCY_DINNER_PATTERN.test(haystack)
      ) {
        hasFancyDinner = true;
      }

      if (['散歩', '景色', '体験'].includes(item.activityCategory ?? '')) outdoorItemCount += 1;
      if (['文化', '買い物', '食事', 'カフェ'].includes(item.activityCategory ?? '')) {
        indoorItemCount += 1;
      }
    }
  }

  hasLongWalking = walkItemCount >= 2 || days.reduce((sum, d) => sum + d.items.length, 0) >= 6;

  return {
    hasFancyDinner,
    hasHikingNature,
    hasBeachWater,
    hasReligiousCultural,
    hasNightView,
    hasLongWalking,
    hasViewpoint,
    outdoorItemCount,
    indoorItemCount,
    walkItemCount,
  };
}

function inferSeason(month: number): 'spring' | 'summer' | 'autumn' | 'winter' {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

function inferClimateHint(location: string): 'tropical' | 'temperate' | 'cold' | 'dry' | 'unknown' {
  const text = location.toLowerCase();
  if (/沖縄|okinawa|ハワイ|hawaii|バリ|bali|シンガポール|singapore|タイ|thailand|ベトナム|vietnam|カンクン|cairns|メルボルン.*夏|queensland/i.test(text)) {
    return 'tropical';
  }
  if (/北海道|hokkaido|スウェーデン|sweden|ノルウェー|norway|フィンランド|finland|カナダ|canada|アルプス|alps/i.test(text)) {
    return 'cold';
  }
  if (/ドバイ|dubai|ラスベガス|las vegas|アリゾナ|arizona/i.test(text)) {
    return 'dry';
  }
  return 'temperate';
}

function weatherStats(weather?: WeatherForecast) {
  if (!weather?.days.length) {
    return {
      maxTemp: 22,
      minTemp: 15,
      maxRainProb: 0,
      hasRain: false,
      mostlyOutdoor: true,
    };
  }

  const maxTemp = Math.max(...weather.days.map((d) => d.temperatureMax));
  const minTemp = Math.min(...weather.days.map((d) => d.temperatureMin));
  const maxRainProb = Math.max(...weather.days.map((d) => d.precipitationProbability));

  return {
    maxTemp,
    minTemp,
    maxRainProb,
    hasRain: weather.hasRainExpected || maxRainProb >= 40,
    mostlyOutdoor: weather.days.some((d) => d.preferOutdoor),
  };
}

function styleOutfitLine(mode: OutfitStyleMode): string | null {
  switch (mode) {
    case 'カジュアル':
      return 'カジュアルな装いで、移動や入店もしやすい服装がおすすめです。';
    case 'きれいめ':
      return 'きれいめカジュアル（シンプルなトップス＋きちんと感のあるボトムス）がバランス良いです。';
    case 'デート向け':
      return '歩きやすさを保ちつつ、少し意識したきれいめカジュアルがおすすめです。';
    case '写真映え':
      return '写真に映えやすい明るめ・色味のあるトップスがあると、思い出写真が楽しみやすいです。';
    case '動きやすさ重視':
      return '動きやすい素材とシンプルなレイヤーで、移動が多い日も快適に過ごせます。';
    case '防寒重視':
      return '重ね着できる上着と、冷えやすい足元の対策を優先しましょう。';
    case '雨対策重視':
      return '濡れても困りにくい色・素材を選び、防水・撥水できるアイテムを意識しましょう。';
    default:
      return null;
  }
}

function buildTravelPackingAdvice(input: {
  dayCount: number;
  hasRain: boolean;
  maxRainProb: number;
  minTemp: number;
  maxTemp: number;
  isTravelPlan: boolean;
}): string[] {
  if (!input.isTravelPlan || input.dayCount < 2) return [];

  const lines: string[] = [];
  const tops = input.dayCount <= 3 ? '2〜3枚' : input.dayCount <= 5 ? '3〜4枚' : '4〜5枚';

  lines.push(`${input.dayCount}日の旅なので、洗濯できる前提ならトップス${tops}で十分なことが多いです。`);

  if (input.maxTemp - input.minTemp >= 8) {
    lines.push('朝晩の寒暖差があるため、重ね着できる服があると安心です。');
  }

  if (input.hasRain || input.maxRainProb >= 35) {
    lines.push('雨の日が予報に含まれるため、防水の靴か替えの靴下があると安心です。');
  }

  if (input.minTemp <= 10) {
    lines.push('朝晩は冷える日があるので、薄手のダウンやカーディガンがあると便利です。');
  }

  return lines.slice(0, 3);
}

export function generateOutfitPackingAdvice(input: {
  days: ItineraryDay[];
  weather?: WeatherForecast;
  location: string;
  planType?: PlanCreationType;
  companion: CompanionOption;
  outfitStyleMode?: OutfitStyleMode;
  dayCount?: number;
  tripDate?: string;
}): OutfitPackingAdvice {
  const signals = analyzeItinerary(input.days);
  const stats = weatherStats(input.weather);
  const styleMode = resolveOutfitStyleMode(
    input.outfitStyleMode,
    input.planType,
    input.companion,
  );
  const isTravelPlan = input.planType === '旅行プラン' || input.planType === '週末プラン';
  const isDatePlan =
    input.planType === 'デートプラン' || isDateRelatedCompanion(input.companion);
  const dayCount = input.dayCount ?? input.days.length;
  const month = input.tripDate
    ? new Date(`${input.tripDate}T12:00:00`).getMonth() + 1
    : new Date().getMonth() + 1;
  const season = inferSeason(month);
  const climate = inferClimateHint(input.location);
  const tempSwing = stats.maxTemp - stats.minTemp;

  const outfit: string[] = [];
  const footwear: string[] = [];
  const items: string[] = [];
  const cautions: string[] = [];
  const dateOutfitTips: string[] = [];

  const styleLine = styleOutfitLine(styleMode);
  if (styleLine) outfit.push(styleLine);

  if (stats.maxTemp >= 28) {
    outfit.push('日中は暑くなるため、通気性の良い薄手の服がおすすめです。');
    items.push('日焼け止め');
    if (stats.maxTemp >= 32 || climate === 'tropical' || climate === 'dry') {
      items.push('サングラス');
      cautions.push('直射日光が強い時間帯は、帽子や日陰での休憩も検討してください。');
    }
  } else if (stats.maxTemp >= 20) {
    outfit.push('昼は過ごしやすい気温ですが、日差し対策があると快適です。');
  } else if (stats.maxTemp >= 12) {
    outfit.push('昼は涼しいので、長袖または薄手の羽織りがあると安心です。');
    items.push('羽織り');
  } else {
    outfit.push('外は冷えやすいので、保温できる上着と重ね着をおすすめします。');
    items.push('羽織り');
  }

  if (tempSwing >= 7 || stats.minTemp <= 15) {
    outfit.push('昼は暖かくても、夜は冷える可能性があるため薄手の羽織りがあると安心です。');
    if (!items.includes('羽織り')) items.push('羽織り');
  }

  if (stats.hasRain || stats.maxRainProb >= 40 || styleMode === '雨対策重視') {
    outfit.push('雨の可能性があるため、白い靴や濡れやすい服は避けるのがおすすめです。');
    items.push('折りたたみ傘');
    cautions.push('路面が滑りやすい場合があるので、足元は防滑性のある靴が安心です。');
  }

  if (signals.hasLongWalking || styleMode === '動きやすさ重視') {
    footwear.push('歩く時間が多いプランなので、履き慣れたスニーカーがおすすめです。');
  } else {
    footwear.push('長時間歩いても疲れにくい、履き慣れた靴がおすすめです。');
  }

  if (signals.hasHikingNature) {
    footwear.push('自然エリアでは、滑りにくく足首をサポートできる靴があると安心です。');
    outfit.push('動きやすいボトムスと、体温調節しやすい重ね着がおすすめです。');
  }

  if (signals.hasViewpoint || signals.hasNightView) {
    cautions.push('海沿いや展望スポットがあるため、風で髪や軽い服が乱れやすい可能性があります。');
  }

  if (signals.hasFancyDinner) {
    outfit.push('ディナー時間帯は、少しきれいめでも浮きにくい装いがあるとスムーズです。');
  }

  if (signals.hasReligiousCultural) {
    outfit.push('宗教・文化施設では、肩や膝が隠れる落ち着いた服装があると安心です。');
    cautions.push('参拝・見学の場所では、大声や派手すぎる服装は控えると良いでしょう。');
  }

  if (signals.hasBeachWater) {
    items.push('タオル');
    cautions.push('水辺のスポットがあるため、着替えやタオルがあると安心です。');
    if (/泳|シュノーケ|ダイビング|snorkel|dive/i.test(input.days.flatMap((d) => d.items).map(itemHaystack).join(' '))) {
      cautions.push('水泳・マリンアクティビティがある場合は、水着の準備も検討してください。');
    }
  }

  if (signals.outdoorItemCount > signals.indoorItemCount) {
    cautions.push('屋外スポットが多いため、日差し・風・急な天候変化に備えると快適です。');
  }

  items.push('モバイルバッテリー');
  items.push('水');

  if (isTravelPlan) {
    items.push('予約確認');
    items.push('パスポート / ID');
    if (stats.hasRain) items.push('替えの靴下');
  } else {
    items.push('現金');
  }

  if (season === 'summer' && climate !== 'cold') {
    if (!items.includes('日焼け止め')) items.push('日焼け止め');
  }

  if (isDatePlan) {
    dateOutfitTips.push('歩きやすさは残しつつ、写真に映えやすい明るめのトップスがおすすめです。');
    if (signals.hasNightView || signals.hasFancyDinner) {
      dateOutfitTips.push('夜景スポットに行くため、少しきれいめでも浮きにくい装いがちょうど良いです。');
    }
    if (input.companion === '初デート') {
      dateOutfitTips.push('初デートは、過度にフォーマルすぎない「清潔感＋動きやすさ」のバランスが安心です。');
    }
  }

  const travelPackingAdvice = buildTravelPackingAdvice({
    dayCount,
    hasRain: stats.hasRain,
    maxRainProb: stats.maxRainProb,
    minTemp: stats.minTemp,
    maxTemp: stats.maxTemp,
    isTravelPlan,
  });

  const title = '今日のおすすめ服装';

  const dedupe = (list: string[]) => [...new Set(list)].slice(0, 4);
  const dedupeItems = (list: string[]) => [...new Set(list)].slice(0, 8);

  return {
    title,
    outfit: dedupe(outfit),
    footwear: dedupe(footwear),
    items: dedupeItems(items),
    cautions: dedupe(cautions),
    dateOutfitTips: dateOutfitTips.length ? dedupe(dateOutfitTips) : undefined,
    travelPackingAdvice: travelPackingAdvice.length ? travelPackingAdvice : undefined,
    styleMode,
  };
}

export function logOutfitAdviceGenerated(advice: OutfitPackingAdvice): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[Nanisuru] outfit_packing_advice', {
      title: advice.title,
      styleMode: advice.styleMode,
      outfitCount: advice.outfit.length,
      itemsCount: advice.items.length,
    });
  }
}
