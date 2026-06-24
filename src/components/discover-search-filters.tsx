import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  countActiveDiscoverFilters,
  getBudgetFilterOptions,
  getDiscoverCurrencyHint,
  resolveDiscoverCurrency,
} from '@/lib/discover-filters';
import {
  DEFAULT_DISCOVER_FILTERS,
  DISCOVER_FILTER_CHIPS,
  DISCOVER_SORT_OPTIONS,
  type DiscoverBudgetFilterId,
  type DiscoverFilterChipId,
  type DiscoverFilterState,
  type DiscoverSortOption,
} from '@/types/discover-filters';

type DiscoverSearchFiltersProps = {
  value: DiscoverFilterState;
  onChange: (next: DiscoverFilterState) => void;
};

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
      ]}
      onPress={onPress}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function DiscoverSearchFilters({ value, onChange }: DiscoverSearchFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const activeCount = countActiveDiscoverFilters(value);
  const displayCurrency = resolveDiscoverCurrency(value.areaQuery);
  const budgetOptions = useMemo(
    () => getBudgetFilterOptions(displayCurrency),
    [displayCurrency],
  );

  const patch = (patchValue: Partial<DiscoverFilterState>) => {
    onChange({ ...value, ...patchValue });
  };

  const toggleChip = (chipId: DiscoverFilterChipId) => {
    const selected = value.selectedChips.includes(chipId);
    patch({
      selectedChips: selected
        ? value.selectedChips.filter((id) => id !== chipId)
        : [...value.selectedChips, chipId],
    });
  };

  const toggleBudget = (budgetId: DiscoverBudgetFilterId) => {
    patch({
      budgetFilter: value.budgetFilter === budgetId ? null : budgetId,
    });
  };

  const resetFilters = () => {
    onChange(DEFAULT_DISCOVER_FILTERS);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={value.searchQuery}
          onChangeText={(text) => patch({ searchQuery: text })}
          placeholder="エリア・店名・気分で検索"
          placeholderTextColor={NS.colors.textMuted}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <PremiumCard variant="flat" style={styles.filterCard}>
        <Pressable
          style={({ pressed }) => [styles.filterHeader, pressed && styles.filterHeaderPressed]}
          onPress={() => setExpanded((prev) => !prev)}>
          <View style={styles.filterHeaderLeft}>
            <Text style={styles.filterTitle}>フィルター</Text>
            {activeCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeCount}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.expandIcon}>{expanded ? '▾' : '▸'}</Text>
        </Pressable>

        {activeCount > 0 ? (
          <Pressable
            style={({ pressed }) => [styles.resetRow, pressed && styles.resetRowPressed]}
            onPress={resetFilters}>
            <Text style={styles.resetButtonText}>条件をリセット</Text>
          </Pressable>
        ) : null}

        {expanded ? (
          <View style={styles.filterBody}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>カテゴリー</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}>
                {DISCOVER_FILTER_CHIPS.map((chip) => (
                  <FilterChip
                    key={chip.id}
                    label={chip.label}
                    selected={value.selectedChips.includes(chip.id)}
                    onPress={() => toggleChip(chip.id)}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>予算</Text>
              <Text style={styles.sectionHint}>{getDiscoverCurrencyHint(displayCurrency)}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}>
                {budgetOptions.map((option) => (
                  <FilterChip
                    key={option.id}
                    label={option.label}
                    selected={value.budgetFilter === option.id}
                    onPress={() => toggleBudget(option.id)}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>エリア</Text>
              <TextInput
                style={styles.areaInput}
                value={value.areaQuery}
                onChangeText={(text) => patch({ areaQuery: text })}
                placeholder="例：大阪、東京、Melbourne、Seoul、京都"
                placeholderTextColor={NS.colors.textMuted}
                returnKeyType="done"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>並び替え</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}>
                {DISCOVER_SORT_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    selected={value.sort === option.value}
                    onPress={() => patch({ sort: option.value as DiscoverSortOption })}
                  />
                ))}
              </ScrollView>
            </View>
          </View>
        ) : null}
      </PremiumCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    ...NS.shadow.card,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: Spacing.two,
  },
  searchInput: {
    flex: 1,
    color: NS.colors.text,
    fontSize: 15,
    paddingVertical: Spacing.three,
  },
  filterCard: {
    padding: 0,
    overflow: 'hidden',
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  filterHeaderPressed: {
    opacity: 0.92,
  },
  filterHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  filterTitle: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  filterBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeText: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  resetRow: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  resetRowPressed: {
    opacity: 0.88,
  },
  resetButtonText: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  expandIcon: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  filterBody: {
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  sectionLabel: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sectionHint: {
    color: NS.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  chipRow: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  chip: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  chipSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  chipLabelSelected: {
    color: NS.colors.accent,
  },
  areaInput: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    color: NS.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
