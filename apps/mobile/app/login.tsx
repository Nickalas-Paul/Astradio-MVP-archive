import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthButton } from '../src/components/auth/AuthButton';
import { AuthInput } from '../src/components/auth/AuthInput';
import { BackButton } from '../src/components/auth/BackButton';
import { authStyles } from '../src/constants/auth-styles';
import { useAuthStore } from '../src/store/auth';

export default function LoginScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const error = useAuthStore((state) => state.error);
  const login = useAuthStore((state) => state.login);
  const clearError = useAuthStore((state) => state.clearError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Redirect href="/(tabs)/today" />;
  }

  const handleSubmit = async () => {
    clearError();
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      // Error surfaced via auth store.
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={authStyles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={authStyles.content}>
          <BackButton href="/welcome" />
          <Text style={authStyles.heading}>Sign in</Text>

          <AuthInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            placeholder="you@example.com"
          />
          <AuthInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            placeholder="Password"
          />

          {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

          <AuthButton
            label={loading ? 'Signing in...' : 'Sign in'}
            onPress={handleSubmit}
            loading={loading}
            disabled={!email.trim() || !password}
          />

          <Pressable onPress={() => router.push('/register')}>
            <Text style={authStyles.footerText}>
              Don&apos;t have an account?{' '}
              <Text style={authStyles.linkText}>Create your chart</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
