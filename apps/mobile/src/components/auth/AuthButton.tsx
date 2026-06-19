import { Pressable, StyleSheet, Text } from 'react-native';
import { authStyles } from '../../constants/auth-styles';

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline';
};

export function AuthButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: AuthButtonProps) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        isPrimary ? authStyles.primaryButton : authStyles.outlineButton,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      <Text style={isPrimary ? authStyles.primaryButtonText : authStyles.outlineButtonText}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
});
