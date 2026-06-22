import type {
  ImaHimaMoodOption,
  ImaHimaTimeConfig,
  ImaHimaTimeOption,
  MoodPreferences,
  SpontaneousContext,
} from '@/types/imafima';
import type { CompanionOption, PersonalityOption } from '@/types/plan';

export const IMA_HIMA_TIME_CONFIG: Record<ImaHimaTimeOption, ImaHimaTimeConfig> = {
  '1時間': {
    tripDuration: '半日',
    itemsMin: 1,
    itemsMax: 2,
    dayLabel: '今すぐプラン',
    guide:
      '今から1時間だけ空いている即興プラン。スポット1〜2件、近場で移動5〜10分以内。今すぐ行ける・待ち時間の少ない場所を優先。',
  },
  '2時間': {
    tripDuration: '半日',
    itemsMin: 2,
    itemsMax: 2,
    dayLabel: '2時間プラン',
    guide:
      '2時間の即興プラン。スポット2件、エリアを絞り移動は最小限。カフェ→散策など、テンポよく楽しめる構成に。',
  },
  '3時間': {
    tripDuration: '半日',
    itemsMin: 2,
    itemsMax: 3,
    dayLabel: '3時間プラン',
    guide:
      '3時間の即興プラン。スポット2〜3件。ランチやカフェを含め、時間内に余裕を持って回れるルートに。',
  },
  半日: {
    tripDuration: '半日',
    itemsMin: 2,
    itemsMax: 3,
    dayLabel: '半日プラン',
    guide:
      '半日（約4〜5時間）の即興プラン。午後または午前で完結。スポット2〜3件、のんびり楽しめるペース。',
  },
  '1日': {
    tripDuration: '1日',
    itemsMin: 4,
    itemsMax: 5,
    dayLabel: '1日プラン',
    guide:
      '1日まるごとの即興プラン。朝から夜まで4〜5件。今の気分に合わせ、充実した1日を提案。',
  },
};

export const IMA_HIMA_MOOD_EMOJI: Record<ImaHimaMoodOption, string> = {
  癒されたい: '🌿',
  刺激が欲しい: '⚡',
  美味しいものを食べたい: '🍜',
  映えたい: '📸',
  恋愛したい: '💕',
  一人で考えたい: '🧘',
};

export const IMA_HIMA_TIME_EMOJI: Record<ImaHimaTimeOption, string> = {
  '1時間': '⏱',
  '2時間': '⏰',
  '3時間': '🕐',
  半日: '🌤',
  '1日': '☀️',
};

export function resolveMoodPreferences(mood: ImaHimaMoodOption): MoodPreferences {
  const map: Record<ImaHimaMoodOption, MoodPreferences> = {
    癒されたい: {
      personality: 'のんびり',
      companion: '一人',
      moodDescription: '癒し・リラックス・穏やかな時間',
    },
    刺激が欲しい: {
      personality: '冒険家',
      companion: '友達',
      moodDescription: 'ドキドキ・体験・非日常',
    },
    美味しいものを食べたい: {
      personality: 'グルメ',
      companion: '友達',
      moodDescription: 'グルメ・食べ歩き・美味しいもの',
    },
    映えたい: {
      personality: '映え重視',
      companion: '友達',
      moodDescription: '写真映え・おしゃれスポット',
    },
    恋愛したい: {
      personality: '映え重視',
      companion: 'カップル',
      moodDescription: 'ロマンチック・デート・二人の時間',
    },
    一人で考えたい: {
      personality: '穴場好き',
      companion: '一人',
      moodDescription: '静か・内省・自分だけの時間',
    },
  };

  return map[mood];
}

export function buildSpontaneousContext(
  availableTime: ImaHimaTimeOption,
  mood: ImaHimaMoodOption,
): SpontaneousContext {
  const config = IMA_HIMA_TIME_CONFIG[availableTime];
  return {
    availableTime,
    moodLabel: mood,
    itemsMin: config.itemsMin,
    itemsMax: config.itemsMax,
    timeGuide: config.guide,
    dayLabel: config.dayLabel,
  };
}

export function getImaHimaTripDuration(time: ImaHimaTimeOption): ImaHimaTimeConfig['tripDuration'] {
  return IMA_HIMA_TIME_CONFIG[time].tripDuration;
}

export function buildImaHimaPromptSection(
  spontaneous: SpontaneousContext,
  moodPrefs: MoodPreferences,
): string {
  return `

## ⚡ 今暇モード（即興プラン・最重要）
ユーザーは**今すぐ**出かけたいと考えています。以下を最優先で反映してください。

- **空き時間**: ${spontaneous.availableTime}
- **今の気分**: ${spontaneous.moodLabel}（${moodPrefs.moodDescription}）
- **スポット数**: 厳密に${spontaneous.itemsMin}〜${spontaneous.itemsMax}件
- days配列は1件のみ。label は「${spontaneous.dayLabel}」、theme は気分「${spontaneous.moodLabel}」を反映
- **今すぐ行ける**・**現在営業中**と想定できるスポットを選ぶ
- 移動時間を短く、待ち時間の少ないルートに
- 気分「${spontaneous.moodLabel}」がプラン全体の軸。plannerMessage でも今の気分への共感を示す

### 時間の方針
${spontaneous.timeGuide}`;
}
