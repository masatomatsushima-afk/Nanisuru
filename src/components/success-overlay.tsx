import { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { NS } from '@/constants/nanisuru-ui';

const theme = Colors.dark;
const accent = NS.colors.accent;

type SuccessOverlayProps = {
  visible: boolean;
  message: string;
};

export function SuccessOverlay({ visible, message }: SuccessOverlayProps) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      scale.setValue(0.3);
      opacity.setValue(0);
      ringScale.setValue(0.6);
      textOpacity.setValue(0);
      return;
    }

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.spring(ringScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [visible, opacity, ringScale, scale, textOpacity]);

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }] }]} />
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Animated.Text style={[styles.message, { opacity: textOpacity }]}>{message}</Animated.Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: NS.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  ring: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(129, 140, 248, 0.25)',
  },
  card: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.xxl,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.five,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    ...NS.shadow.accent,
    maxWidth: 320,
    width: '100%',
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderWidth: 2,
    borderColor: accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  checkIcon: {
    color: accent,
    fontSize: 36,
    fontWeight: '700',
  },
  message: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 30,
  },
});
