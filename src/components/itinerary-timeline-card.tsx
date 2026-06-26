import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ItineraryMapActions } from '@/components/itinerary-map-actions';
import { ItineraryTransportSection } from '@/components/itinerary-transport-section';
import { PlaceAtmosphereLinks } from '@/components/place-atmosphere-links';
import { Spacing } from '@/constants/theme';
import { getCategoryStyle, NS } from '@/constants/nanisuru-ui';
import type { ItineraryItem } from '@/types/plan';
import type { TransportGuidanceContext } from '@/types/transport-guidance';

const accent = NS.colors.accent;

const CLOCK_EMOJIS: Record<number, string> = {
  1: '🕐',
  2: '🕑',
  3: '🕒',
  4: '🕓',
  5: '🕔',
  6: '🕕',
  7: '🕖',
  8: '🕗',
  9: '🕘',
  10: '🕙',
  11: '🕚',
  12: '🕛',
};

function getClockEmoji(time: string): string {
  const hour = parseInt(time.split(':')[0], 10);
  const hour12 = hour % 12 || 12;
  return CLOCK_EMOJIS[hour12] ?? '🕐';
}

type ItineraryTimelineCardProps = {
  item: ItineraryItem;
  nextItem?: ItineraryItem;
  index: number;
  isLast: boolean;
  variant?: 'timeline' | 'detail';
  location?: string;
  transportContext?: TransportGuidanceContext;
  dayIndex?: number;
  totalDays?: number;
  itemIndex?: number;
  editable?: boolean;
  onEditPress?: () => void;
};

export function ItineraryTimelineCard({
  item,
  nextItem,
  index,
  isLast,
  variant = 'timeline',
  location,
  transportContext,
  dayIndex = 0,
  totalDays = 1,
  itemIndex = 0,
  editable = false,
  onEditPress,
}: ItineraryTimelineCardProps) {
  const showTimeline = variant === 'timeline';
  const categoryStyle = getCategoryStyle(item.activityCategory);
  const showTransport = Boolean(
    nextItem &&
      nextItem.activityCategory !== '移動' &&
      item.activityCategory !== '移動',
  );

  return (
    <View style={showTimeline ? styles.timelineStep : styles.detailStep}>
      {showTimeline && (
        <View style={styles.timelineTrack}>
          <View style={styles.timelineDotRing}>
            <View style={styles.timelineDot} />
          </View>
          {!isLast && <View style={styles.timelineConnector} />}
        </View>
      )}

      <View style={[styles.card, isLast && styles.cardLast, variant === 'detail' && styles.cardDetail]}>
        <View style={styles.cardGlow} />

        <View style={styles.cardInner}>
          <View style={styles.timeRow}>
            <Text style={styles.clockEmoji}>{getClockEmoji(item.time)}</Text>
            <Text style={styles.timeText}>{item.time}</Text>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{index + 1}</Text>
            </View>
          </View>

          <Text style={styles.activityName}>{item.activity}</Text>

          {item.activityCategory ? (
            <View
              style={[
                styles.categoryBadge,
                {
                  backgroundColor: categoryStyle.bg,
                  borderColor: categoryStyle.border,
                },
              ]}>
              <Text style={[styles.categoryBadgeText, { color: categoryStyle.text }]}>
                {item.activityCategory}
              </Text>
            </View>
          ) : null}

          {item.reason ? (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>選んだ理由</Text>
              <Text style={styles.reasonText}>{item.reason}</Text>
            </View>
          ) : null}

          {item.estimatedCost ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaIcon}>💰</Text>
              <Text style={styles.metaText}>概算 {item.estimatedCost}</Text>
            </View>
          ) : null}

          <PlaceAtmosphereLinks item={item} location={location} />

          <ItineraryMapActions item={item} />

          {editable && onEditPress ? (
            <Pressable
              style={({ pressed }) => [styles.editButton, pressed && styles.editButtonPressed]}
              onPress={onEditPress}
              accessibilityRole="button"
              accessibilityLabel="ここを変更">
              <Text style={styles.editButtonText}>ここを変更</Text>
            </Pressable>
          ) : null}

          {showTransport && nextItem ? (
            <ItineraryTransportSection
              fromItem={item}
              toItem={nextItem}
              context={transportContext}
              dayIndex={dayIndex}
              totalDays={totalDays}
              itemIndex={itemIndex}
            />
          ) : null}

          {item.weatherBackup && item.weatherBackup !== '天候に関わらず可' ? (
            <View style={styles.weatherBackupBox}>
              <Text style={styles.weatherBackupLabel}>☔ 天候変化時</Text>
              <Text style={styles.weatherBackupText}>{item.weatherBackup}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timelineStep: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  detailStep: {
    marginBottom: Spacing.three,
  },
  timelineTrack: {
    width: 28,
    alignItems: 'center',
  },
  timelineDotRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 2,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: accent,
  },
  timelineConnector: {
    flex: 1,
    width: 3,
    backgroundColor: NS.colors.accentSoft,
    marginVertical: 6,
    borderRadius: 999,
  },
  card: {
    flex: 1,
    marginBottom: Spacing.three,
    borderRadius: NS.radius.lg,
    overflow: 'hidden',
    backgroundColor: NS.colors.bgCard,
    borderWidth: 1,
    borderColor: NS.colors.border,
    ...NS.shadow.card,
  },
  cardLast: {
    marginBottom: 0,
  },
  cardDetail: {
    flex: undefined,
    marginBottom: Spacing.three,
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: NS.colors.skySoft,
  },
  cardInner: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three + 2,
    gap: Spacing.two,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  clockEmoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  timeText: {
    color: accent,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    flex: 1,
  },
  stepBadge: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: 8,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  stepBadgeText: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  activityName: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  reasonBox: {
    backgroundColor: NS.colors.skySoft,
    borderRadius: 12,
    padding: Spacing.two + 2,
    borderLeftWidth: 3,
    borderLeftColor: NS.colors.sky,
  },
  reasonLabel: {
    color: accent,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  reasonText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  metaIcon: {
    fontSize: 14,
  },
  metaText: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  weatherBackupBox: {
    backgroundColor: NS.colors.yellowSoft,
    borderRadius: NS.radius.xs,
    padding: Spacing.two + 2,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  weatherBackupLabel: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  weatherBackupText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  editButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: NS.radius.sm,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  editButtonPressed: {
    opacity: 0.85,
  },
  editButtonText: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
