import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../../lib/api';
import { colors } from '../../constants/colors';
import type { LibraryCompositionRow } from '../../types/my-sky';

export type AudioLibrarySelection = {
  exportId: string;
  label: string;
};

type AudioLibraryPickerProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (selection: AudioLibrarySelection) => void;
};

function librarySourceLabel(source: unknown): string {
  const value = String(source ?? '').trim();
  if (value === 'profile_identity') return 'Identity';
  if (value === 'profile_active') return 'Transit reading';
  if (value === 'community_relational_weather') return 'Connection';
  if (value === 'community_relationship') return 'Connection';
  if (value === 'community_group') return 'Group reading';
  if (value === 'community_post_audio') return 'Community audio';
  if (value === 'sandbox') return 'Sandbox';
  return value ? value.replace(/_/g, ' ') : 'Saved reading';
}

function formatLibraryDate(createdAt: unknown): string {
  if (createdAt == null || createdAt === '') return '';
  const date = new Date(String(createdAt));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function compositionTypeLabel(compositionType: unknown): string {
  const value = String(compositionType ?? '').trim();
  return value || 'Unknown';
}

function libraryRowSummary(row: LibraryCompositionRow): string {
  const date = formatLibraryDate(row.created_at);
  const label = librarySourceLabel(row.source);
  const type = compositionTypeLabel(row.composition_type);
  return [date, label, type].filter(Boolean).join(' · ');
}

export function AudioLibraryPicker({ visible, onClose, onSelect }: AudioLibraryPickerProps) {
  const [rows, setRows] = useState<LibraryCompositionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api<LibraryCompositionRow[]>('/api/sandbox/compositions?limit=50');
      const withExport = (Array.isArray(list) ? list : []).filter((row) => {
        const exportId = typeof row.export_id === 'string' ? row.export_id.trim() : '';
        return exportId.length > 0;
      });
      setRows(withExport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void load();
  }, [load, visible]);

  const handleSelect = (row: LibraryCompositionRow) => {
    const exportId = String(row.export_id).trim();
    onSelect({ exportId, label: libraryRowSummary(row) || 'Saved reading' });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Attach audio from Library</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.accent.DEFAULT} />
              <Text style={styles.muted}>Loading saved audio…</Text>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!loading && !error && rows.length === 0 ? (
            <Text style={styles.muted}>
              No saved audio artifacts yet. Create and save a reading in My Sky or Sandbox first.
            </Text>
          ) : null}

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {rows.map((row) => {
              const source = librarySourceLabel(row.source);
              const date = formatLibraryDate(row.created_at);
              const type = compositionTypeLabel(row.composition_type);
              return (
                <Pressable
                  key={String(row.id)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => handleSelect(row)}
                >
                  <Text style={styles.rowTitle}>{source}</Text>
                  <Text style={styles.rowMeta}>
                    {[date, type].filter(Boolean).join(' · ')}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 18,
    fontFamily: 'Cormorant-SemiBold',
    marginRight: 12,
  },
  close: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
  },
  centered: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  muted: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    lineHeight: 20,
    marginBottom: 12,
  },
  error: {
    color: colors.error,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    marginBottom: 12,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: 8,
    paddingBottom: 8,
  },
  row: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowPressed: {
    opacity: 0.85,
    borderColor: colors.accent.DEFAULT,
  },
  rowTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 4,
  },
  rowMeta: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
  },
  cancelBtn: {
    marginTop: 12,
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
  },
});
