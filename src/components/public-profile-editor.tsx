import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SuccessOverlay } from '@/components/success-overlay';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { ensureUserProfile, saveUserProfile } from '@/lib/user-profiles';
import { PROFILE_STYLE_TAGS, getProfileInitial } from '@/types/user-profile';

type PublicProfileEditorProps = {
  isLoggedIn: boolean;
  isConfigured: boolean;
  onRequireLogin: () => void;
};

function StyleTagChip({
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

export function PublicProfileEditor({
  isLoggedIn,
  isConfigured,
  onRequireLogin,
}: PublicProfileEditorProps) {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [isLocalContributor, setIsLocalContributor] = useState(false);
  const [localExpertAreas, setLocalExpertAreas] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!isLoggedIn || !isConfigured) {
      setDisplayName('');
      setBio('');
      setStyleTags([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const profile = await ensureUserProfile();
      setDisplayName(profile.displayName);
      setBio(profile.bio);
      setStyleTags(profile.styleTags);
      setIsLocalContributor(profile.isLocalContributor);
      setLocalExpertAreas(profile.localExpertAreas.join('、'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'プロフィールの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, isLoggedIn]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const toggleTag = (tag: string) => {
    setStyleTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag].slice(0, 7),
    );
  };

  const handleSave = async () => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await saveUserProfile({
        displayName,
        bio,
        styleTags,
        isLocalContributor,
        localExpertAreas: localExpertAreas
          .split(/[,、/／]+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 5),
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1600);
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isConfigured) {
    return (
      <PremiumCard style={styles.card}>
        <Text style={styles.eyebrow}>PUBLIC PROFILE</Text>
        <Text style={styles.title}>公開プロフィール</Text>
        <Text style={styles.subtitle}>Supabase を設定すると、公開プロフィールを編集できます。</Text>
      </PremiumCard>
    );
  }

  if (!isLoggedIn) {
    return (
      <PremiumCard style={styles.card}>
        <Text style={styles.eyebrow}>PUBLIC PROFILE</Text>
        <Text style={styles.title}>公開プロフィール</Text>
        <Text style={styles.subtitle}>
          表示名や自己紹介を設定。公開プランのクリエイター情報として表示されます。
        </Text>
        <PrimaryButton label="ログインして編集" onPress={onRequireLogin} />
      </PremiumCard>
    );
  }

  return (
    <>
      <SuccessOverlay visible={showSuccess} message="公開プロフィールを更新しました" />
      <PremiumCard style={styles.card}>
        <Text style={styles.eyebrow}>PUBLIC PROFILE</Text>
        <Text style={styles.title}>公開プロフィール</Text>
        <Text style={styles.subtitle}>
          発見タブや公開プランに表示される情報です。メールアドレス等の個人情報は公開されません。
        </Text>

        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getProfileInitial(displayName || '?')}</Text>
          </View>
          <Text style={styles.avatarHint}>プロフィール画像（準備中）</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={NS.colors.accent} />
          </View>
        ) : (
          <>
            <Text style={styles.label}>表示名</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="公開される表示名"
              placeholderTextColor={NS.colors.textMuted}
            />

            <Text style={styles.label}>自己紹介</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="好きな旅行スタイルや、プランづくりのこだわりなど"
              placeholderTextColor={NS.colors.textMuted}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.label}>好きな旅行スタイル</Text>
            <View style={styles.chipGrid}>
              {PROFILE_STYLE_TAGS.map((tag) => (
                <StyleTagChip
                  key={tag}
                  label={tag}
                  selected={styleTags.includes(tag)}
                  onPress={() => toggleTag(tag)}
                />
              ))}
            </View>

            <Pressable
              style={[styles.localToggle, isLocalContributor && styles.localToggleActive]}
              onPress={() => setIsLocalContributor((prev) => !prev)}>
              <Text style={styles.localToggleTitle}>🌟 このエリアに詳しい（ローカル投稿者）</Text>
              <Text style={styles.localToggleHint}>
                穴場投稿に「ローカル投稿者」バッジが付きます
              </Text>
            </Pressable>

            {isLocalContributor ? (
              <>
                <Text style={styles.label}>詳しいエリア（カンマ区切り）</Text>
                <TextInput
                  style={styles.input}
                  value={localExpertAreas}
                  onChangeText={setLocalExpertAreas}
                  placeholder="例）大阪、心斎橋、中崎町"
                  placeholderTextColor={NS.colors.textMuted}
                />
              </>
            ) : null}
          </>
        )}

        <View style={styles.saveWrap}>
          <PrimaryButton
            label={isSaving ? '保存中...' : '公開プロフィールを保存'}
            onPress={() => void handleSave()}
            disabled={isSaving || isLoading}
          />
        </View>
      </PremiumCard>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
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
    marginBottom: Spacing.one,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    lineHeight: 22,
    marginBottom: Spacing.three,
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: Spacing.four,
    gap: Spacing.two,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 2,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: NS.colors.accent,
    fontSize: 28,
    fontWeight: '800',
  },
  avatarHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  loadingWrap: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  errorText: {
    color: NS.colors.danger,
    fontSize: 13,
    marginBottom: Spacing.two,
  },
  label: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  input: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    color: NS.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  textArea: {
    minHeight: 96,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
  localToggle: {
    marginTop: Spacing.two,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    padding: Spacing.three,
    gap: 4,
  },
  localToggleActive: {
    backgroundColor: NS.colors.yellowSoft,
    borderColor: NS.colors.yellow,
  },
  localToggleTitle: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  localToggleHint: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  saveWrap: {
    marginTop: Spacing.four,
  },
});
