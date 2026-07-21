import { Stack } from 'expo-router';
import { colors } from '../../../src/constants/colors';

export default function CampaignLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[campaignId]" />
    </Stack>
  );
}
