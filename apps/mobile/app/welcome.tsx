import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AuthButton } from '../src/components/auth/AuthButton';
import { AUTH_HORIZONTAL_PADDING, authStyles } from '../src/constants/auth-styles';
import { colors } from '../src/constants/colors';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={authStyles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Image
            source={require('../assets/logo-wordmark.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Astradio</Text>
          <Text style={styles.tagline}>astrology you can hear</Text>
        </View>

        <View style={styles.actions}>
          <AuthButton
            label="Create your chart"
            onPress={() => router.push('/register')}
          />
          <View style={styles.buttonGap} />
          <AuthButton
            label="Sign in"
            variant="outline"
            onPress={() => router.push('/login')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: AUTH_HORIZONTAL_PADDING,
    justifyContent: 'space-between',
    paddingBottom: 48,
  },
  header: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
  },
  logo: {
    height: 36,
    width: 36,
    marginBottom: 12,
  },
  title: {
    color: colors.text.primary,
    fontSize: 34,
    fontFamily: 'Cormorant-SemiBold',
    textAlign: 'center',
  },
  tagline: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    marginTop: 12,
  },
  actions: {
    paddingBottom: 24,
  },
  buttonGap: {
    height: 12,
  },
});
