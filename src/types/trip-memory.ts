export type TripMemoryVisibility = 'private' | 'unlisted' | 'public';

export type TripMemoryMediaType = 'photo' | 'video' | 'note';

export type TripMemoryAiSummary = {
  memoryTitle: string;
  oneLineSummary: string;
  highlights: [string, string, string];
  emotionalNote: string;
  nextTimeTips: string;
};

export type TripMemory = {
  id: string;
  userId: string;
  tripId: string | null;
  title: string;
  destination: string;
  dateLabel: string;
  durationLabel: string;
  companion: string;
  coverImageUrl: string | null;
  summary: string;
  aiSummary: TripMemoryAiSummary | null;
  favoriteMoments: string[];
  visibility: TripMemoryVisibility;
  likeCount: number;
  saveCount: number;
  commentCount: number;
  showOnProfile: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TripMemoryMedia = {
  id: string;
  memoryId: string;
  mediaUrl: string | null;
  storagePath: string | null;
  mediaType: TripMemoryMediaType;
  caption: string;
  timelineTime: string;
  placeName: string;
  latitude: number | null;
  longitude: number | null;
  itineraryDayNumber: number | null;
  itineraryItemTime: string | null;
  itineraryItemActivity: string | null;
  isFavorite: boolean;
  orderIndex: number;
  createdAt: string;
};

export type TripMemoryWithMedia = TripMemory & {
  media: TripMemoryMedia[];
};

export type TripMemoryComment = {
  id: string;
  memoryId: string;
  userId: string;
  body: string;
  createdAt: string;
  authorDisplayName?: string;
};

export type ItineraryMemorySlot = {
  dayNumber: number;
  time: string;
  activity: string;
  placeName?: string;
};

export type MemoryPeriodGroup = {
  year: number;
  month: number;
  label: string;
  memories: TripMemory[];
};
