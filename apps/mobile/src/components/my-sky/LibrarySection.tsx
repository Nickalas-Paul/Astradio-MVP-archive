import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

type LibrarySectionProps = {
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    hasAudio: boolean;
  }>;
};

export function LibrarySection({ items }: LibrarySectionProps) {
  if (!items.length) {
    return (
      <Text style={styles.emptyText}>
        Your saved readings and soundtracks will appear here
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      {items.map((item) => (
        <View key={item.id} style={styles.row}>
          <View style={styles.textBlock}>
            <Text style={styles.title}>{item.title}</Text>
            {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
          </View>
          {item.hasAudio ? <Text style={styles.playIcon}>▶</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
  subtitle: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    marginTop: 2,
  },
  playIcon: {
    color: colors.accent.DEFAULT,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
