import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { authStyles } from '../../constants/auth-styles';
import { colors } from '../../constants/colors';

type AuthInputProps = TextInputProps & {
  label?: string;
};

export function AuthInput({ label, style, ...props }: AuthInputProps) {
  return (
    <View style={authStyles.inputSpacing}>
      {label ? <Text style={authStyles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.text.muted}
        style={[authStyles.input, style]}
        {...props}
      />
    </View>
  );
}
