import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { SuccessOverlay } from '@/components/success-overlay';
import { PrimaryButton } from '@/components/ui/premium-card';
import { useAuth } from '@/contexts/auth-context';
import { saveTrip } from '@/lib/saved-trips';
import type { CurrencyCode } from '@/constants/currency';
import type {
  CompanionOption,
  ItineraryDay,
  ItineraryItem,
  PersonalityOption,
  PlanDetails,
  TripDurationOption,
} from '@/types/plan';
import type { SavedTrip } from '@/types/trip';

type SaveTripButtonProps = {
  location: string;
  budget: string;
  currency: CurrencyCode;
  people: string;
  mood: string;
  companion: CompanionOption;
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
  days: ItineraryDay[];
  items: ItineraryItem[];
  details: PlanDetails;
  onSaved?: (trip: SavedTrip) => void;
};

export function SaveTripButton({
  location,
  budget,
  currency,
  people,
  mood,
  companion,
  personality,
  tripDuration,
  days,
  items,
  details,
  onSaved,
}: SaveTripButtonProps) {
  const { session, isConfigured } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const handleSave = async () => {
    if (!isConfigured) {
      Alert.alert(
        'Supabase未設定',
        '.env に EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY を設定してください。',
      );
      return;
    }

    if (!session) {
      Alert.alert('ログインが必要です', 'プランを保存するにはログインしてください。', [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'ログイン', onPress: () => router.push('/login') },
      ]);
      return;
    }

    if (isSaving) return;

    setIsSaving(true);
    try {
      const saved = await saveTrip({
        location,
        budget,
        currency,
        people,
        mood,
        companion,
        personality,
        tripDuration,
        days,
        items,
        details,
      });
      onSaved?.(saved);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 1600);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'プランの保存に失敗しました';
      Alert.alert('保存エラー', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <SuccessOverlay visible={showSaved} message="プランを保存しました！" />
      <PrimaryButton
        label={isSaving ? '保存中...' : 'プランを保存'}
        onPress={handleSave}
        disabled={isSaving}
        variant="secondary"
      />
    </>
  );
}
