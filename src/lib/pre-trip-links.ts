import type { BookingLink, PreTripCardId } from '@/types/pre-trip';

function encodeQuery(value: string): string {
  return encodeURIComponent(value.trim());
}

export function buildGoogleFlightsUrl(input: {
  destination: string;
  departureDate?: string;
  returnDate?: string;
}): string {
  const destination = input.destination.trim() || '旅行先';
  const query = input.returnDate
    ? ` flights to ${destination} ${input.departureDate ?? ''} ${input.returnDate}`
    : ` flights to ${destination}`;
  return `https://www.google.com/travel/flights?q=${encodeQuery(query)}`;
}

export function buildGoogleHotelsUrl(input: {
  destination: string;
  departureDate?: string;
  returnDate?: string;
}): string {
  const destination = input.destination.trim() || '旅行先';
  const query = input.departureDate
    ? ` hotels in ${destination} ${input.departureDate}${input.returnDate ? ` ${input.returnDate}` : ''}`
    : ` hotels in ${destination}`;
  return `https://www.google.com/travel/hotels/${encodeQuery(destination)}?q=${encodeQuery(query)}`;
}

export function buildGoogleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeQuery(query)}`;
}

export function buildAirportTransferSearchUrl(destination: string): string {
  return buildGoogleMapsSearchUrl(`${destination.trim() || '旅行先'} 空港 駅 交通`);
}

export function buildWeatherSearchUrl(destination: string, date?: string): string {
  const query = date ? `${destination} 天気 ${date}` : `${destination} 天気`;
  return `https://www.google.com/search?q=${encodeQuery(query)}`;
}

export function buildCurrencySearchUrl(destination: string, currencyCode?: string): string {
  const query = currencyCode
    ? `${destination} ${currencyCode} 為替 レート`
    : `${destination} 現地通貨 両替`;
  return `https://www.google.com/search?q=${encodeQuery(query)}`;
}

export function buildPackingListSearchUrl(destination: string, date?: string): string {
  const query = date
    ? `${destination} 旅行 持ち物リスト ${date}`
    : `${destination} 旅行 持ち物リスト`;
  return `https://www.google.com/search?q=${encodeQuery(query)}`;
}

export function buildReservationsSearchUrl(destination: string): string {
  return `https://www.google.com/search?q=${encodeQuery(`${destination} 観光 予約 必要`)}`;
}

export function getPreTripCardUrl(
  cardId: PreTripCardId,
  input: {
    destination: string;
    departureDate?: string;
    returnDate?: string;
    currencyCode?: string;
  },
): string {
  switch (cardId) {
    case 'flights':
      return buildGoogleFlightsUrl(input);
    case 'hotels':
      return buildGoogleHotelsUrl(input);
    case 'airportTransfer':
      return buildAirportTransferSearchUrl(input.destination);
    case 'packingList':
      return buildPackingListSearchUrl(input.destination, input.departureDate);
    case 'reservations':
      return buildReservationsSearchUrl(input.destination);
    case 'weatherClothing':
      return buildWeatherSearchUrl(input.destination, input.departureDate);
    case 'localCurrency':
      return buildCurrencySearchUrl(input.destination, input.currencyCode);
    default:
      return buildGoogleMapsSearchUrl(input.destination);
  }
}

export function buildDefaultPreTripBookingLinks(input: {
  destination: string;
  departureDate?: string;
  returnDate?: string;
}): BookingLink[] {
  return [
    {
      id: 'flights',
      label: '飛行機を探す',
      url: buildGoogleFlightsUrl(input),
      category: 'flight',
    },
    {
      id: 'hotels',
      label: 'ホテルを探す',
      url: buildGoogleHotelsUrl(input),
      category: 'hotel',
    },
    {
      id: 'map',
      label: '地図でエリアを見る',
      url: buildGoogleMapsSearchUrl(input.destination),
      category: 'map',
    },
  ];
}
