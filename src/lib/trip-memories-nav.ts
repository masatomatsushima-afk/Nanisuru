import { savedTripPayloadToPlanParams } from '@/lib/saved-trips';

export function buildTripMemoriesParams(options: {
  savedTripId?: string | null;
  folderId?: string | null;
  tripTitle?: string | null;
  linkDayIndex?: number | null;
  linkItemIndex?: number | null;
}): Record<string, string> {
  const params: Record<string, string> = {};

  if (options.savedTripId?.trim()) {
    params.tripId = options.savedTripId.trim();
  }
  if (options.folderId?.trim()) {
    params.folderId = options.folderId.trim();
  }
  if (options.tripTitle?.trim()) {
    params.tripTitle = options.tripTitle.trim();
  }
  if (options.linkDayIndex !== undefined && options.linkDayIndex !== null) {
    params.linkDayIndex = String(options.linkDayIndex);
  }
  if (options.linkItemIndex !== undefined && options.linkItemIndex !== null) {
    params.linkItemIndex = String(options.linkItemIndex);
  }

  return params;
}

export function buildTripMemoriesFromPayloadParams(
  payload: Parameters<typeof savedTripPayloadToPlanParams>[0],
  savedTripId?: string | null,
  extras?: {
    folderId?: string | null;
    tripTitle?: string | null;
    linkDayIndex?: number | null;
    linkItemIndex?: number | null;
  },
): Record<string, string> {
  return {
    ...savedTripPayloadToPlanParams(payload, savedTripId),
    ...buildTripMemoriesParams({
      savedTripId,
      folderId: extras?.folderId,
      tripTitle: extras?.tripTitle,
      linkDayIndex: extras?.linkDayIndex,
      linkItemIndex: extras?.linkItemIndex,
    }),
  };
}

export function buildTripMemoriesFolderParams(
  folderId: string,
  options?: {
    tripTitle?: string;
    linkDayIndex?: number;
    linkItemIndex?: number;
  },
): Record<string, string> {
  return buildTripMemoriesParams({
    folderId,
    tripTitle: options?.tripTitle,
    linkDayIndex: options?.linkDayIndex,
    linkItemIndex: options?.linkItemIndex,
  });
}
