import { router, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenBackground } from '@/components/ui/screen-background';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { submitLocalHiddenSpot } from '@/lib/local-hidden-spots';
import {
  LOCAL_GEM_VISIBILITY_LABELS,
  LOCAL_HIDDEN_SPOT_CATEGORIES,
  LOCAL_HIDDEN_SPOT_TAGS,
  type LocalHiddenSpotCategory,
  type LocalHiddenSpotVisibility,
} from '@/types/local-hidden-spot';

const VISIBILITY_OPTIONS: LocalHiddenSpotVisibility[] = ['private', 'unlisted', 'public'];

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={NS.colors.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

export default function LocalSpotSubmitScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [category, setCategory] = useState<LocalHiddenSpotCategory>('カフェ');
  const [description, setDescription] = useState('');
  const [estimatedBudget, setEstimatedBudget] = useState('');
  const [crowdTip, setCrowdTip] = useState('');
  const [recommendedFor, setRecommendedFor] = useState('');
  const [caution, setCaution] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<LocalHiddenSpotVisibility>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('権限が必要です', '写真を選ぶにはライブラリへのアクセスを許可してください');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setLocalImageUri(result.assets[0].uri);
      setImageUrl('');
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const gemPayload = {
        name,
        area,
        category,
        description,
        estimatedBudget,
        crowdTip,
        recommendedFor,
        caution,
        googleMapsUrl,
        instagramUrl,
        tiktokUrl,
        imageUrl: imageUrl || localImageUri || '',
        tags,
        visibility,
      };
      console.log('[LocalGems] create gem', gemPayload);

      const spot = await submitLocalHiddenSpot({
        ...gemPayload,
        bestTime: '',
      });

      Alert.alert('投稿しました', 'ローカルの穴場として保存されました。', [
        { text: 'OK', onPress: () => router.replace(`/local-spot/${spot.id}`) },
      ]);
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : '投稿に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.five },
          ]}
          keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← 戻る</Text>
          </Pressable>
          <Text style={styles.title}>穴場を投稿</Text>
          <Text style={styles.subtitle}>
            公開施設・店舗名で投稿してください。個人住所は不可です。
          </Text>

          <PremiumCard style={styles.card}>
            <Field label="スポット名 *" value={name} onChangeText={setName} placeholder="例）静かな路地裏カフェ" />
            <Field label="エリア *" value={area} onChangeText={setArea} placeholder="例）中崎町、心斎橋" />

            <Text style={styles.fieldLabel}>カテゴリ *</Text>
            <View style={styles.chipGrid}>
              {LOCAL_HIDDEN_SPOT_CATEGORIES.map((item) => (
                <Pressable
                  key={item}
                  style={[styles.chip, category === item && styles.chipSelected]}
                  onPress={() => setCategory(item)}>
                  <Text style={[styles.chipText, category === item && styles.chipTextSelected]}>
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Field
              label="おすすめポイント *"
              value={description}
              onChangeText={setDescription}
              placeholder="なぜここが好き？どんな雰囲気？"
              multiline
            />

            <Text style={styles.fieldLabel}>写真</Text>
            <View style={styles.photoRow}>
              {localImageUri ? (
                <Image source={{ uri: localImageUri }} style={styles.photoPreview} />
              ) : null}
              <Pressable style={styles.photoBtn} onPress={() => void pickPhoto()}>
                <Text style={styles.photoBtnText}>写真を選ぶ</Text>
              </Pressable>
            </View>
            <Field label="写真URL（任意）" value={imageUrl} onChangeText={setImageUrl} placeholder="https://..." />

            <Field label="予算感" value={estimatedBudget} onChangeText={setEstimatedBudget} placeholder="例）1,000円前後" />
            <Field label="混み具合" value={crowdTip} onChangeText={setCrowdTip} placeholder="例）開店直後が空いてる" />
            <Field label="誰におすすめ？" value={recommendedFor} onChangeText={setRecommendedFor} placeholder="例）デート、一人時間" />
            <Field label="注意点" value={caution} onChangeText={setCaution} placeholder="例）現金のみ、定休日火曜" multiline />
            <Field label="Google Maps URL（任意）" value={googleMapsUrl} onChangeText={setGoogleMapsUrl} placeholder="https://maps.google.com/..." />
            <Field label="Instagram URL（任意）" value={instagramUrl} onChangeText={setInstagramUrl} placeholder="https://instagram.com/..." />
            <Field label="TikTok URL（任意）" value={tiktokUrl} onChangeText={setTiktokUrl} placeholder="https://tiktok.com/..." />

            <Text style={styles.fieldLabel}>タグ</Text>
            <View style={styles.chipGrid}>
              {LOCAL_HIDDEN_SPOT_TAGS.map((tag) => (
                <Pressable
                  key={tag}
                  style={[styles.chip, tags.includes(tag) && styles.chipSelected]}
                  onPress={() => toggleTag(tag)}>
                  <Text style={[styles.chipText, tags.includes(tag) && styles.chipTextSelected]}>
                    {tag}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>公開設定</Text>
            <View style={styles.chipGrid}>
              {VISIBILITY_OPTIONS.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.chip, visibility === option && styles.chipSelected]}
                  onPress={() => setVisibility(option)}>
                  <Text style={[styles.chipText, visibility === option && styles.chipTextSelected]}>
                    {LOCAL_GEM_VISIBILITY_LABELS[option]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <PrimaryButton
              label={isSubmitting ? '投稿中...' : '穴場を投稿する'}
              onPress={handleSubmit}
              disabled={isSubmitting || !name.trim() || !area.trim() || !description.trim()}
              variant="mint"
            />
          </PremiumCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  back: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.title,
    marginBottom: Spacing.one,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: Spacing.four,
  },
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  fieldLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    color: NS.colors.text,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 88,
    paddingTop: Spacing.three,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  chip: {
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    backgroundColor: NS.colors.bgElevated,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
  },
  chipSelected: {
    backgroundColor: NS.colors.mintSoft,
    borderColor: '#059669',
  },
  chipText: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#047857',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  photoPreview: {
    width: 72,
    height: 72,
    borderRadius: NS.radius.md,
  },
  photoBtn: {
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: NS.colors.bgInput,
  },
  photoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: NS.colors.textSecondary,
  },
});
