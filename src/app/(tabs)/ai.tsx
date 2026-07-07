import { StyleSheet, Text, View } from 'react-native';

import { LOOP_TEST_RESTORE, loopTestLogOnce } from '@/lib/loop-test-config';

function Placeholder({ label }: { label: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

export default function AiScreen() {
  if (LOOP_TEST_RESTORE.screenAi) {
    loopTestLogOnce('restore:Ai', 'restoring Ai');
    const AiScreenReal = require('@/archive/loop-test/tabs/ai.real').default;
    return <AiScreenReal />;
  }

  loopTestLogOnce('screen:Ai', 'placeholder Ai');
  return <Placeholder label="AI OK" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 18,
    fontWeight: '700',
  },
});
