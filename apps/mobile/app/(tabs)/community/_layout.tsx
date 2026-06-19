import { Stack } from 'expo-router';
import { colors } from '../../../src/constants/colors';

export default function CommunityLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
