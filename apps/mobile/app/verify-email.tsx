import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthButton } from '../src/components/auth/AuthButton';
import { AUTH_HORIZONTAL_PADDING, authStyles } from '../src/constants/auth-styles';
import { colors } from '../src/constants/colors';
import { api } from '../src/lib/api';
import { formatApiError } from '../src/lib/format-api-error';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';

  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const handleOpenEmail = async () => {
    try {
      await Linking.openURL('mailto:');
    } catch {
      setResendError('Could not open your email app');
    }
  };

  const handleResend = async () => {
    if (!email) {
      setResendError('Missing email address');
      return;
    }

    setResending(true);
    setResendMessage(null);
    setResendError(null);
    try {
      await api('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setResendMessage('Verification email sent');
    } catch (err) {
      setResendError(formatApiError(err, 'Could not resend verification email'));
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={authStyles.screen}>
      <View style={styles.container}>
        <Text style={styles.icon}>✉</Text>
        <Text style={styles.heading}>Check your email</Text>
        <Text style={styles.body}>
          If this email isn&apos;t already registered, you&apos;ll receive a verification link at{' '}
          {email || 'your email'} shortly. Tap the link to activate your account.
        </Text>

        {resendError ? <Text style={authStyles.errorText}>{resendError}</Text> : null}
        {resendMessage ? <Text style={styles.successText}>{resendMessage}</Text> : null}

        <AuthButton label="Open email app" onPress={handleOpenEmail} />

        <Pressable
          onPress={handleResend}
          disabled={resending}
          style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
        >
          <Text style={authStyles.linkText}>
            {resending ? 'Sending...' : 'Resend verification email'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace('/login')}
          style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
        >
          <Text style={authStyles.mutedLinkText}>Back to sign in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: AUTH_HORIZONTAL_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
  },
  icon: {
    fontSize: 40,
    marginBottom: 16,
  },
  heading: {
    color: colors.text.primary,
    fontSize: 24,
    fontFamily: 'Cormorant-SemiBold',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    marginBottom: 12,
    textAlign: 'center',
  },
  textButton: {
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 12,
  },
  pressed: {
    opacity: 0.75,
  },
});
