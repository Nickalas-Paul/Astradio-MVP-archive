import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';

type PlaceholderScreenProps = {
  label: string;
};

export function PlaceholderScreen({ label }: PlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  label: {
    color: colors.text.primary,
    fontSize: 24,
    fontFamily: 'Manrope-SemiBold',
  },
});
