import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MarkdownText } from '../shared/MarkdownText';
import { AUTH_HORIZONTAL_PADDING } from '../../constants/auth-styles';
import { colors } from '../../constants/colors';
import type { SandboxResolveReport } from '../../types/sandbox';

type Props = {
  report: SandboxResolveReport;
};

function cleanTitle(title: string): string {
  return title.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
}

export function SandboxReportDisplay({ report }: Props) {
  const sections = report.explanation?.sections ?? [];
  const synastry = report.sandboxSynastryReport;

  return (
    <View style={styles.wrap}>
      {sections.map((section, i) => (
        <View key={`${section.id || i}-${i}`} style={styles.section}>
          {section.title ? (
            <Text style={styles.heading}>{cleanTitle(section.title)}</Text>
          ) : null}
          {section.text ? (
            <MarkdownText tone="secondary">{section.text}</MarkdownText>
          ) : null}
          {section.bullets?.map((bullet, bi) => (
            <MarkdownText key={`${section.id}-b-${bi}`} tone="secondary">
              {`• ${bullet}`}
            </MarkdownText>
          ))}
        </View>
      ))}

      {synastry?.pairSections?.length ? (
        <View style={styles.synastry}>
          <Text style={styles.synastryTitle}>Synastry</Text>
          {synastry.pairSections.map((pair, pi) => (
            <View key={`pair-${pi}`} style={styles.section}>
              {pair.pairHeader ? (
                <Text style={styles.heading}>{pair.pairHeader}</Text>
              ) : null}
              {pair.tierBlocks?.map((tier, ti) => (
                <View key={`tier-${pi}-${ti}`} style={styles.tierBlock}>
                  {tier.title ? <Text style={styles.tierTitle}>{tier.title}</Text> : null}
                  {tier.activations?.map((act, ai) => (
                    <View key={`act-${pi}-${ti}-${ai}`} style={styles.activation}>
                      {act.directionalHeader ? (
                        <Text style={styles.activationHeader}>{act.directionalHeader}</Text>
                      ) : null}
                      {act.synastryProse ? (
                        <MarkdownText tone="secondary">{act.synastryProse}</MarkdownText>
                      ) : null}
                      {act.sonicInterplay ? (
                        <>
                          <Text style={styles.sonicLabel}>Sonic Interplay</Text>
                          <MarkdownText tone="secondary">{act.sonicInterplay}</MarkdownText>
                        </>
                      ) : null}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: AUTH_HORIZONTAL_PADDING,
    paddingVertical: 16,
    gap: 12,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  heading: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 16,
    color: colors.text.primary,
  },
  synastry: {
    gap: 12,
  },
  synastryTitle: {
    fontFamily: 'Cormorant-Bold',
    fontSize: 22,
    color: colors.text.primary,
    paddingHorizontal: 4,
  },
  tierBlock: {
    gap: 8,
    marginTop: 4,
  },
  tierTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 15,
    color: colors.text.primary,
  },
  activation: {
    gap: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  activationHeader: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
    color: colors.text.primary,
  },
  sonicLabel: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
  },
});
