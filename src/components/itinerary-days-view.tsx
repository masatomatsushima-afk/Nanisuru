import { StyleSheet, Text, View } from 'react-native';

import { ItineraryTimelineCard } from '@/components/itinerary-timeline-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { ItineraryDay } from '@/types/plan';

type ItineraryDaysViewProps = {
  days: ItineraryDay[];
  variant?: 'timeline' | 'detail';
};

export function ItineraryDaysView({ days, variant = 'timeline' }: ItineraryDaysViewProps) {
  let globalIndex = 0;

  return (
    <View style={styles.container}>
      {days.map((day, dayIndex) => {
        const isLastDay = dayIndex === days.length - 1;

        return (
          <View key={`${day.dayNumber}-${day.label}`} style={styles.dayBlock}>
            {days.length > 1 ? (
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                {day.theme ? <Text style={styles.dayTheme}>{day.theme}</Text> : null}
              </View>
            ) : null}

            {day.items.map((item, itemIndex) => {
              const index = globalIndex;
              globalIndex += 1;
              const isLastItem = isLastDay && itemIndex === day.items.length - 1;

              return (
                <ItineraryTimelineCard
                  key={`${day.dayNumber}-${item.time}-${item.activity}`}
                  item={item}
                  index={index}
                  isLast={isLastItem}
                  variant={variant}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  dayBlock: {
    gap: Spacing.one,
  },
  dayHeader: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    marginBottom: Spacing.two,
  },
  dayLabel: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  dayTheme: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
});
