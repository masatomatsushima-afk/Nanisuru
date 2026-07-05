import { savedTripPayloadToPlanParams } from '@/lib/saved-trips';
import type { SavedTripPayload } from '@/types/trip';

export function buildTripDayModeParams(
  payload: SavedTripPayload,
  options?: {
    savedTripId?: string | null;
    folderId?: string | null;
    tripTitle?: string | null;
  },
): Record<string, string> {
  const params = savedTripPayloadToPlanParams(payload, options?.savedTripId);

  if (options?.folderId?.trim()) {
    params.folderId = options.folderId.trim();
  }
  if (options?.tripTitle?.trim()) {
    params.tripTitle = options.tripTitle.trim();
  }

  return params;
}

export function buildTripDayModeFolderParams(folderId: string, tripTitle?: string): Record<string, string> {
  const params: Record<string, string> = { folderId: folderId.trim() };
  if (tripTitle?.trim()) {
    params.tripTitle = tripTitle.trim();
  }
  return params;
}
