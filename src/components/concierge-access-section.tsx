import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  getMapsUrl,
  getReservationUrl,
  getWebsiteUrl,
  usesDirectReservationLink,
} from '@/lib/concierge-links';
import { buildDayRouteNote } from '@/lib/transport-guidance';
import { ItineraryTransportSection } from '@/components/itinerary-transport-section';
import type { ItineraryDay } from '@/types/plan';
import type { TransportGuidanceContext } from '@/types/transport-guidance';

type AccessLinkProps = {
  icon: string;
  label: string;
  hint?: string;
  onPress: () => void;
};

function AccessLink({ icon, label, hint, onPress }: AccessLinkProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.linkButton, pressed && styles.linkButtonPressed]}
      onPress={onPress}>
      <Text style={styles.linkIcon}>{icon}</Text>
      <View style={styles.linkTextWrap}>
        <Text style={styles.linkLabel}>{label}</Text>
        {hint ? <Text style={styles.linkHint}>{hint}</Text> : null}
      </View>
      <Text style={styles.linkArrow}>→</Text>
    </Pressable>
  );
}

type ConciergeSpotCardProps = {
  time: string;
  activity: string;
  location: string;
  item: ItineraryDay['items'][number];
  nextItem?: ItineraryDay['items'][number];
  isLastInDay: boolean;
  transportContext?: TransportGuidanceContext;
  dayIndex?: number;
  totalDays?: number;
  itemIndex?: number;
};

function ConciergeSpotCard({
  time,
  activity,
  location,
  item,
  nextItem,
  isLastInDay,
  transportContext,
  dayIndex = 0,
  totalDays = 1,
  itemIndex = 0,
}: ConciergeSpotCardProps) {
  const openUrl = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  };

  const websiteUrl = getWebsiteUrl(item, location);
  const reservationHint = usesDirectReservationLink(item) ? '公式予約ページ' : '予約情報を検索';

  return (
    <View style={styles.spotCard}>
      <View style={styles.spotHeader}>
        <Text style={styles.spotTime}>{time}</Text>
        <Text style={styles.spotName}>{activity}</Text>
      </View>

      <View style={styles.linkList}>
        <AccessLink
          icon="📅"
          label="予約"
          hint={reservationHint}
          onPress={() => openUrl(getReservationUrl(item, location))}
        />
        {websiteUrl ? (
          <AccessLink
            icon="🌐"
            label="公式サイト"
            hint="公式ページを開く"
            onPress={() => openUrl(websiteUrl)}
          />
        ) : null}
        <AccessLink
          icon="📍"
          label="Google Maps"
          hint="地図で場所を確認"
          onPress={() => openUrl(getMapsUrl(item, location))}
        />
      </View>

      {!isLastInDay && nextItem ? (
        <ItineraryTransportSection
          fromItem={item}
          toItem={nextItem}
          context={{ ...transportContext, location }}
          dayIndex={dayIndex}
          totalDays={totalDays}
          itemIndex={itemIndex}
        />
      ) : null}
    </View>
  );
}

type ConciergeAccessSectionProps = {
  days: ItineraryDay[];
  location: string;
  compact?: boolean;
  transportContext?: TransportGuidanceContext;
};

export function ConciergeAccessSection({
  days,
  location,
  compact = false,
  transportContext,
}: ConciergeAccessSectionProps) {
  const context: TransportGuidanceContext = {
    ...transportContext,
    location: transportContext?.location ?? location,
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CONCIERGE</Text>
        <Text style={styles.title}>予約・アクセス</Text>
        {!compact ? (
          <Text style={styles.subtitle}>
            各スポットの予約・公式サイト・地図リンクと、次の場所への移動案内です
          </Text>
        ) : null}
      </View>

      {days.map((day, dayIndex) => {
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

          {day.items.map((item, index) => (
            <ConciergeSpotCard
              key={`${day.dayNumber}-${item.time}-${item.activity}`}
              time={item.time}
              activity={item.activity}
              location={location}
              item={item}
              nextItem={day.items[index + 1]}
              isLastInDay={index === day.items.length - 1}
              transportContext={context}
              dayIndex={dayIndex}
              totalDays={days.length}
              itemIndex={index}
            />
          ))}
        </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.four,
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.lg,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  containerCompact: {
    marginTop: Spacing.three,
    padding: Spacing.three,
  },
  header: {
    marginBottom: Spacing.four,
  },
  eyebrow: {
    color: NS.colors.accent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.one,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.headline,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    marginTop: Spacing.two,
    lineHeight: 22,
  },
  dayBlock: {
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  dayHeader: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  dayLabel: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  dayTheme: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  routeNoteBox: {
    marginTop: Spacing.two,
    backgroundColor: NS.colors.bgCard,
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
  spotCard: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.border,
    gap: Spacing.three,
  },
  spotHeader: {
    gap: 4,
  },
  spotTime: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  spotName: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  linkList: {
    gap: Spacing.two,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.sm + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
  },
  linkButtonPressed: {
    opacity: 0.85,
  },
  linkIcon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center',
  },
  linkTextWrap: {
    flex: 1,
    gap: 2,
  },
  linkLabel: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  linkHint: {
    color: NS.colors.textMuted,
    fontSize: 11,
  },
  linkArrow: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
