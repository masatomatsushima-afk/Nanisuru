import type { ReactNode } from 'react';
import { useMemo } from 'react';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

type FadeInViewProps = {
  children: ReactNode;
  delay?: number;
  direction?: 'up' | 'down';
};

const ENTERING_BY_KEY = {
  'down:0': FadeInDown.duration(500).springify().damping(18),
  'up:0': FadeInUp.duration(500).springify().damping(18),
} as const;

function getEnteringKey(direction: 'up' | 'down', delay: number) {
  return `${direction}:${delay}`;
}

function buildEntering(direction: 'up' | 'down', delay: number) {
  const cached = ENTERING_BY_KEY[getEnteringKey(direction, delay) as keyof typeof ENTERING_BY_KEY];
  if (cached) return cached;

  return direction === 'down'
    ? FadeInDown.delay(delay).duration(500).springify().damping(18)
    : FadeInUp.delay(delay).duration(500).springify().damping(18);
}

export function FadeInView({ children, delay = 0, direction = 'up' }: FadeInViewProps) {
  const entering = useMemo(() => buildEntering(direction, delay), [delay, direction]);

  return <Animated.View entering={entering}>{children}</Animated.View>;
}
