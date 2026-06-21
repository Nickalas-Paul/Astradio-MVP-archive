import { StyleSheet, Text, View } from 'react-native';
import { MarkdownText } from '../shared/MarkdownText';
import { PlanetText } from '../shared/PlanetText';
import { colors } from '../../constants/colors';
import { layout } from '../../constants/layout';
import { typography } from '../../constants/typography';
import type { ProfileChartSection } from '../../types/my-sky';

type IdentityReadingProps = {
  sections: ProfileChartSection[];
};

function isSonicSection(section: ProfileChartSection): boolean {
  return section.id === 'audio_thread' || section.id === 'todays_sound';
}

function cleanSectionTitle(title: string): string {
  return title.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
}

export function IdentityReading({ sections }: IdentityReadingProps) {
  if (!sections.length) {
    return (
      <Text style={styles.emptyText}>Your identity reading will appear here once your chart is ready.</Text>
    );
  }

  return (
    <View style={styles.container}>
      {sections.map((section) => (
        <View key={section.id} style={styles.card}>
          {isSonicSection(section) ? (
            <Text style={styles.sonicLabel}>How This Sounds</Text>
          ) : null}
          <PlanetText tone="primary" defaultColor={colors.text.primary} style={[typography.sectionHeader, styles.sectionHeaderSpacing]}>
            {cleanSectionTitle(section.title)}
          </PlanetText>
          <MarkdownText>{section.text}</MarkdownText>
          {section.bullets?.map((bullet, index) => (
            <MarkdownText key={`${section.id}-bullet-${index}`}>{`• ${bullet}`}</MarkdownText>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: layout.sectionGap,
  },
  card: {
    backgroundColor: layout.card.backgroundColor,
    borderRadius: layout.card.borderRadius,
    borderWidth: layout.card.borderWidth,
    borderColor: layout.card.borderColor,
    padding: layout.card.padding,
  },
  sectionHeaderSpacing: {
    marginBottom: 8,
  },
  sonicLabel: {
    color: colors.accent.DEFAULT,
    fontSize: 12,
    fontFamily: 'Manrope-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
