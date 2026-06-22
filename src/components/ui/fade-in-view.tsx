import type { ReactNode } from 'react';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

type FadeInViewProps = {
  children: ReactNode;
  delay?: number;
  direction?: 'up' | 'down';
};

export function FadeInView({ children, delay = 0, direction = 'up' }: FadeInViewProps) {
  const entering =
    direction === 'down'
      ? FadeInDown.delay(delay).duration(500).springify().damping(18)
      : FadeInUp.delay(delay).duration(500).springify().damping(18);

  return <Animated.View entering={entering}>{children}</Animated.View>;
}
