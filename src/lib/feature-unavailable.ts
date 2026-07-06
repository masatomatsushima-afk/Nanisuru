import { Alert } from 'react-native';

import { FEATURE_COMING_SOON } from '@/constants/mvp-qa';

export function showFeatureComingSoonAlert(): void {
  Alert.alert(FEATURE_COMING_SOON.title, FEATURE_COMING_SOON.message);
}
