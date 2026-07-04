export type WeatherPlanningMode = 'forecast' | 'seasonal' | 'unavailable';

export type SeasonalWeatherContext = {
  mode: 'seasonal';
  destination: string;
  month: number;
  monthLabel: string;
  seasonLabel: string;
  guidance: string;
  outfitAdvice: string;
  riskNotes: string[];
};

/** Reliable daily forecast horizon: trips within this many days use real forecast data. */
export const FORECAST_HORIZON_DAYS = 10;

export const WEATHER_PLANNING_MESSAGES = {
  forecast: '予報をもとにプランを調整しています',
  seasonal: '旅行日が先のため、季節の傾向をもとにプランを作成しています',
  unavailable: '天気情報が取得できなかったため、天候に左右されにくい候補も含めています',
  rescheduleNote: '出発が近づいたら、最新の天気に合わせてプランを再調整できます',
} as const;

type ClimateZone =
  | 'japan'
  | 'korea'
  | 'southeast_asia'
  | 'australia'
  | 'europe'
  | 'us_east'
  | 'tropical'
  | 'temperate';

type SeasonProfile = {
  seasonLabel: string;
  guidance: string;
  outfitAdvice: string;
  riskNotes: string[];
};

const CLIMATE_ZONE_PATTERNS: Array<{ zone: ClimateZone; patterns: RegExp[] }> = [
  {
    zone: 'japan',
    patterns: [
      /^日本/i,
      /^japan$/i,
      /^東京$/,
      /^大阪$/,
      /^京都$/,
      /^神戸$/,
      /^名古屋$/,
      /^福岡$/,
      /^tokyo$/i,
      /^osaka$/i,
      /^kyoto$/i,
      /^北海道$/,
      /^沖縄$/,
      /^okinawa$/i,
    ],
  },
  {
    zone: 'korea',
    patterns: [/^韓国/i, /^korea$/i, /^ソウル$/, /^釜山$/, /^seoul$/i, /^busan$/i],
  },
  {
    zone: 'southeast_asia',
    patterns: [/^タイ/i, /^thailand$/i, /^バンコク$/, /^bangkok$/i, /^ベトナム/i, /^vietnam$/i],
  },
  {
    zone: 'australia',
    patterns: [
      /^オーストラリア/i,
      /^australia$/i,
      /^シドニー$/,
      /^メルボルン$/,
      /^ケアンズ$/,
      /^sydney$/i,
      /^melbourne$/i,
      /^cairns$/i,
    ],
  },
  {
    zone: 'europe',
    patterns: [/^フランス/i, /^france$/i, /^パリ$/, /^paris$/i, /^イタリア/i, /^italy$/i],
  },
  {
    zone: 'us_east',
    patterns: [/^アメリカ/i, /^usa$/i, /^united states$/i, /^ニューヨーク$/, /^new york$/i],
  },
  {
    zone: 'tropical',
    patterns: [/^ハワイ/i, /^hawaii$/i, /^グアム/i, /^guam$/i, /^バリ$/i, /^bali$/i],
  },
];

function normalizeDestinationKey(destination: string): string {
  return destination.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function resolveClimateZone(destination: string, weatherLookupCity?: string): ClimateZone {
  const normalized = normalizeDestinationKey(destination);
  const lookupCity = weatherLookupCity ?? normalized;
  const candidates = [normalized, lookupCity, normalized.toLowerCase(), lookupCity.toLowerCase()];

  for (const entry of CLIMATE_ZONE_PATTERNS) {
    if (entry.patterns.some((pattern) => candidates.some((value) => pattern.test(value)))) {
      return entry.zone;
    }
  }

  return 'temperate';
}

function isSouthernHemisphereZone(zone: ClimateZone): boolean {
  return zone === 'australia';
}

function effectiveMonth(month: number, southernHemisphere: boolean): number {
  if (!southernHemisphere) return month;
  return ((month + 5) % 12) + 1;
}

function japanProfile(month: number): SeasonProfile {
  if (month === 6) {
    return {
      seasonLabel: '梅雨',
      guidance:
        'この時期は雨の日が続きやすく、湿度も高めです。屋外より屋内メインの動き方が安心です。',
      outfitAdvice: '折りたたみ傘・防水スニーカー・吸湿速乾の上着を用意しましょう。',
      riskNotes: ['梅雨前線による長時間の雨', '足元の滑りやすさ', '屋内スポットへの切り替え'],
    };
  }
  if (month === 7 || month === 8) {
    return {
      seasonLabel: '真夏',
      guidance:
        'この時期は暑くなりやすく、日中の屋外は負担になりやすいです。水分補給と屋内での休憩を意識してください。',
      outfitAdvice: '通気性の良い薄手の服装、帽子、日焼け止め、保冷ボトルを持参しましょう。',
      riskNotes: ['猛暑・熱中症', 'にわか雨', 'エアコンの効いた屋内での休憩'],
    };
  }
  if (month === 12 || month === 1 || month === 2) {
    return {
      seasonLabel: '冬',
      guidance:
        'この時期は寒くなりやすく、早い時間帯は特に冷え込みます。屋外と屋内の温度差にも注意が必要です。',
      outfitAdvice: 'コートやダウン、マフラーなど防寒できる重ね着をおすすめします。',
      riskNotes: ['寒さによる体力消耗', '乾燥', '屋内暖房との温度差'],
    };
  }
  if (month === 3 || month === 4 || month === 5) {
    return {
      seasonLabel: '春',
      guidance:
        'この時期は過ごしやすい気温になりやすいですが、朝晩は肌寒く感じることもあります。',
      outfitAdvice: '脱ぎ着しやすいレイヤードスタイルが便利です。',
      riskNotes: ['朝晩の冷え込み', '天候の変わりやすさ', '屋外散策と屋内のバランス'],
    };
  }
  return {
    seasonLabel: '秋',
    guidance:
      'この時期は過ごしやすい気候になりやすく、屋外も楽しみやすい傾向があります。台風の可能性も考慮してください。',
    outfitAdvice: '薄手の上着があると、気温の変化に対応しやすいです。',
    riskNotes: ['台風・雨の可能性', '気温の日内変化', '直前の天気確認'],
  };
}

function koreaProfile(month: number): SeasonProfile {
  if (month === 6 || month === 7) {
    return {
      seasonLabel: '梅雨〜初夏',
      guidance: 'この時期は雨と湿度が増えやすく、屋外より屋内中心のプランが安心です。',
      outfitAdvice: '折りたたみ傘と速乾素材の服装を用意しましょう。',
      riskNotes: ['梅雨による降雨', '湿度の高さ', '屋内代替案の確保'],
    };
  }
  if (month === 12 || month === 1 || month === 2) {
    return {
      seasonLabel: '冬',
      guidance: 'この時期は寒さが厳しくなりやすく、屋外滞在は短めにした方が快適です。',
      outfitAdvice: '厚手のコート、手袋、マフラーなどの防寒対策をおすすめします。',
      riskNotes: ['低温・風', '乾燥', '暖房の効いた屋内での休憩'],
    };
  }
  if (month === 7 || month === 8) {
    return {
      seasonLabel: '真夏',
      guidance: 'この時期は暑くなりやすく、水分補給とこまめな休憩が大切です。',
      outfitAdvice: '薄手で通気性の良い服装、帽子、日焼け止めを持参しましょう。',
      riskNotes: ['猛暑', 'にわか雨', '屋内でのクールダウン'],
    };
  }
  return japanProfile(month);
}

function southeastAsiaProfile(month: number): SeasonProfile {
  if (month >= 6 && month <= 10) {
    return {
      seasonLabel: '雨季',
      guidance:
        'この時期は雨の可能性が高く、スコール状のにわか雨も考えられます。屋内候補を多めに入れておくと安心です。',
      outfitAdvice: '防水サンダル、折りたたみ傘、替えの薄手トップスがあると便利です。',
      riskNotes: ['スコール・集中豪雨', '湿度の高さ', '屋内スポットへの切り替え'],
    };
  }
  if (month >= 3 && month <= 5) {
    return {
      seasonLabel: '暑期',
      guidance: 'この時期はとても暑くなりやすく、日中の屋外は負担になりやすいです。',
      outfitAdvice: 'リネンやコットンなど通気性の良い服装、帽子、日焼け止めを必須にしましょう。',
      riskNotes: ['猛暑', '脱水', 'エアコンの効いた屋内休憩'],
    };
  }
  return {
    seasonLabel: '乾季',
    guidance: 'この時期は比較的过ごしやすい傾向がありますが、日中はまだ暑くなりやすいです。',
    outfitAdvice: '薄手の服装に加え、朝晩用の薄い上着があると便利です。',
    riskNotes: ['日中の暑さ', '紫外線', '水分補給'],
  };
}

function australiaProfile(month: number): SeasonProfile {
  if (month === 12 || month === 1 || month === 2) {
    return {
      seasonLabel: '夏',
      guidance: 'この時期は暑くなりやすく、紫外線も強めです。屋外は早朝・夕方中心がおすすめです。',
      outfitAdvice: '帽子、サングラス、日焼け止め、通気性の良い服装を用意しましょう。',
      riskNotes: ['猛暑・紫外線', 'にわか雨', '熱中症対策'],
    };
  }
  if (month === 6 || month === 7 || month === 8) {
    return {
      seasonLabel: '冬',
      guidance: 'この時期は気温が下がりやすく、特に早朝と夜は冷え込みます。',
      outfitAdvice: 'ジャケットや薄手のダウンなど、重ね着できる服装が便利です。',
      riskNotes: ['寒さ', '風', '屋内屋外の温度差'],
    };
  }
  return {
    seasonLabel: '春秋',
    guidance: 'この時期は過ごしやすい気候になりやすいですが、天候は変わりやすい傾向があります。',
    outfitAdvice: '脱ぎ着しやすいレイヤードスタイルをおすすめします。',
    riskNotes: ['天候の変化', '雨の可能性', '直前の天気確認'],
  };
}

function temperateProfile(month: number): SeasonProfile {
  if (month === 12 || month === 1 || month === 2) {
    return {
      seasonLabel: '冬',
      guidance: 'この時期は寒くなりやすく、屋外滞在は短めにした方が快適です。',
      outfitAdvice: 'コート、マフラー、手袋など防寒できる装いをおすすめします。',
      riskNotes: ['低温', '雨や雪の可能性', '暖房の効いた屋内休憩'],
    };
  }
  if (month === 6 || month === 7 || month === 8) {
    return {
      seasonLabel: '夏',
      guidance: 'この時期は暑くなりやすく、水分補給とこまめな休憩が大切です。',
      outfitAdvice: '薄手で通気性の良い服装、帽子、日焼け止めを持参しましょう。',
      riskNotes: ['暑さ', 'にわか雨', '屋内での休憩'],
    };
  }
  return {
    seasonLabel: '春秋',
    guidance: 'この時期は比較的过ごしやすい傾向がありますが、天候は変わりやすいこともあります。',
    outfitAdvice: '重ね着できる服装があると、気温変化に対応しやすいです。',
    riskNotes: ['天候の変化', '雨の可能性', '直前の天気確認'],
  };
}

function tropicalProfile(month: number): SeasonProfile {
  if (month >= 5 && month <= 10) {
    return {
      seasonLabel: '雨季',
      guidance:
        'この時期は雨の可能性が高く、急なスコールも考えられます。屋内候補を多めに含めてください。',
      outfitAdvice: '防水サンダル、折りたたみ傘、替えの薄手服を用意しましょう。',
      riskNotes: ['スコール', '湿度', '屋内代替案'],
    };
  }
  return {
    seasonLabel: '乾季',
    guidance: 'この時期は比較的過ごしやすい傾向がありますが、日中は暑くなりやすいです。',
    outfitAdvice: '通気性の良い薄手の服装、帽子、日焼け止め、保冷ボトルをおすすめします。',
    riskNotes: ['紫外線', '日中の暑さ', '水分補給'],
  };
}

function getSeasonProfile(zone: ClimateZone, month: number): SeasonProfile {
  switch (zone) {
    case 'japan':
      return japanProfile(month);
    case 'korea':
      return koreaProfile(month);
    case 'southeast_asia':
      return southeastAsiaProfile(month);
    case 'australia':
      return australiaProfile(month);
    case 'tropical':
      return tropicalProfile(month);
    case 'europe':
    case 'us_east':
    case 'temperate':
    default:
      return temperateProfile(month);
  }
}

export function getDaysUntilDeparture(departureDate: string): number {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const departure = new Date(`${departureDate}T12:00:00`);
  return Math.ceil((departure.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function isWithinForecastHorizon(departureDate: string): boolean {
  return getDaysUntilDeparture(departureDate) <= FORECAST_HORIZON_DAYS;
}

/**
 * Determine weather planning mode from departure date and optional forecast fetch result.
 *
 * - Within {@link FORECAST_HORIZON_DAYS} (10 days): `forecast` when data is available
 * - More than 10 days away: `seasonal` (no exact forecast)
 * - Fetch failed within horizon: `unavailable`
 */
export function getWeatherPlanningMode(
  departureDate: string,
  options?: { forecastAvailable?: boolean },
): WeatherPlanningMode {
  if (options?.forecastAvailable === false) {
    return 'unavailable';
  }

  if (!isWithinForecastHorizon(departureDate)) {
    return 'seasonal';
  }

  if (options?.forecastAvailable === true) {
    return 'forecast';
  }

  return 'forecast';
}

export function getWeatherPlanningMessage(mode: WeatherPlanningMode): string {
  return WEATHER_PLANNING_MESSAGES[mode];
}

export function buildSeasonalWeatherContext(
  destination: string,
  departureDate: string,
  weatherLookupCity?: string,
): SeasonalWeatherContext {
  const date = new Date(`${departureDate}T12:00:00`);
  const month = date.getMonth() + 1;
  const monthLabel = `${month}月`;
  const zone = resolveClimateZone(destination, weatherLookupCity);
  const southern = isSouthernHemisphereZone(zone);
  const climateMonth = effectiveMonth(month, southern);
  const profile = getSeasonProfile(zone, climateMonth);

  return {
    mode: 'seasonal',
    destination,
    month,
    monthLabel,
    seasonLabel: profile.seasonLabel,
    guidance: profile.guidance,
    outfitAdvice: profile.outfitAdvice,
    riskNotes: [...profile.riskNotes, '直前に天気を再確認してください'],
  };
}

export function buildSeasonalWeatherSummary(context: SeasonalWeatherContext): string {
  return (
    `${context.destination}の${context.monthLabel}（${context.seasonLabel}）の傾向をもとにプランを作成します。` +
    `${context.guidance} 直前に天気を再確認してください。`
  );
}

export function createSeasonalWeatherContextForecast(
  destination: string,
  departureDate: string,
  weatherLocation?: string,
): {
  seasonalContext: SeasonalWeatherContext;
  summary: string;
  hasRainExpected: boolean;
  weatherLocation: string;
} {
  const resolvedLocation = weatherLocation ?? destination;
  const seasonalContext = buildSeasonalWeatherContext(destination, departureDate, resolvedLocation);
  const hasRainExpected = seasonalContext.riskNotes.some((note) => /雨|梅雨|スコール/i.test(note));

  return {
    seasonalContext,
    summary: buildSeasonalWeatherSummary(seasonalContext),
    hasRainExpected,
    weatherLocation: resolvedLocation,
  };
}
