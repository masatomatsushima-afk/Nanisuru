import type { TripDurationOption } from '@/types/plan';
import type { CustomTripDuration } from '@/types/trip-schedule';

import { resolveDurationConfig } from './trip-duration';

export type GenerationTimeEstimate = {
  minSeconds: number;
  maxSeconds: number;
  label: string;
  isLongTrip: boolean;
};

export const PLAN_LOADING_STAGES = [
  {
    icon: '📍',
    label: '実在スポットを探しています',
    hint: 'Google Places から実在スポットを取得中',
  },
  {
    icon: '🧭',
    label: 'AIが旅行全体の流れを設計しています',
    hint: '日程全体のテーマと流れを組み立て中',
  },
  {
    icon: '🗓',
    label: '各日のプランを作成しています',
    hint: '日ごとのスポットと体験を配置中',
  },
  {
    icon: '💰',
    label: '予算を最適化しています',
    hint: '選択した予算項目に合わせて配分中',
  },
  {
    icon: '🗺',
    label: 'ルート情報を準備しています',
    hint: '移動しやすい順序と時間を調整中',
  },
  {
    icon: '✨',
    label: '最終チェック中です',
    hint: 'プラン全体を確認しています',
  },
] as const;

const PRESET_ESTIMATES: Record<
  Exclude<TripDurationOption, 'その他'>,
  GenerationTimeEstimate
> = {
  半日: { minSeconds: 10, maxSeconds: 15, label: '約10〜15秒', isLongTrip: false },
  '1日': { minSeconds: 15, maxSeconds: 25, label: '約15〜25秒', isLongTrip: false },
  '1泊2日': { minSeconds: 25, maxSeconds: 35, label: '約25〜35秒', isLongTrip: false },
  '2泊3日': { minSeconds: 35, maxSeconds: 50, label: '約35〜50秒', isLongTrip: false },
  '3泊4日': { minSeconds: 50, maxSeconds: 70, label: '約50〜70秒', isLongTrip: true },
  '1週間': { minSeconds: 120, maxSeconds: 180, label: '約2〜3分', isLongTrip: true },
};

function estimateFromDayCount(days: number): GenerationTimeEstimate {
  if (days <= 1) return PRESET_ESTIMATES['1日'];
  if (days === 2) return PRESET_ESTIMATES['1泊2日'];
  if (days === 3) return PRESET_ESTIMATES['2泊3日'];
  if (days === 4) return PRESET_ESTIMATES['3泊4日'];
  if (days <= 6) {
    return { minSeconds: 70, maxSeconds: 120, label: '約1〜2分', isLongTrip: true };
  }
  return PRESET_ESTIMATES['1週間'];
}

export function getGenerationTimeEstimate(
  tripDuration: TripDurationOption,
  customDuration?: CustomTripDuration | null,
): GenerationTimeEstimate {
  if (tripDuration === 'その他') {
    const days = customDuration?.days ?? 1;
    return estimateFromDayCount(days);
  }
  return PRESET_ESTIMATES[tripDuration];
}

export function buildLoadingHeadline(durationLabel: string): string {
  return `${durationLabel}のプランを作成中です`;
}

export function buildEstimateMessage(estimate: GenerationTimeEstimate): string {
  return `完成まで${estimate.label}かかります`;
}

export function formatRemainingTimeLabel(remainingSeconds: number): string {
  if (remainingSeconds <= 5) {
    return 'もうすぐ完成します';
  }
  if (remainingSeconds <= 45) {
    const rounded = Math.max(5, Math.round(remainingSeconds / 5) * 5);
    return `残り約${rounded}秒`;
  }
  if (remainingSeconds <= 75) {
    return '残り約1分';
  }
  if (remainingSeconds <= 120) {
    return '残り約1〜2分';
  }
  return '残り約2〜3分';
}

export function getLongRunningStatusMessage(): string {
  return '少し時間がかかっています。より詳しいプランを作成しています。';
}

export function getMultiDayTimingNote(): string {
  return '複数日分のスポット・移動・予算をまとめて調整しているため、少し時間がかかります。';
}

export function getStagedGenerationMessage(
  step: number,
  dayCount: number,
): string | undefined {
  if (dayCount < 3) return undefined;
  if (step <= 1) return 'まず全体プランを作成中';
  if (step === 2) return 'Day 1を詳しく作成中';
  if (step >= 3 && dayCount > 3) return '残りの日程はあとから詳しくできます';
  return undefined;
}

export function stepIndexForProgress(progress: number): number {
  const clamped = Math.min(Math.max(progress, 0), 0.99);
  const thresholds = [0.12, 0.28, 0.48, 0.65, 0.82, 1];
  const index = thresholds.findIndex((threshold) => clamped < threshold);
  return index === -1 ? PLAN_LOADING_STAGES.length - 1 : index;
}

export type PlanLoadingUiState = {
  step: number;
  progress: number;
  headline: string;
  estimateLabel: string;
  remainingLabel: string;
  statusHint: string;
  isLongRunning: boolean;
  showMultiDayNote: boolean;
  stagedMessage?: string;
};

export type PlanGenerationProgressHandle = {
  start: () => void;
  stop: () => void;
  complete: () => void;
};

export function createPlanGenerationProgress(input: {
  tripDuration: TripDurationOption;
  customDuration?: CustomTripDuration | null;
  durationLabel: string;
  onUpdate: (state: PlanLoadingUiState) => void;
}): PlanGenerationProgressHandle {
  const estimate = getGenerationTimeEstimate(input.tripDuration, input.customDuration);
  const durationConfig = resolveDurationConfig(input.tripDuration, input.customDuration);
  const dayCount = durationConfig.dayCount;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let startTime = 0;
  let stopped = false;

  const emit = (progress: number, forceLongRunning = false) => {
    const elapsedSec = startTime ? (Date.now() - startTime) / 1000 : 0;
    const longRunning = forceLongRunning || elapsedSec > estimate.maxSeconds * 1.15;
    const remainingSec = Math.max(0, estimate.maxSeconds - elapsedSec);
    const step = stepIndexForProgress(progress);

    input.onUpdate({
      step,
      progress,
      headline: buildLoadingHeadline(input.durationLabel),
      estimateLabel: buildEstimateMessage(estimate),
      remainingLabel: longRunning
        ? '完成まであと少し'
        : formatRemainingTimeLabel(remainingSec),
      statusHint: longRunning
        ? getLongRunningStatusMessage()
        : PLAN_LOADING_STAGES[step]?.hint ?? '',
      isLongRunning: longRunning,
      showMultiDayNote: estimate.isLongTrip || dayCount >= 4,
      stagedMessage: getStagedGenerationMessage(step, dayCount),
    });
  };

  return {
    start() {
      stopped = false;
      startTime = Date.now();
      emit(0.04);

      intervalId = setInterval(() => {
        if (stopped || !startTime) return;
        const elapsedSec = (Date.now() - startTime) / 1000;
        const rawProgress = elapsedSec / estimate.maxSeconds;
        const easedProgress = Math.min(0.92, rawProgress * 0.88 + 0.04);
        emit(easedProgress);
      }, 450);
    },
    stop() {
      stopped = true;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
    complete() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      emit(1, false);
      input.onUpdate({
        step: PLAN_LOADING_STAGES.length - 1,
        progress: 1,
        headline: buildLoadingHeadline(input.durationLabel),
        estimateLabel: '完成しました',
        remainingLabel: 'もうすぐ表示します',
        statusHint: '最終チェック中です',
        isLongRunning: false,
        showMultiDayNote: false,
      });
    },
  };
}

export function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && error.name === 'AbortError') return true;
  return false;
}
