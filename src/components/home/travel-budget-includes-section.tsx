import { StyleSheet, Text, View } from 'react-native';

import { SelectChip } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  TRAVEL_BUDGET_INCLUDE_OPTIONS,
  toggleTravelBudgetInclude,
  travelBudgetIncludesIncludeFlightsOrHotels,
  type TravelBudgetIncludeOption,
} from '@/lib/travel-budget-includes';

type TravelBudgetIncludesSectionProps = {
  value: TravelBudgetIncludeOption[];
  onChange: (next: TravelBudgetIncludeOption[]) => void;
};

export function TravelBudgetIncludesSection({
  value,
  onChange,
}: TravelBudgetIncludesSectionProps) {
  const showFlightHotelHint = travelBudgetIncludesIncludeFlightsOrHotels(value);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>予算に含めるもの</Text>
      <Text style={styles.subtitle}>この金額をどこまで含めるか選んでください</Text>

      <View style={styles.chipGrid}>
        {TRAVEL_BUDGET_INCLUDE_OPTIONS.map((option, index) => (
          <SelectChip
            key={option}
            label={option}
            selected={value.includes(option)}
            onPress={() => onChange(toggleTravelBudgetInclude(value, option))}
            colorIndex={index}
          />
        ))}
      </View>

      {showFlightHotelHint ? (
        <Text style={styles.hint}>
          航空券・ホテル込みの場合、現地で使える金額は少なめに調整します
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.one + 2,
  },
  title: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
    marginTop: Spacing.one,
  },
  hint: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
  },
});
