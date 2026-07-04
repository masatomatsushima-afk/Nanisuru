import { getDurationDisplayLabel } from '@/lib/trip-duration';
import type { TravelBudgetIncludeOption } from '@/lib/travel-budget-includes';
import { isDateRelatedCompanion } from '@/types/plan';
import type { CreateSavedTripInput, SavedTripPayload } from '@/types/trip';

export function buildCurrentPlanPayload(
  input: CreateSavedTripInput & {
    budgetIncludes?: TravelBudgetIncludeOption[];
    travelPurpose?: string;
    preserveSavedAt?: string;
  },
): SavedTripPayload {
  const now = new Date().toISOString();
  const { preserveSavedAt, budgetIncludes, travelPurpose, ...rest } = input;

  return {
    ...rest,
    budgetIncludes,
    travelPurpose,
    savedAt: preserveSavedAt ?? rest.savedAt ?? now,
    updatedAt: now,
  };
}

export function buildTripFolderTitle(payload: SavedTripPayload): string {
  const destination = payload.location.trim() || '旅行';
  const durationLabel = getDurationDisplayLabel(payload.tripDuration, payload.customDuration);
  const departure = payload.details.tripDate?.trim();

  if (isDateRelatedCompanion(payload.companion)) {
    return durationLabel ? `${destination}デート ${durationLabel}` : `${destination}デート`;
  }

  if (departure) {
    const date = new Date(`${departure}T12:00:00`);
    if (!Number.isNaN(date.getTime())) {
      const monthLabel = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      if (durationLabel && durationLabel.includes('泊')) {
        return `${destination}旅行 ${durationLabel}`;
      }
      return `${destination}旅行 ${monthLabel}`;
    }
  }

  return durationLabel ? `${destination}旅行 ${durationLabel}` : `${destination}旅行`;
}
