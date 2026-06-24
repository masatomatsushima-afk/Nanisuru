import {
  getCurrency,
  type CurrencyCode,
} from '@/constants/currency';

type CurrencyRule = {
  code: CurrencyCode;
  keywords: readonly string[];
};

const CURRENCY_RULES: readonly CurrencyRule[] = [
  {
    code: 'JPY',
    keywords: [
      'japan',
      'japanese',
      'jp',
      'tokyo',
      'osaka',
      'kyoto',
      'yokohama',
      'nagoya',
      'sapporo',
      'fukuoka',
      'okinawa',
      'kobe',
      'hiroshima',
      'nara',
      'hakone',
      'kanazawa',
      'sendai',
      '日本',
      '東京',
      '大阪',
      '京都',
      '横浜',
      '名古屋',
      '札幌',
      '福岡',
      '沖縄',
      '神戸',
      '広島',
      '奈良',
      '箱根',
      '金沢',
      '仙台',
      '渋谷',
      '新宿',
      '銀座',
      '原宿',
      '表参道',
      '六本木',
      '浅草',
      '秋葉原',
      '道頓堀',
      '心斎橋',
      '梅田',
    ],
  },
  {
    code: 'AUD',
    keywords: [
      'australia',
      'australian',
      'au',
      'melbourne',
      'sydney',
      'brisbane',
      'perth',
      'adelaide',
      'canberra',
      'gold coast',
      'cairns',
      'hobart',
      'darwin',
      'queensland',
      'victoria',
      'nsw',
      'オーストラリア',
      '豪州',
      'メルボルン',
      'シドニー',
      'ブリスベン',
      'パース',
      'ケアンズ',
    ],
  },
  {
    code: 'KRW',
    keywords: [
      'korea',
      'korean',
      'kr',
      'seoul',
      'busan',
      'jeju',
      'incheon',
      'daegu',
      'gangnam',
      'myeongdong',
      'hongdae',
      '韓国',
      'ソウル',
      '釜山',
      '済州',
      '仁川',
      '大邱',
      '江南',
      '明洞',
      '弘大',
    ],
  },
  {
    code: 'USD',
    keywords: [
      'usa',
      'u.s.',
      'u.s.a.',
      'united states',
      'america',
      'american',
      'new york',
      'nyc',
      'los angeles',
      'la',
      'san francisco',
      'chicago',
      'boston',
      'seattle',
      'miami',
      'las vegas',
      'washington',
      'hawaii',
      'honolulu',
      'texas',
      'california',
      'florida',
      'アメリカ',
      '米国',
      'ニューヨーク',
      'ロサンゼルス',
      'サンフランシスコ',
      'シカゴ',
      'ボストン',
      'シアトル',
      'マイアミ',
      'ラスベガス',
      'ハワイ',
    ],
  },
  {
    code: 'EUR',
    keywords: [
      'europe',
      'european',
      'eu',
      'eurozone',
      'paris',
      'france',
      'berlin',
      'germany',
      'munich',
      'rome',
      'italy',
      'milan',
      'madrid',
      'spain',
      'barcelona',
      'amsterdam',
      'netherlands',
      'brussels',
      'belgium',
      'vienna',
      'austria',
      'zurich',
      'switzerland',
      'prague',
      'czech',
      'lisbon',
      'portugal',
      'athens',
      'greece',
      'dublin',
      'ireland',
      'copenhagen',
      'denmark',
      'stockholm',
      'sweden',
      'helsinki',
      'finland',
      'norway',
      'oslo',
      'ヨーロッパ',
      '欧州',
      'パリ',
      'フランス',
      'ベルリン',
      'ドイツ',
      'ミュンヘン',
      'ローマ',
      'イタリア',
      'ミラノ',
      'マドリード',
      'スペイン',
      'バルセロナ',
      'アムステルダム',
      'オランダ',
      'ブリュッセル',
      'ベルギー',
      'ウィーン',
      'オーストリア',
      'リスボン',
      'ポルトガル',
      'アテネ',
      'ギリシャ',
    ],
  },
];

function normalizeLocationText(location: string): string {
  return location.toLowerCase().trim();
}

export function inferCurrencyFromLocation(location: string): CurrencyCode {
  const normalized = normalizeLocationText(location);
  if (!normalized) return 'JPY';

  for (const rule of CURRENCY_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return rule.code;
    }
  }

  return 'JPY';
}

export function buildLocationCurrencyHint(location: string): string | null {
  const trimmed = location.trim();
  if (!trimmed) return null;

  const code = inferCurrencyFromLocation(trimmed);
  const { symbol, label } = getCurrency(code);
  return `現地通貨: ${label}（${code} · ${symbol}）`;
}

export function resolveCurrencyForLocation(
  location: string,
  address?: string,
  fallback: CurrencyCode = 'JPY',
): CurrencyCode {
  const combined = [location, address].filter(Boolean).join(' ').trim();
  if (!combined) return fallback;
  return inferCurrencyFromLocation(combined);
}
