import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VisualCover } from '@/components/ui/visual-cover';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { getPublicPlanDestination } from '@/types/public-plan';
import type { ProfileSavedItem } from '@/types/profile-portfolio';

type ProfileSavedGridCardProps = {
  item: ProfileSavedItem;
  onPress: () => void;
};

export function ProfileSavedGridCard({ item, onPress }: ProfileSavedGridCardProps) {
  if (item.type === 'plan') {
    const coverUrl = item.plan.images?.[0]?.imageUrl;
    return (
      <Pressable style={styles.card} onPress={onPress}>
        <VisualCover
          height={112}
          imageUrl={coverUrl}
          category={item.plan.category}
          seed={item.plan.id}
          overlay="bottom"
          showEmoji={!coverUrl}
          borderRadius={NS.lifestyle.tileRadius}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>プラン</Text>
          </View>
        </VisualCover>
        <Text style={styles.title} numberOfLines={2}>
          {item.plan.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          📍 {getPublicPlanDestination(item.plan)}
        </Text>
      </Pressable>
    );
  }

  if (item.type === 'memory') {
    return (
      <Pressable style={styles.card} onPress={onPress}>
        <VisualCover
          height={112}
          imageUrl={item.memory.coverImageUrl}
          theme="memory"
          seed={item.memory.id}
          overlay="bottom"
          showEmoji={!item.memory.coverImageUrl}
          borderRadius={NS.lifestyle.tileRadius}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>思い出</Text>
          </View>
        </VisualCover>
        <Text style={styles.title} numberOfLines={2}>
          {item.memory.title || item.memory.destination}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          📍 {item.memory.destination}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <VisualCover
        height={112}
        imageUrl={item.spot.imageUrl}
        category={item.spot.category}
        seed={item.spot.id}
        theme="local"
        overlay="bottom"
        showEmoji={!item.spot.imageUrl}
        borderRadius={NS.lifestyle.tileRadius}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>穴場</Text>
        </View>
      </VisualCover>
      <Text style={styles.title} numberOfLines={2}>
        {item.spot.name}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        📍 {item.spot.area}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '47%',
    maxWidth: '48%',
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.lifestyle.tileRadius,
    overflow: 'hidden',
    paddingBottom: Spacing.two,
    ...NS.shadow.cardLg,
    shadowOpacity: 0.1,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '800',
    color: NS.colors.accent,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: NS.colors.text,
    lineHeight: 17,
    paddingHorizontal: Spacing.two,
    marginTop: Spacing.two,
  },
  meta: {
    fontSize: 11,
    color: NS.colors.textMuted,
    paddingHorizontal: Spacing.two,
    marginTop: 2,
  },
});
