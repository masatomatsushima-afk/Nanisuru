/** Future-ready placeholders for pre-trip planning integrations. */

export type FlightRecommendation = {
  id: string;
  airline: string;
  route: string;
  departureTime?: string;
  priceEstimate?: string;
  bookingUrl?: string;
};

export type HotelRecommendation = {
  id: string;
  name: string;
  area: string;
  priceEstimate?: string;
  rating?: number;
  bookingUrl?: string;
};

export type BookingLink = {
  id: string;
  label: string;
  url: string;
  category: 'flight' | 'hotel' | 'map' | 'activity' | 'other';
};

export type PreTripChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  category?: string;
};

export type PreTripPlanningData = {
  flightRecommendations?: FlightRecommendation[];
  hotelRecommendations?: HotelRecommendation[];
  bookingLinks?: BookingLink[];
  preTripChecklist?: PreTripChecklistItem[];
};

export const PRE_TRIP_CARD_OPTIONS = [
  { id: 'flights', label: '飛行機を探す', icon: '✈️' },
  { id: 'hotels', label: 'ホテルを探す', icon: '🏨' },
  { id: 'airportTransfer', label: '空港からの移動', icon: '🚕' },
  { id: 'packingList', label: '持ち物リスト', icon: '🧳' },
  { id: 'reservations', label: '予約が必要な場所', icon: '📅' },
  { id: 'weatherClothing', label: '天気と服装', icon: '🌤' },
  { id: 'localCurrency', label: '現地通貨', icon: '💴' },
] as const;

export type PreTripCardId = (typeof PRE_TRIP_CARD_OPTIONS)[number]['id'];
