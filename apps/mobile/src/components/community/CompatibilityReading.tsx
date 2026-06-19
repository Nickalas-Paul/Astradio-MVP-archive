import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { MarkdownText } from '../shared/MarkdownText';

type CompatibilityReadingProps = {
  short: string;
  long: string;
};

export function CompatibilityReading({ short, long }: CompatibilityReadingProps) {
  if (!short.trim() && !long.trim()) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Reading</Text>
      {short.trim() ? (
        <View style={styles.lead}>
          <MarkdownText tone="primary">{short.trim()}</MarkdownText>
        </View>
      ) : null}
      {long.trim() ? (
        <View style={short.trim() ? styles.bodyWrap : undefined}>
          <MarkdownText tone="secondary">{long.trim()}</MarkdownText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  heading: {
    color: colors.text.primary,
    fontSize: 18,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 12,
  },
  lead: {
    marginBottom: 12,
  },
  bodyWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
});
