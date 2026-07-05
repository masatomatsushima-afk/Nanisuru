import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VisualCover } from '@/components/ui/visual-cover';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  isLocalGemSavedLocally,
  toggleLocalGemSavedLocally,
} from '@/lib/local-gems-local-saves';
import { toggleLocalHiddenSpotSave } from '@/lib/local-hidden-spots';
import type { LocalHiddenSpot } from '@/types/local-hidden-spot';
import { getProfileInitial } from '@/types/user-profile';

type LocalGemCardProps = {
  spot: LocalHiddenSpot;
  isLoggedIn: boolean;
  layout?: 'grid' | 'carousel';
  onPress: () => void;
  onRequireLogin: () => void;
  onSpotUpdate?: (spot: LocalHiddenSpot) => void;
};

export function LocalGemCard({
  spot,
  isLoggedIn,
  layout = 'grid',
  onPress,
  onRequireLogin,
  onSpotUpdate,
}: LocalGemCardProps) {
  const [savedLocally, setSavedLocally] = useState(() =>
    spot.savedByMe || isLocalGemSavedLocally(spot.id),
  );
  const [saveCount, setSaveCount] = useState(spot.saveCount);
  const tags = spot.tags.slice(0, 2);

  const handleSave = async () => {
    if (spot.id.startsWith('sample:')) {
      const next = toggleLocalGemSavedLocally(spot.id);
      setSavedLocally(next);
      setSaveCount(spot.saveCount + (next ? 1 : 0));
      return;
    }

    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    try {
      const updated = await toggleLocalHiddenSpotSave(spot.id);
      setSavedLocally(Boolean(updated.savedByMe));
      setSaveCount(updated.saveCount);
      onSpotUpdate?.(updated);
    } catch {
      const next = toggleLocalGemSavedLocally(spot.id);
      setSavedLocally(next);
      setSaveCount(spot.saveCount + (next ? 1 : 0));
    }
  };

  return (
    <View style={[styles.card, layout === 'carousel' && styles.cardCarousel]}>
      <Pressable style={({ pressed }) => [pressed && styles.pressed]} onPress={onPress}>
        <VisualCover
          height={120}
          imageUrl={spot.imageUrl}
          category={spot.category}
          seed={spot.id}
          theme="local"
          overlay="bottom"
          showEmoji={!spot.imageUrl}
          borderRadius={NS.lifestyle.tileRadius}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{spot.category}</Text>
          </View>
        </VisualCover>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {spot.name}
          </Text>
          <Text style={styles.area} numberOfLines={1}>
            📍 {spot.area}
          </Text>
          {tags.length ? (
            <View style={styles.tagRow}>
              {tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={styles.description} numberOfLines={2}>
            {spot.description}
          </Text>
          <View style={styles.footer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getProfileInitial(spot.creatorDisplayName)}</Text>
            </View>
            <Text style={styles.creator} numberOfLines={1}>
              {spot.creatorDisplayName}
            </Text>
            <Text style={styles.stat}>📌 {saveCount}</Text>
          </View>
        </View>
      </Pressable>

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionBtn, savedLocally && styles.actionBtnSaved]}
          onPress={() => void handleSave()}>
          <Text style={[styles.actionText, savedLocally && styles.actionTextSaved]}>
            {savedLocally ? '保存済み' : '保存'}
          </Text>
        </Pressable>
        <Pressable style={styles.actionBtnPrimary} onPress={onPress}>
          <Text style={styles.actionTextPrimary}>詳しく見る</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    minWidth: '47%',
    maxWidth: '48%',
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.lifestyle.tileRadius,
    overflow: 'hidden',
    ...NS.shadow.cardLg,
    shadowOpacity: 0.1,
  },
  cardCarousel: {
    width: '100%',
    minWidth: '100%',
    maxWidth: '100%',
  },
  pressed: { opacity: 0.94 },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: NS.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
  },
  body: {
    padding: Spacing.two,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    color: NS.colors.text,
    lineHeight: 17,
  },
  area: {
    fontSize: 10,
    fontWeight: '600',
    color: NS.colors.textSecondary,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    backgroundColor: NS.colors.mintSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#047857',
  },
  description: {
    fontSize: 10,
    color: NS.colors.textMuted,
    lineHeight: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: NS.colors.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#047857',
  },
  creator: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
  stat: {
    fontSize: 10,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
  },
  actionBtn: {
    flex: 1,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingVertical: Spacing.one + 2,
    alignItems: 'center',
    backgroundColor: NS.colors.bgInput,
  },
  actionBtnSaved: {
    borderColor: '#059669',
    backgroundColor: NS.colors.mintSoft,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '800',
    color: NS.colors.textSecondary,
  },
  actionTextSaved: {
    color: '#047857',
  },
  actionBtnPrimary: {
    flex: 1,
    borderRadius: NS.radius.md,
    paddingVertical: Spacing.one + 2,
    alignItems: 'center',
    backgroundColor: '#059669',
  },
  actionTextPrimary: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
