import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { colors } from '../../constants/colors';

type MarkdownTextProps = {
  children: string;
  tone?: 'primary' | 'secondary';
  style?: StyleProp<TextStyle>;
};

type Segment =
  | { type: 'plain'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string };

function parseSegments(input: string): Segment[] {
  const segments: Segment[] = [];
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|([^*]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match[1]) {
      segments.push({ type: 'bold', text: match[1] });
    } else if (match[2]) {
      segments.push({ type: 'italic', text: match[2] });
    } else if (match[3]) {
      segments.push({ type: 'plain', text: match[3] });
    }
  }

  return segments.length > 0 ? segments : [{ type: 'plain', text: input }];
}

function MarkdownLine({
  children,
  tone,
  style,
}: {
  children: string;
  tone: 'primary' | 'secondary';
  style?: StyleProp<TextStyle>;
}) {
  const segments = useMemo(() => parseSegments(children), [children]);
  const plainStyle = tone === 'primary' ? styles.plainPrimary : styles.plainSecondary;

  return (
    <Text style={[plainStyle, style]}>
      {segments.map((segment, index) => {
        if (segment.type === 'bold') {
          return (
            <Text key={`md-${index}`} style={styles.bold}>
              {segment.text}
            </Text>
          );
        }
        if (segment.type === 'italic') {
          return (
            <Text key={`md-${index}`} style={styles.italic}>
              {segment.text}
            </Text>
          );
        }
        return <Text key={`md-${index}`}>{segment.text}</Text>;
      })}
    </Text>
  );
}

function parseHeading(line: string): { level: 2 | 3; text: string } | null {
  const h2 = line.match(/^##\s+(.+)$/);
  if (h2) return { level: 2, text: h2[1]!.trim() };
  const h3 = line.match(/^###\s+(.+)$/);
  if (h3) return { level: 3, text: h3[1]!.trim() };
  const h1 = line.match(/^#\s+(.+)$/);
  if (h1) return { level: 2, text: h1[1]!.trim() };
  return null;
}

export function MarkdownText({ children, tone = 'secondary', style }: MarkdownTextProps) {
  const lines = useMemo(() => children.replace(/\r\n/g, '\n').split('\n'), [children]);

  return (
    <View style={styles.block}>
      {lines.map((line, lineIndex) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <View key={`gap-${lineIndex}`} style={styles.lineGap} />;
        }

        const heading = parseHeading(trimmed);
        if (heading) {
          return (
            <Text
              key={`heading-${lineIndex}`}
              style={[
                heading.level === 2 ? styles.h2 : styles.h3,
                lineIndex > 0 ? styles.headingMargin : null,
              ]}
            >
              {heading.text}
            </Text>
          );
        }

        const cleaned = trimmed.replace(/^#+\s*/, '');
        return (
          <MarkdownLine key={`line-${lineIndex}`} tone={tone} style={style}>
            {cleaned}
          </MarkdownLine>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 2,
  },
  lineGap: {
    height: 8,
  },
  plainPrimary: {
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 24,
    fontFamily: 'Manrope-Regular',
  },
  plainSecondary: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Manrope-Regular',
  },
  bold: {
    color: colors.text.primary,
    fontFamily: 'Manrope-SemiBold',
  },
  italic: {
    fontFamily: 'Cormorant-Italic',
    fontStyle: 'italic',
  },
  h2: {
    color: colors.text.primary,
    fontSize: 18,
    lineHeight: 26,
    fontFamily: 'Manrope-SemiBold',
  },
  h3: {
    color: colors.text.primary,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Manrope-SemiBold',
  },
  headingMargin: {
    marginTop: 12,
  },
});
