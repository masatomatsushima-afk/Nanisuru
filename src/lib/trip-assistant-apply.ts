import { applyPartialEditResult } from '@/lib/itinerary-partial-edit';
import { saveItineraryEdit } from '@/lib/itinerary-edits';
import { buildCurrentPlanPayload } from '@/lib/save-plan-state';
import { updateTrip } from '@/lib/saved-trips';
import { updateTripFolderPlanPayload } from '@/lib/trip-folders';
import { buildItineraryItemId } from '@/types/itinerary-edit';
import type { SavedTripPayload } from '@/types/trip';
import type { TripAssistantAction, TripAssistantContext } from '@/types/trip-assistant';
import type { TripFolder } from '@/types/trip-folder';

export async function applyTripAssistantAction(params: {
  action: TripAssistantAction;
  context: TripAssistantContext;
  folder: TripFolder;
}): Promise<{ nextPayload: SavedTripPayload; updatedFolder: TripFolder | null }> {
  const { action, context, folder } = params;

  if (!context.latestPlan) {
    throw new Error('反映できるプランがありません');
  }

  console.log('[TripAssistantAction] applying change', {
    title: action.title,
    targetDayIndex: action.targetDayIndex,
    targetItemIndex: action.targetItemIndex,
    beforeItem: action.beforeItem.activity,
    afterItem: action.afterItem.activity,
  });

  const merged = applyPartialEditResult(context.latestPlan, action.editProposal);
  const nextPayload = buildCurrentPlanPayload({
    ...merged,
    preserveSavedAt: context.latestPlan.savedAt,
  });

  const updatedFolder = await updateTripFolderPlanPayload(folder.id, nextPayload);

  if (folder.savedTripId) {
    await updateTrip(folder.savedTripId, nextPayload, undefined, nextPayload.savedAt);
  }

  await saveItineraryEdit({
    tripId: folder.savedTripId,
    folderId: folder.id,
    source: 'trip_assistant',
    dayIndex: action.targetDayIndex,
    itemId: buildItineraryItemId(action.target),
    editRequest: action.editRequest,
    beforeData: {
      item: action.beforeItem,
      dayIndex: action.targetDayIndex,
      itemIndex: action.targetItemIndex,
      reason: action.reason,
      source: 'trip_assistant',
    },
    afterData: {
      item: action.afterItem,
      dayIndex: action.targetDayIndex,
      itemIndex: action.targetItemIndex,
      reason: action.reason,
      source: 'trip_assistant',
    },
  });

  console.log('[TripAssistantAction] apply success');

  return { nextPayload, updatedFolder };
}
