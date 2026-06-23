import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '../src/constants/colors';
import { useAuthStore } from '../src/store/auth';

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <Image
        source={require('../assets/logo-wordmark.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.appName}>Astradio</Text>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Manrope-Regular': require('../assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Medium': require('../assets/fonts/Manrope-Medium.ttf'),
    'Manrope-SemiBold': require('../assets/fonts/Manrope-SemiBold.ttf'),
    'Manrope-Bold': require('../assets/fonts/Manrope-Bold.ttf'),
    'Cormorant-Regular': require('../assets/fonts/Cormorant-Regular.ttf'),
    'Cormorant-Medium': require('../assets/fonts/Cormorant-Medium.ttf'),
    'Cormorant-SemiBold': require('../assets/fonts/Cormorant-SemiBold.ttf'),
    'Cormorant-Bold': require('../assets/fonts/Cormorant-Bold.ttf'),
    'Cormorant-Italic': require('../assets/fonts/Cormorant-Italic.ttf'),
  });

  const restore = useAuthStore((state) => state.restore);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    void restore();
  }, [restore]);

  if (!fontsLoaded || isLoading) {
    return <LoadingScreen />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  logo: {
    height: 32,
    width: 32,
    marginBottom: 12,
  },
  appName: {
    color: colors.text.primary,
    fontSize: 32,
    fontFamily: 'Cormorant-SemiBold',
  },
});
