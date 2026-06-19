import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { MarkdownText } from '../shared/MarkdownText';

type SonicBulletsSectionProps = {
  bullets: string[];
};

export function SonicBulletsSection({ bullets }: SonicBulletsSectionProps) {
  const items = bullets.filter((b) => String(b).trim().length > 0);
  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>How This Connection Sounds</Text>
      {items.map((bullet, index) => (
        <View key={index} style={styles.bullet}>
          <MarkdownText tone="secondary">{String(bullet)}</MarkdownText>
        </View>
      ))}
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
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 12,
  },
  bullet: {
    borderLeftWidth: 2,
    borderLeftColor: `${colors.accent.DEFAULT}33`,
    paddingLeft: 12,
    marginBottom: 12,
  },
});
