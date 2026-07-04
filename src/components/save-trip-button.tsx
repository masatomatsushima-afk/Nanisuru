import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { SuccessOverlay } from '@/components/success-overlay';
import { PrimaryButton } from '@/components/ui/premium-card';
import { useAuth } from '@/contexts/auth-context';
import { saveOrUpdateTrip } from '@/lib/saved-trips';
import type { CurrencyCode } from '@/constants/currency';
import type { TravelBudgetIncludeOption } from '@/lib/travel-budget-includes';
import type {
  CompanionOption,
  ItineraryDay,
  ItineraryItem,
  PersonalityOption,
  PlanDetails,
  TripDurationOption,
} from '@/types/plan';
import type { PlanCustomPreferences } from '@/types/plan-preferences';
import type { CustomTripDuration } from '@/types/trip-schedule';
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
  customDuration?: CustomTripDuration;
  days: ItineraryDay[];
  items: ItineraryItem[];
  details: PlanDetails;
  budgetIncludes?: TravelBudgetIncludeOption[];
  travelPurpose?: string;
  customPreferences?: PlanCustomPreferences;
  savedTripId?: string | null;
  preserveSavedAt?: string;
  label?: string;
  variant?: 'primary' | 'secondary';
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
  customDuration,
  days,
  items,
  details,
  budgetIncludes,
  travelPurpose,
  customPreferences,
  savedTripId,
  preserveSavedAt,
  label,
  variant = 'secondary',
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
      const saved = await saveOrUpdateTrip(savedTripId, {
        location,
        budget,
        currency,
        people,
        mood,
        companion,
        personality,
        tripDuration,
        customDuration,
        days,
        items,
        details,
        budgetIncludes,
        travelPurpose,
        customPreferences,
      }, { preserveSavedAt });
      onSaved?.(saved);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 1600);
    } catch {
      Alert.alert('保存に失敗しました', '保存に失敗しました。もう一度お試しください');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <SuccessOverlay visible={showSaved} message="プランを保存しました" />
      <PrimaryButton
        label={isSaving ? '保存中…' : (label ?? 'このプランを保存')}
        onPress={handleSave}
        disabled={isSaving}
        variant={variant}
      />
    </>
  );
}
