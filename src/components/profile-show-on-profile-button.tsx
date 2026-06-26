import { Pressable, StyleSheet, Text } from 'react-native';

import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type ProfileShowOnProfileButtonProps = {
  visible: boolean;
  showOnProfile: boolean;
  busy?: boolean;
  onToggle: () => void;
};

export function ProfileShowOnProfileButton({
  visible,
  showOnProfile,
  busy,
  onToggle,
}: ProfileShowOnProfileButtonProps) {
  if (!visible) return null;

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, busy && styles.buttonDisabled]}
      onPress={onToggle}
      disabled={busy}>
      <Text style={styles.label}>
        {showOnProfile ? 'プロフィールに表示中' : 'プロフィールに表示する'}
      </Text>
      {showOnProfile ? (
        <Text style={styles.hint}>タップでプロフィールから非表示</Text>
      ) : (
        <Text style={styles.hint}>公開プロフィールの「思い出」タブに表示されます</Text>
      )}
    </Pressable>
  );
}

export function ProfileShowOnProfilePlanButton({
  visible,
  showOnProfile,
  busy,
  onToggle,
}: ProfileShowOnProfileButtonProps) {
  if (!visible) return null;

  if (showOnProfile) {
    return (
      <Pressable
        style={({ pressed }) => [styles.outlineButton, pressed && styles.buttonPressed, busy && styles.buttonDisabled]}
        onPress={onToggle}
        disabled={busy}>
        <Text style={styles.outlineLabel}>プロフィールから非表示</Text>
      </Pressable>
    );
  }

  return (
    <PrimaryButton
      label={busy ? '更新中...' : 'プロフィールに表示する'}
      onPress={onToggle}
      disabled={busy}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: NS.colors.purpleSoft,
    borderRadius: NS.radius.lg,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.purple,
    gap: 4,
  },
  outlineButton: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderColor: NS.colors.border,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    color: NS.colors.text,
    textAlign: 'center',
  },
  outlineLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: NS.colors.textSecondary,
  },
  hint: {
    fontSize: 12,
    color: NS.colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
});
