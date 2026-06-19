import { Stack } from 'expo-router';

/** Stack for future Sandbox detail screens (chart search, etc.). Main entry ↔ workbench is in-tab state. */
export default function SandboxLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
