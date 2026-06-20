import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { useAudioStore, type AudioSource } from '../../store/audio';

type LibrarySectionProps = {
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    hasAudio: boolean;
    exportId?: string | null;
    source?: string;
  }>;
};

function isValidExportId(exportId?: string | null): exportId is string {
  return typeof exportId === 'string' && /^[a-f0-9]{64}$/.test(exportId);
}

function mapSourceToAudioSource(source?: string): AudioSource {
  switch (source) {
    case 'profile_identity':
      return 'identity';
    case 'profile_active':
      return 'transit';
    case 'community_relationship':
    case 'community_group':
      return 'connection';
    case 'community_post_audio':
      return 'post';
    case 'sky':
      return 'sandbox';
    default:
      return 'sandbox';
  }
}

export function LibrarySection({ items }: LibrarySectionProps) {
  const playTrack = useAudioStore((s) => s.playTrack);

  if (!items.length) {
    return (
      <Text style={styles.emptyText}>
        Your saved readings and soundtracks will appear here
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      {items.map((item) => {
        const playable = isValidExportId(item.exportId);

        const rowContent = (
          <>
            <View style={styles.textBlock}>
              <Text style={styles.title}>{item.title}</Text>
              {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
            </View>
            {playable ? <Text style={styles.playIcon}>▶</Text> : null}
          </>
        );

        if (!playable) {
          return (
            <View key={item.id} style={styles.row}>
              {rowContent}
            </View>
          );
        }

        return (
          <Pressable
            key={item.id}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => {
              playTrack({
                exportId: item.exportId!,
                label: item.title,
                source: mapSourceToAudioSource(item.source),
              });
            }}
          >
            {rowContent}
          </Pressable>
        );
      })}
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
  rowPressed: {
    opacity: 0.85,
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
