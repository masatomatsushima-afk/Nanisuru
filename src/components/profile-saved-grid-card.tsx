import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { getPublicPlanDestination } from '@/types/public-plan';
import type { ProfileSavedItem } from '@/types/profile-portfolio';
import { getLocalHiddenSpotCategoryIcon } from '@/types/local-hidden-spot';

type ProfileSavedGridCardProps = {
  item: ProfileSavedItem;
  onPress: () => void;
};

export function ProfileSavedGridCard({ item, onPress }: ProfileSavedGridCardProps) {
  if (item.type === 'plan') {
    const coverUrl = item.plan.images?.[0]?.imageUrl;
    return (
      <Pressable style={styles.card} onPress={onPress}>
        <View style={styles.coverWrap}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.coverPlaceholder, styles.planBg]}>
              <Text style={styles.emoji}>🗺️</Text>
            </View>
          )}
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>プラン</Text>
          </View>
        </View>
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
        <View style={styles.coverWrap}>
          {item.memory.coverImageUrl ? (
            <Image source={{ uri: item.memory.coverImageUrl }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.coverPlaceholder, styles.memoryBg]}>
              <Text style={styles.emoji}>📸</Text>
            </View>
          )}
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>思い出</Text>
          </View>
        </View>
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
      <View style={styles.coverWrap}>
        <View style={[styles.coverPlaceholder, styles.spotBg]}>
          <Text style={styles.emoji}>{getLocalHiddenSpotCategoryIcon(item.spot.category)}</Text>
        </View>
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>穴場</Text>
        </View>
      </View>
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
    borderRadius: NS.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingBottom: Spacing.two,
    ...NS.shadow.card,
  },
  coverWrap: {
    height: 120,
    position: 'relative',
    marginBottom: Spacing.two,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBg: {
    backgroundColor: NS.colors.skySoft,
  },
  memoryBg: {
    backgroundColor: NS.colors.coralSoft,
  },
  spotBg: {
    backgroundColor: NS.colors.mintSoft,
  },
  emoji: {
    fontSize: 28,
  },
  typeBadge: {
    position: 'absolute',
    left: Spacing.two,
    top: Spacing.two,
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
  },
  meta: {
    fontSize: 11,
    color: NS.colors.textMuted,
    paddingHorizontal: Spacing.two,
    marginTop: 2,
  },
});
