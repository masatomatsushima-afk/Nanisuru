import type { CompanionOption } from '@/types/plan';
import type { PlanCreationType } from '@/types/plan-creation';

export const LOCATION_FIELD_LABEL = '行きたいエリア・都市';
export const LOCATION_FIELD_HELPER = '駅名・エリア名・都市名・国名でもOK';
export const SPOT_INTERESTS_LABEL = '行きたい場所・気になるスポット';
export const SPOT_INTERESTS_PLACEHOLDER = '例）カフェ、古着屋、海、夜景、神社、マーケット';

const SPECIFIC_LOCATION_PATTERN =
  /駅|周辺|エリア|地区|通り|沿い|ビーチ|海岸|空港|港|ダウンタウン|中心部|市内|現在地|near|downtown|station/i;

const CITY_DATE_AREA_HINTS: Record<string, string> = {
  大阪: '梅田・中崎町・堀江・心斎橋・天満',
  東京: '中目黒・表参道・代官山・下北沢・銀座',
  京都: '祇園・河原町・嵐山・二条城周辺',
  神戸: '元町・北野・ハーバーランド・三宮',
  福岡: '天神・中洲・大濠公園周辺・博多駅周辺',
  名古屋: '栄・大須・金山・名古屋駅周辺',
  横浜: 'みなとみらい・元町中華街・山手',
  札幌: '大通・すすきの・白い恋人パーク周辺',
  広島: '本通り・袋町・宮島口方面',
  仙台: '一番町・定禅寺通・青葉通',
};

const CITY_TRIP_AREA_HINTS: Record<string, string> = {
  大阪: '大阪市内・京都・奈良',
  東京: '都内・鎌倉・箱根・横浜',
  京都: '京都市内・宇治・大阪（日帰り）',
  福岡: '福岡市内・太宰府・糸島',
  北海道: '札幌・小樽・富良野・函館',
  韓国: 'ソウル・釜山・仁川',
  タイ: 'バンコク・チェンマイ・プーケット',
  パリ: 'パリ市内・ヴェルサイユ（日帰り）',
};

export function getLocationPlaceholder(planType: PlanCreationType): string {
  switch (planType) {
    case '今日のお出かけ':
      return '例）梅田、渋谷、心斎橋、現在地周辺';
    case 'デートプラン':
      return '例）中目黒、表参道、梅田、夜景が見えるエリア';
    case '旅行プラン':
      return '例）大阪、京都、北海道、韓国、タイ、パリ';
    case '週末プラン':
      return '例）箱根、淡路島、京都、熱海、ゴールドコースト';
    case 'AIに任せる':
      return '例）大阪周辺、自然が多い場所、海が見えるエリア';
    default:
      return '例）梅田、渋谷、心斎橋';
  }
}

export function isVagueLocationInput(location: string): boolean {
  const trimmed = location.trim();
  if (!trimmed || trimmed.length > 24) return false;
  if (SPECIFIC_LOCATION_PATTERN.test(trimmed)) return false;
  if (/[・,，、/／]/.test(trimmed) && trimmed.length > 6) return false;
  return true;
}

function resolveDateAreaHint(city: string): string {
  return CITY_DATE_AREA_HINTS[city] ?? `${city}市内のデート向けエリア・商店街・夜景スポット周辺`;
}

function resolveTripAreaHint(city: string): string {
  return CITY_TRIP_AREA_HINTS[city] ?? `${city}本体と、近隣の定番エリア`;
}

export function buildVagueLocationPromptSection(input: {
  location: string;
  planType: PlanCreationType;
  companion?: CompanionOption;
  spotInterests?: string;
}): string {
  if (!isVagueLocationInput(input.location)) return '';

  const city = input.location.trim();
  const spotNote = input.spotInterests?.trim()
    ? `\n- ユーザーが気になるスポット・キーワード: ${input.spotInterests.trim()}（エリア選定に優先反映）`
    : '';

  let guidance = '';

  switch (input.planType) {
    case 'デートプラン':
      guidance = `- **デートプラン**: 「${city}」から **${resolveDateAreaHint(city)}** など、二人で歩きやすいエリアを2〜3に絞って設計
- 会話・夜景・落ち着けるカフェが混ざる、ロマンチックな動線にすること`;
      break;
    case '旅行プラン':
    case '週末プラン':
      guidance = `- **${input.planType}**: 「${city}」を起点に **${resolveTripAreaHint(city)}** なども候補に
- 日ごとにエリア・テーマを変え、無理のない移動量にすること`;
      break;
    case '今日のお出かけ':
      guidance = `- **今日のお出かけ**: 「${city}」の**主要駅・中心部**から、今日行ける距離感で1〜2エリアに絞る
- 移動は少なめ、気分に合う軽い流れにすること`;
      break;
    case 'AIに任せる':
      guidance = `- **AIにおまかせ**: 「${city}」周辺で、自然・海・夜景・街歩きなど**バランスの良いエリア**を自律的に選定
- ユーザーに追加質問はせず、入力から最も自然な解釈で設計すること`;
      break;
    default:
      guidance = `- 「${city}」からプラン種別に合う**具体的なエリア**を自律的に選定すること`;
  }

  return `

## 目的地の解釈（入力が広いエリア名のため ★重要★）
ユーザーが入力した「${city}」は、**具体的な駅名・街区名ではなく都市・国レベル**の可能性が高いです。
プラン設計前に、プラン種別に合った**実用的なエリア**を選定・仮定してください（ユーザーへの追加質問は不要）。

${guidance}${spotNote}

- conciergeAnalysis.overallStrategy に、選んだエリアとその理由を1〜2文で明記すること
- 選んだエリア内で移動が少ない、現実的なルートにすること`;
}
