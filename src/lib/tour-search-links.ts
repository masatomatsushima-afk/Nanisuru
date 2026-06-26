export type TourSearchKind = 'local' | 'dayTrip' | 'activity' | 'ticket';

function encodeQuery(value: string): string {
  return encodeURIComponent(value.trim());
}

function buildGoogleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeQuery(query)}`;
}

function buildGoogleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeQuery(query)}`;
}

function buildGetYourGuideSearchUrl(query: string): string {
  return `https://www.getyourguide.com/s/?q=${encodeQuery(query)}`;
}

function buildKlookSearchUrl(query: string): string {
  return `https://www.klook.com/search/result/?query=${encodeQuery(query)}`;
}

function buildViatorSearchUrl(query: string): string {
  return `https://www.viator.com/searchResults/all?text=${encodeQuery(query)}`;
}

export function buildTourSearchQuery(
  destination: string,
  kind: TourSearchKind,
): string {
  const place = destination.trim() || '旅行先';

  switch (kind) {
    case 'local':
      return `${place} local experience tour`;
    case 'dayTrip':
      return `${place} day tour`;
    case 'activity':
      return `${place} activity`;
    case 'ticket':
      return `${place} activity ticket`;
    default:
      return `${place} tour`;
  }
}

export type TourSearchLink = {
  id: TourSearchKind;
  label: string;
  icon: string;
  urls: {
    google: string;
    googleMaps: string;
    getYourGuide: string;
    klook: string;
    viator: string;
  };
};

export function buildTourSearchLinks(destination: string): TourSearchLink[] {
  const configs: Array<{ id: TourSearchKind; label: string; icon: string }> = [
    { id: 'local', label: '現地ツアーを探す', icon: '🧭' },
    { id: 'dayTrip', label: '日帰りツアーを探す', icon: '🚌' },
    { id: 'activity', label: 'アクティビティを探す', icon: '🎯' },
    { id: 'ticket', label: '体験チケットを探す', icon: '🎫' },
  ];

  return configs.map((config) => {
    const query = buildTourSearchQuery(destination, config.id);
    return {
      ...config,
      urls: {
        google: buildGoogleSearchUrl(query),
        googleMaps: buildGoogleMapsSearchUrl(`${destination} tour experience`),
        getYourGuide: buildGetYourGuideSearchUrl(query),
        klook: buildKlookSearchUrl(query),
        viator: buildViatorSearchUrl(query),
      },
    };
  });
}

export function getPrimaryTourSearchUrl(destination: string, kind: TourSearchKind): string {
  const query = buildTourSearchQuery(destination, kind);
  return buildGoogleSearchUrl(query);
}
