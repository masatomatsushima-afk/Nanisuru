import { router, Stack } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
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
  LOCAL_HIDDEN_SPOT_CATEGORIES,
  LOCAL_HIDDEN_SPOT_TAGS,
  type LocalHiddenSpotCategory,
} from '@/types/local-hidden-spot';

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
  const [bestTime, setBestTime] = useState('');
  const [estimatedBudget, setEstimatedBudget] = useState('');
  const [crowdTip, setCrowdTip] = useState('');
  const [caution, setCaution] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const spot = await submitLocalHiddenSpot({
        name,
        area,
        category,
        description,
        bestTime,
        estimatedBudget,
        crowdTip,
        caution,
        googleMapsUrl,
        imageUrl,
        tags,
      });
      Alert.alert('投稿しました', 'ローカルの穴場として公開されました。', [
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
          <Text style={styles.title}>穴場スポットを投稿</Text>
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
              label="おすすめ理由 *"
              value={description}
              onChangeText={setDescription}
              placeholder="なぜここが好き？どんな雰囲気？"
              multiline
            />
            <Field label="ベストな時間帯" value={bestTime} onChangeText={setBestTime} placeholder="例）平日15時ごろ" />
            <Field label="予算目安" value={estimatedBudget} onChangeText={setEstimatedBudget} placeholder="例）1,000円前後" />
            <Field label="混雑しにくい時間" value={crowdTip} onChangeText={setCrowdTip} placeholder="例）開店直後が空いてる" />
            <Field label="注意点" value={caution} onChangeText={setCaution} placeholder="例）現金のみ、定休日火曜" multiline />
            <Field label="Google Maps リンク（任意）" value={googleMapsUrl} onChangeText={setGoogleMapsUrl} placeholder="https://maps.google.com/..." />
            <Field label="写真URL（任意）" value={imageUrl} onChangeText={setImageUrl} placeholder="https://..." />

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

            <PrimaryButton
              label={isSubmitting ? '投稿中...' : '穴場を投稿する'}
              onPress={handleSubmit}
              disabled={isSubmitting || !name.trim() || !area.trim() || !description.trim()}
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
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  chipText: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: NS.colors.accent,
  },
});
