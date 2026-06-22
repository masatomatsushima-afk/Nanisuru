import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { NS } from '@/constants/nanisuru-ui';
import type { ItineraryItem } from '@/types/plan';

const theme = Colors.dark;
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
  index: number;
  isLast: boolean;
  variant?: 'timeline' | 'detail';
};

export function ItineraryTimelineCard({
  item,
  index,
  isLast,
  variant = 'timeline',
}: ItineraryTimelineCardProps) {
  const showTimeline = variant === 'timeline';
  const showTransport =
    item.transportation && item.transportation !== '—' && item.transportation !== '-';

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

          {showTransport ? (
            <View style={styles.transportBox}>
              <Text style={styles.transportLabel}>🚶 次の場所へ</Text>
              <Text style={styles.transportText}>{item.transportation}</Text>
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
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.35)',
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
    width: 2,
    backgroundColor: 'rgba(129, 140, 248, 0.25)',
    marginVertical: 6,
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
    height: 1,
    backgroundColor: 'rgba(129, 140, 248, 0.45)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepBadgeText: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  activityName: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  reasonBox: {
    backgroundColor: 'rgba(129, 140, 248, 0.08)',
    borderRadius: 12,
    padding: Spacing.two + 2,
    borderLeftWidth: 3,
    borderLeftColor: accent,
  },
  reasonLabel: {
    color: accent,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  reasonText: {
    color: theme.textSecondary,
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
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  transportBox: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.xs,
    padding: Spacing.two + 2,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  transportLabel: {
    color: theme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  transportText: {
    color: theme.text,
    fontSize: 13,
    lineHeight: 20,
  },
});
