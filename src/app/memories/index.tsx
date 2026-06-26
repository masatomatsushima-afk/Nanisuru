import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TripMemoryFolderCard } from '@/components/trip-memory-folder-card';
import { ScreenBackground } from '@/components/ui/screen-background';
import { FadeInView } from '@/components/ui/fade-in-view';
import { PremiumCard } from '@/components/ui/premium-card';
import { RequireAuthGate } from '@/components/require-auth-gate';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import {
  fetchUserTripMemories,
  filterMemoriesByMonth,
  filterMemoriesByYear,
  groupMemoriesByPeriod,
} from '@/lib/trip-memories';
import type { TripMemory } from '@/types/trip-memory';

type FilterMode = 'all' | 'year' | 'month';

export default function MemoriesHubScreen() {
  const insets = useSafeAreaInsets();
  const { session, isConfigured, isLoading: authLoading } = useAuth();
  const [memories, setMemories] = useState<TripMemory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const loadMemories = useCallback(async () => {
    if (!isConfigured || !session) return;
    setIsLoading(true);
    try {
      setMemories(await fetchUserTripMemories());
    } catch {
      setMemories([]);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, session]);

  useFocusEffect(
    useCallback(() => {
      void loadMemories();
    }, [loadMemories]),
  );

  const periodGroups = useMemo(() => groupMemoriesByPeriod(memories), [memories]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const memory of memories) {
      years.add(new Date(memory.createdAt).getFullYear());
      const isoMatch = memory.dateLabel.match(/\d{4}/);
      if (isoMatch) years.add(Number(isoMatch[0]));
    }
    return [...years].sort((a, b) => b - a);
  }, [memories]);

  const filteredMemories = useMemo(() => {
    if (filterMode === 'year') return filterMemoriesByYear(memories, selectedYear);
    if (filterMode === 'month') {
      return filterMemoriesByMonth(memories, selectedYear, selectedMonth);
    }
    return memories;
  }, [filterMode, memories, selectedMonth, selectedYear]);

  const filterLabel =
    filterMode === 'year'
      ? `${selectedYear}年の思い出`
      : filterMode === 'month'
        ? `${selectedYear}年${selectedMonth}月の思い出`
        : 'すべての思い出';

  return (
    <RequireAuthGate
      title="思い出を見るにはログインが必要です"
      description="旅の写真・動画・メモはアカウントに安全に保存されます。"
      loadingMessage="確認中...">
      <ScreenBackground>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + Spacing.four,
              paddingBottom: insets.bottom + Spacing.six,
            },
          ]}
          showsVerticalScrollIndicator={false}>
          <FadeInView>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>← 戻る</Text>
            </Pressable>
            <Text style={styles.eyebrow}>📔 MEMORIES</Text>
            <Text style={styles.title}>思い出</Text>
            <Text style={styles.subtitle}>旅のあとに残した、あなただけのトラベルダイアリー</Text>
          </FadeInView>

          <FadeInView delay={40}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <Pressable
                style={[styles.filterChip, filterMode === 'all' && styles.filterChipActive]}
                onPress={() => setFilterMode('all')}>
                <Text style={[styles.filterChipText, filterMode === 'all' && styles.filterChipTextActive]}>
                  すべて
                </Text>
              </Pressable>
              {availableYears.map((year) => (
                <Pressable
                  key={year}
                  style={[
                    styles.filterChip,
                    filterMode === 'year' && selectedYear === year && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setSelectedYear(year);
                    setFilterMode('year');
                  }}>
                  <Text
                    style={[
                      styles.filterChipText,
                      filterMode === 'year' && selectedYear === year && styles.filterChipTextActive,
                    ]}>
                    {year}年
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={[
                  styles.filterChip,
                  filterMode === 'month' && styles.filterChipActive,
                ]}
                onPress={() => setFilterMode('month')}>
                <Text style={[styles.filterChipText, filterMode === 'month' && styles.filterChipTextActive]}>
                  月別
                </Text>
              </Pressable>
            </ScrollView>
          </FadeInView>

          {filterMode === 'month' ? (
            <FadeInView delay={50}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <Pressable
                    key={month}
                    style={[styles.filterChip, selectedMonth === month && styles.filterChipActive]}
                    onPress={() => setSelectedMonth(month)}>
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedMonth === month && styles.filterChipTextActive,
                      ]}>
                      {month}月
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </FadeInView>
          ) : null}

          {authLoading || isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={NS.colors.accent} />
            </View>
          ) : memories.length === 0 ? (
            <FadeInView delay={80}>
              <PremiumCard style={styles.empty}>
                <Text style={styles.emptyEmoji}>📸</Text>
                <Text style={styles.emptyTitle}>まだ思い出フォルダがありません</Text>
                <Text style={styles.emptyText}>
                  保存したプランの詳細画面から、写真やメモを追加できます
                </Text>
              </PremiumCard>
            </FadeInView>
          ) : filterMode === 'all' ? (
            periodGroups.map((group) => (
              <FadeInView key={group.label} delay={80}>
                <Text style={styles.periodTitle}>{group.label}の思い出</Text>
                <View style={styles.grid}>
                  {group.memories.map((memory) => (
                    <View key={memory.id} style={styles.gridItem}>
                      <TripMemoryFolderCard
                        memory={memory}
                        onPress={() => router.push(`/memory/${memory.id}`)}
                      />
                    </View>
                  ))}
                </View>
              </FadeInView>
            ))
          ) : (
            <>
              <FadeInView delay={60}>
                <Text style={styles.sectionTitle}>{filterLabel}</Text>
              </FadeInView>
              <View style={styles.grid}>
                {filteredMemories.map((memory) => (
                  <View key={memory.id} style={styles.gridItem}>
                    <TripMemoryFolderCard
                      memory={memory}
                      onPress={() => router.push(`/memory/${memory.id}`)}
                    />
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </ScreenBackground>
    </RequireAuthGate>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  backButton: {
    marginBottom: Spacing.two,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: NS.colors.accent,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: NS.colors.coral,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: NS.colors.text,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: NS.colors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },
  filterRow: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  filterChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: NS.radius.pill,
    backgroundColor: NS.colors.bgElevated,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  filterChipActive: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
  filterChipTextActive: {
    color: NS.colors.accent,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: NS.colors.text,
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: NS.colors.textSecondary,
    marginTop: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  gridItem: {
    width: '100%',
  },
  loading: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  empty: {
    padding: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: NS.colors.text,
  },
  emptyText: {
    fontSize: 13,
    color: NS.colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
});
