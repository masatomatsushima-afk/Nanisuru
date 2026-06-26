import { StyleSheet, Text, View } from 'react-native';

import { ItineraryTimelineCard } from '@/components/itinerary-timeline-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { buildDayRouteNote } from '@/lib/transport-guidance';
import type { ItineraryDay } from '@/types/plan';
import type { ItineraryEditTarget } from '@/types/itinerary-edit';
import type { TransportGuidanceContext } from '@/types/transport-guidance';

type ItineraryDaysViewProps = {
  days: ItineraryDay[];
  variant?: 'timeline' | 'detail';
  location?: string;
  transportContext?: TransportGuidanceContext;
  editable?: boolean;
  onEditItem?: (target: ItineraryEditTarget) => void;
};

export function ItineraryDaysView({
  days,
  variant = 'timeline',
  location,
  transportContext,
  editable = false,
  onEditItem,
}: ItineraryDaysViewProps) {
  let globalIndex = 0;
  const context: TransportGuidanceContext = {
    ...transportContext,
    location: transportContext?.location ?? location,
  };

  return (
    <View style={styles.container}>
      {days.map((day, dayIndex) => {
        const isLastDay = dayIndex === days.length - 1;
        const routeNote = buildDayRouteNote(day, context, dayIndex, days.length);

        return (
          <View key={`${day.dayNumber}-${day.label}`} style={styles.dayBlock}>
            {days.length > 1 ? (
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                {day.theme ? <Text style={styles.dayTheme}>{day.theme}</Text> : null}
                {routeNote ? (
                  <View style={styles.routeNoteBox}>
                    <Text style={styles.routeNoteLabel}>{routeNote.label}</Text>
                    {routeNote.detail ? (
                      <Text style={styles.routeNoteDetail}>{routeNote.detail}</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            {day.items.map((item, itemIndex) => {
              const index = globalIndex;
              globalIndex += 1;
              const isLastItem = isLastDay && itemIndex === day.items.length - 1;
              const nextItem = day.items[itemIndex + 1];

              return (
                <ItineraryTimelineCard
                  key={`${day.dayNumber}-${item.time}-${item.activity}`}
                  item={item}
                  nextItem={nextItem}
                  index={index}
                  isLast={isLastItem}
                  variant={variant}
                  location={location}
                  transportContext={context}
                  dayIndex={dayIndex}
                  totalDays={days.length}
                  itemIndex={itemIndex}
                  editable={editable}
                  onEditPress={
                    editable && onEditItem
                      ? () =>
                          onEditItem({
                            dayIndex,
                            itemIndex,
                            dayNumber: day.dayNumber,
                            item,
                          })
                      : undefined
                  }
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
  routeNoteBox: {
    marginTop: Spacing.two,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.sm,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
    gap: 2,
  },
  routeNoteLabel: {
    color: NS.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  routeNoteDetail: {
    color: NS.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
});
