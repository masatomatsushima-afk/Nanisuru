import type { CurrencyCode } from '@/constants/currency';
import type { CompanionOption } from '@/types/plan';
import type { SavedTripPayload } from '@/types/trip';

export type TripFolderContextNotes = {
  flightNotes?: string;
  hotelNotes?: string;
  savedPlaces?: string[];
};

export type TripFolder = {
  id: string;
  userId: string;
  title: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  durationLabel: string;
  companionType: string;
  budget: string;
  currency: CurrencyCode;
  savedTripId: string | null;
  planPayload: SavedTripPayload | null;
  contextNotes: TripFolderContextNotes;
  createdAt: string;
  updatedAt: string;
};

export type TripAssistantMessage = {
  id: string;
  tripFolderId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type CreateTripFolderInput = {
  title: string;
  destination: string;
  departureDate?: string;
  returnDate?: string;
  durationLabel?: string;
  companionType: CompanionOption | string;
  budget?: string;
  currency?: CurrencyCode;
  savedTripId?: string | null;
  planPayload?: SavedTripPayload | null;
  contextNotes?: TripFolderContextNotes;
};

export const TRIP_FOLDER_QUICK_ACTIONS = [
  'プランを見直す',
  '予算を調整する',
  '服装を相談する',
  '持ち物を確認する',
  'ホテル周辺で探す',
  '雨の日プランに変更する',
  '思い出をまとめる',
] as const;

export type TripFolderQuickAction = (typeof TRIP_FOLDER_QUICK_ACTIONS)[number];

export function formatTripFolderLabel(folder: TripFolder): string {
  const datePart =
    folder.departureDate && folder.returnDate
      ? `${folder.departureDate.slice(0, 7).replace('-', '年')}月`
      : folder.durationLabel;
  if (datePart && !folder.title.includes(datePart)) {
    return `${folder.title}${datePart ? ` ${datePart}` : ''}`;
  }
  return folder.title || folder.destination || '旅行フォルダ';
}
