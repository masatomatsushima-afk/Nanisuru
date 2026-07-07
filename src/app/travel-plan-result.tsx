import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NS } from '@/constants/nanisuru-ui';
import { getStackScreenPaddingBottom } from '@/constants/mobile-layout';
import { Spacing } from '@/constants/theme';
import { formatTravelPlanResultSummary } from '@/lib/travel-plan-result-nav';
import { safeText } from '@/lib/safe-text';

function readParam(params: Record<string, string | string[] | undefined>, key: string): string {
  const value = params[key];
  return safeText(Array.isArray(value) ? value[0] : value);
}

export default function TravelPlanResultScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const paramRecord = params as Record<string, string | string[] | undefined>;
  const summary = formatTravelPlanResultSummary(paramRecord);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.three,
          paddingBottom: getStackScreenPaddingBottom(insets.bottom),
        },
      ]}>
      <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
        <Text style={styles.backText}>← 戻る</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.title}>プラン生成結果 OK</Text>
        <Text style={styles.subtitle}>旅行プランの生成が完了しました</Text>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>行き先</Text>
          <Text style={styles.fieldValue}>{readParam(paramRecord, 'destination')}</Text>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>旅行の目的</Text>
          <Text style={styles.fieldValue}>{readParam(paramRecord, 'travelPurpose')}</Text>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>日程</Text>
          <Text style={styles.fieldValue}>
            {readParam(paramRecord, 'departureDate')} → {readParam(paramRecord, 'returnDate')}
          </Text>
          <Text style={styles.fieldHint}>
            {readParam(paramRecord, 'durationLabel')}（{readParam(paramRecord, 'nights')}泊 /{' '}
            {readParam(paramRecord, 'days')}日）
          </Text>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>予算</Text>
          <Text style={styles.fieldValue}>
            {readParam(paramRecord, 'budget')} {readParam(paramRecord, 'currency')}
          </Text>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>同行者</Text>
          <Text style={styles.fieldValue}>{readParam(paramRecord, 'companion')}</Text>
        </View>

        {readParam(paramRecord, 'customRequest') ? (
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>その他の希望</Text>
            <Text style={styles.fieldValue}>{readParam(paramRecord, 'customRequest')}</Text>
          </View>
        ) : null}

        <Text style={styles.summary}>{summary}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NS.colors.bg,
  },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  backBtn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  backText: {
    color: NS.colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.xl,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.four,
    gap: Spacing.three,
    ...NS.shadow.card,
  },
  title: {
    color: NS.colors.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.one,
  },
  fieldBlock: {
    gap: Spacing.one,
  },
  fieldLabel: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  fieldValue: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  fieldHint: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  summary: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.two,
  },
});
