import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  fetchCurrentLocation,
  LOCATION_PERMISSION_DENIED_MESSAGE,
  type CurrentCoordinatesResult,
} from '@/lib/current-location';

export type FetchLocationOutcome = {
  location: CurrentCoordinatesResult | null;
  errorMessage: string | null;
};

type UserLocationContextValue = {
  location: CurrentCoordinatesResult | null;
  isLoading: boolean;
  permissionDenied: boolean;
  errorMessage: string | null;
  fetchLocation: () => Promise<FetchLocationOutcome>;
};

const UserLocationContext = createContext<UserLocationContextValue | null>(null);

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<CurrentCoordinatesResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchLocation = useCallback(async (): Promise<FetchLocationOutcome> => {
    setIsLoading(true);
    setErrorMessage(null);
    setPermissionDenied(false);

    try {
      const result = await fetchCurrentLocation();

      if (result.status === 'success') {
        setLocation(result.data);
        setPermissionDenied(false);
        setErrorMessage(null);
        return { location: result.data, errorMessage: null };
      }

      if (result.status === 'denied') {
        setPermissionDenied(true);
        setErrorMessage(LOCATION_PERMISSION_DENIED_MESSAGE);
        return { location: null, errorMessage: LOCATION_PERMISSION_DENIED_MESSAGE };
      }

      const message = '現在地を取得できませんでした';
      setErrorMessage(message);
      return { location: null, errorMessage: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      location,
      isLoading,
      permissionDenied,
      errorMessage,
      fetchLocation,
    }),
    [location, isLoading, permissionDenied, errorMessage, fetchLocation],
  );

  return (
    <UserLocationContext.Provider value={value}>{children}</UserLocationContext.Provider>
  );
}

export function useUserLocation(): UserLocationContextValue {
  const context = useContext(UserLocationContext);
  if (!context) {
    throw new Error('useUserLocation must be used within UserLocationProvider');
  }
  return context;
}
