import { useState } from 'react';
import { Alert, Platform, Share } from 'react-native';

import { PrimaryButton } from '@/components/ui/premium-card';
import { buildShareMessage, createSharedTrip } from '@/lib/trip-sharing';
import type {
  CompanionOption,
  ItineraryDay,
  ItineraryItem,
  PersonalityOption,
  PlanDetails,
  TripDurationOption,
} from '@/types/plan';

type ShareTripButtonProps = {
  location: string;
  companion: CompanionOption;
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
  days: ItineraryDay[];
  items: ItineraryItem[];
  details: PlanDetails;
};

export function ShareTripButton({
  location,
  companion,
  personality,
  tripDuration,
  days,
  items,
  details,
}: ShareTripButtonProps) {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (isSharing) return;

    setIsSharing(true);
    try {
      const shared = await createSharedTrip({
        location,
        companion,
        personality,
        tripDuration,
        days,
        items,
        details,
      });

      const message = buildShareMessage(shared.title, shared.url);

      await Share.share(
        Platform.OS === 'ios'
          ? { message, url: shared.url, title: shared.title }
          : { message, title: shared.title },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '共有リンクの作成に失敗しました';
      Alert.alert('共有エラー', message);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <PrimaryButton
      label={isSharing ? 'リンクを作成中...' : 'プランをシェア'}
      onPress={handleShare}
      disabled={isSharing}
      variant="secondary"
    />
  );
}
