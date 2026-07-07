import { Redirect } from 'expo-router';

import { LOOP_TEST_RESTORE, loopTestLogOnce } from '@/lib/loop-test-config';

export default function IndexScreen() {
  if (LOOP_TEST_RESTORE.rootIndexGate) {
    loopTestLogOnce('restore:rootIndexGate', 'restoring root index gate');
    const FullIndexScreen = require('@/archive/loop-test/index.full').default;
    return <FullIndexScreen />;
  }

  loopTestLogOnce('index', 'root index -> (tabs) direct redirect');
  return <Redirect href="/(tabs)" />;
}
