import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  LOCAL_GEM_TIME_SLOTS,
  addLocalGemToSavedTrip,
  listSavedTripsForGemPlan,
} from '@/lib/local-gem-plan';
import type { LocalHiddenSpot } from '@/types/local-hidden-spot';
import type { SavedTrip } from '@/types/trip';

type LocalGemAddToPlanSheetProps = {
  visible: boolean;
  spot: LocalHiddenSpot;
  onClose: () => void;
  onAdded?: () => void;
};

export function LocalGemAddToPlanSheet({
  visible,
  spot,
  onClose,
  onAdded,
}: LocalGemAddToPlanSheetProps) {
  const insets = useSafeAreaInsets();
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [timeSlot, setTimeSlot] = useState<string>(LOCAL_GEM_TIME_SLOTS[2]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    setIsLoading(true);
    setError(null);
    void listSavedTripsForGemPlan()
      .then((loaded) => {
        setTrips(loaded);
        setSelectedTripId(loaded[0]?.id ?? null);
        setDayIndex(0);
      })
      .catch(() => {
        setTrips([]);
        setError('保存済みプランの取得に失敗しました');
      })
      .finally(() => setIsLoading(false));
  }, [visible]);

  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? null;
  const dayOptions = selectedTrip?.payload.days ?? [];

  const handleAdd = async () => {
    if (!selectedTripId) {
      setError('プランを選択してください');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await addLocalGemToSavedTrip({
        gemId: spot.id,
        spot,
        tripId: selectedTripId,
        dayIndex,
        timeSlot,
      });
      onAdded?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'プランへの追加に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + Spacing.two }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={styles.cancel}>キャンセル</Text>
          </Pressable>
          <Text style={styles.title}>プランに追加</Text>
          <View style={styles.spacer} />
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
          <Text style={styles.lead}>
            「{spot.name}」を保存済みプランの行程に追加します。
          </Text>

          {isLoading ? (
            <ActivityIndicator color={NS.colors.accent} style={styles.loader} />
          ) : trips.length === 0 ? (
            <Text style={styles.empty}>保存済みプランがありません。先にプランを保存してください。</Text>
          ) : (
            <>
              <Text style={styles.label}>保存済みプラン</Text>
              <View style={styles.chipRow}>
                {trips.map((trip) => (
                  <Pressable
                    key={trip.id}
                    style={[styles.chip, selectedTripId === trip.id && styles.chipActive]}
                    onPress={() => {
                      setSelectedTripId(trip.id);
                      setDayIndex(0);
                    }}>
                    <Text style={[styles.chipText, selectedTripId === trip.id && styles.chipTextActive]}>
                      {trip.title}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {dayOptions.length ? (
                <>
                  <Text style={styles.label}>日を選ぶ</Text>
                  <View style={styles.chipRow}>
                    {dayOptions.map((day, index) => (
                      <Pressable
                        key={day.dayNumber}
                        style={[styles.chip, dayIndex === index && styles.chipActive]}
                        onPress={() => setDayIndex(index)}>
                        <Text style={[styles.chipText, dayIndex === index && styles.chipTextActive]}>
                          {day.label || `${day.dayNumber}日目`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={styles.label}>時間帯</Text>
              <View style={styles.chipRow}>
                {LOCAL_GEM_TIME_SLOTS.map((slot) => (
                  <Pressable
                    key={slot}
                    style={[styles.chip, timeSlot === slot && styles.chipActive]}
                    onPress={() => setTimeSlot(slot)}>
                    <Text style={[styles.chipText, timeSlot === slot && styles.chipTextActive]}>
                      {slot}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            label={isSaving ? '追加中...' : 'この場所をプランに追加'}
            onPress={() => void handleAdd()}
            disabled={isSaving || trips.length === 0}
            variant="mint"
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NS.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: NS.colors.border,
  },
  cancel: { color: NS.colors.textSecondary, fontSize: 15, fontWeight: '600' },
  title: { color: NS.colors.text, fontSize: 16, fontWeight: '800' },
  spacer: { width: 64 },
  content: { padding: Spacing.four, gap: Spacing.three },
  lead: { color: NS.colors.textSecondary, fontSize: 13, lineHeight: 20 },
  label: { color: NS.colors.textSecondary, fontSize: 13, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.border,
    backgroundColor: NS.colors.bgElevated,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  chipActive: {
    backgroundColor: NS.colors.mintSoft,
    borderColor: '#059669',
  },
  chipText: { fontSize: 12, fontWeight: '700', color: NS.colors.textSecondary },
  chipTextActive: { color: '#047857' },
  loader: { paddingVertical: Spacing.four },
  empty: { color: NS.colors.textMuted, fontSize: 13, lineHeight: 20 },
  error: { color: NS.colors.danger, fontSize: 13 },
});
