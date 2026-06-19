import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../constants/colors';

type BackButtonProps = {
  href?: '/welcome' | '/login';
};

export function BackButton({ href = '/welcome' }: BackButtonProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      hitSlop={8}
    >
      <Text style={styles.arrow}>←</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  arrow: {
    color: colors.text.primary,
    fontSize: 24,
    fontFamily: 'Manrope-Regular',
  },
});
