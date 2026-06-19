import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { BottomTabBar, type BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import MiniPlayer from '../../src/components/global/MiniPlayer';
import { colors } from '../../src/constants/colors';

function TabBarWithMiniPlayer(props: BottomTabBarProps) {
  return (
    <View>
      <MiniPlayer />
      <BottomTabBar {...props} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent.DEFAULT,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: {
          fontFamily: 'Manrope-Medium',
          fontSize: 12,
        },
      }}
      tabBar={(props) => <TabBarWithMiniPlayer {...props} />}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="my-sky" options={{ title: 'My Sky' }} />
      <Tabs.Screen name="community" options={{ title: 'Community' }} />
      <Tabs.Screen name="sandbox" options={{ title: 'Sandbox' }} />
    </Tabs>
  );
}
