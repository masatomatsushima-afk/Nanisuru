import type { PlanDetails } from '@/types/plan';

export type BestDayPresentation = {
  theme: string;
  whyThisPlan: string | null;
  conciergeMessage: string | null;
  highlights: string[];
};

export function buildBestDayPresentation(
  theme: string,
  details: PlanDetails | null,
): BestDayPresentation {
  if (!details) {
    return {
      theme,
      whyThisPlan: null,
      conciergeMessage: null,
      highlights: [],
    };
  }

  const whyThisPlan =
    details.conciergeAnalysis?.overallStrategy?.trim() ||
    null;

  const conciergeMessage = details.plannerMessage?.trim() || null;

  return {
    theme,
    whyThisPlan,
    conciergeMessage,
    highlights: details.highlights ?? [],
  };
}

export function formatThemeQuote(theme: string): string {
  const trimmed = theme.trim();
  if (trimmed.startsWith('「') && trimmed.endsWith('」')) return trimmed;
  return `「${trimmed}」`;
}
