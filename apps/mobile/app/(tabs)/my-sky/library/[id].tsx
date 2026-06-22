import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AUTH_HORIZONTAL_PADDING } from '../../../../src/constants/auth-styles';
import { colors } from '../../../../src/constants/colors';
import { layout } from '../../../../src/constants/layout';
import { deleteLibraryComposition, fetchLibraryDetail } from '../../../../src/lib/my-sky-fetch';
import { api } from '../../../../src/lib/api';
import { useAudioStore, type AudioSource } from '../../../../src/store/audio';
import type { SavedCompositionDetail } from '../../../../src/types/sandbox';

function isValidExportId(exportId?: string | null): exportId is string {
  return typeof exportId === 'string' && /^[a-f0-9]{64}$/.test(exportId);
}

function parseSandboxState(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function librarySourceLabel(source: string | null | undefined): string {
  const value = String(source ?? '').trim();
  if (value === 'profile_identity') return 'Identity';
  if (value === 'profile_active') return 'Transit reading';
  if (value === 'community_relationship') return 'Connection reading';
  if (value === 'community_group') return 'Group reading';
  if (value === 'community_relational_weather') return 'Forecast';
  if (value === 'community_post_audio') return 'Community audio';
  if (value === 'sandbox') return 'Sandbox reading';
  if (value === 'sky') return "Today's Sky";
  return value ? value.replace(/_/g, ' ') : 'Saved reading';
}

function mapSourceToAudioSource(source?: string | null): AudioSource {
  switch (source) {
    case 'profile_identity':
      return 'identity';
    case 'profile_active':
      return 'transit';
    case 'community_relationship':
    case 'community_group':
    case 'community_relational_weather':
      return 'connection';
    case 'community_post_audio':
      return 'post';
    case 'sky':
      return 'sky';
    default:
      return 'sandbox';
  }
}

function formatCreatedAt(createdAt?: string | null): string {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function isMetadataOnlyReport(report: unknown): boolean {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return false;
  const keys = Object.keys(report as Record<string, unknown>);
  if (keys.length === 0) return true;
  const metadataKeys = new Set(['savedFrom', 'label', 'at']);
  return keys.every((k) => metadataKeys.has(k));
}

function reportHasReadableContent(report: unknown): boolean {
  if (report == null) return false;
  if (typeof report === 'string') return report.trim().length > 0;
  if (typeof report !== 'object' || Array.isArray(report)) return false;
  if (isMetadataOnlyReport(report)) return false;
  const obj = report as Record<string, unknown>;
  if (typeof obj.text === 'string' && obj.text.trim()) return true;
  if (obj.text && typeof obj.text === 'object' && !Array.isArray(obj.text)) {
    const textObj = obj.text as Record<string, unknown>;
    if (typeof textObj.short === 'string' && textObj.short.trim()) return true;
    if (typeof textObj.long === 'string' && textObj.long.trim()) return true;
  }
  const explanation = obj.explanation as { sections?: Array<{ text?: string }> } | undefined;
  if (Array.isArray(explanation?.sections)) {
    return explanation!.sections!.some((s) => typeof s.text === 'string' && s.text.trim().length > 0);
  }
  if (Array.isArray(obj.sections)) {
    return (obj.sections as Array<{ text?: string }>).some(
      (s) => typeof s.text === 'string' && s.text.trim().length > 0,
    );
  }
  return false;
}

function renderReportText(report: unknown): string {
  if (typeof report === 'string') return report.trim();
  if (!report || typeof report !== 'object' || Array.isArray(report)) return '';
  const obj = report as Record<string, unknown>;
  if (typeof obj.text === 'string') return obj.text.trim();
  if (obj.text && typeof obj.text === 'object' && !Array.isArray(obj.text)) {
    const textObj = obj.text as { short?: string; long?: string };
    return [textObj.short, textObj.long].filter(Boolean).join('\n\n').trim();
  }
  const explanation = obj.explanation as { sections?: Array<{ title?: string; text?: string }> } | undefined;
  if (Array.isArray(explanation?.sections)) {
    return explanation!.sections!
      .map((s) => {
        const title = s.title?.trim();
        const text = s.text?.trim() ?? '';
        return title ? `${title}\n\n${text}` : text;
      })
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }
  if (Array.isArray(obj.sections)) {
    return (obj.sections as Array<{ title?: string; text?: string }>)
      .map((s) => {
        const title = s.title?.trim();
        const text = s.text?.trim() ?? '';
        return title ? `${title}\n\n${text}` : text;
      })
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }
  return '';
}

function emptyMessageForSource(
  source: string | null | undefined,
  createdAtLabel: string,
  sandboxState: Record<string, unknown> | null,
): string {
  const value = String(source ?? '').trim();
  if (value === 'profile_identity') {
    return 'Your identity soundtrack. Visit My Sky for the full reading.';
  }
  if (value === 'profile_active') {
    return createdAtLabel
      ? `This transit was saved on ${createdAtLabel}. Open Today for current transits.`
      : 'This transit was saved. Open Today for current transits.';
  }
  if (value === 'sandbox') {
    return 'No reading text saved for this composition.';
  }
  if (value === 'sky') {
    const skyDate =
      (typeof sandboxState?.date === 'string' && sandboxState.date.trim()) || createdAtLabel || 'this date';
    return `Today's Sky for ${skyDate}.`;
  }
  if (value === 'community_relationship' || value === 'community_group') {
    return 'Open this connection from Community to see the full reading.';
  }
  if (value === 'community_relational_weather') {
    return 'Forecast text was not stored with this save.';
  }
  if (value === 'community_post_audio') {
    return 'Saved from a community post.';
  }
  return 'No reading text saved.';
}

export default function LibraryDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const playTrack = useAudioStore((s) => s.playTrack);

  const [detail, setDetail] = useState<SavedCompositionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('Missing library item.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);

    void fetchLibraryDetail(id)
      .then((row) => {
        if (!cancelled) setDetail(row);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load library item');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const sandboxState = useMemo(() => parseSandboxState(detail?.sandbox_state), [detail?.sandbox_state]);
  const createdAtLabel = useMemo(() => formatCreatedAt(detail?.created_at), [detail?.created_at]);
  const reportText = useMemo(() => renderReportText(detail?.report), [detail?.report]);
  const hasReport = useMemo(() => reportHasReadableContent(detail?.report), [detail?.report]);
  const exportId = detail?.export_id ?? null;
  const sourceLabel = librarySourceLabel(detail?.source);

  const handleListen = () => {
    if (!detail || !isValidExportId(exportId)) return;
    playTrack({
      exportId,
      label: sourceLabel,
      source: mapSourceToAudioSource(detail.source),
    });
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteLibraryComposition(id);
      router.back();
    } catch {
      Alert.alert('Error', 'Could not remove this item.');
      setDeleting(false);
    }
  };

  const handleRename = async () => {
    if (!id) return;
    setRenameLoading(true);
    try {
      const trimmed = editLabel.trim();
      const updated = await api<{ display_label?: string | null }>(
        `/api/sandbox/compositions/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ display_label: trimmed || null }),
        },
      );
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              display_label:
                typeof updated.display_label === 'string'
                  ? updated.display_label
                  : trimmed || null,
            }
          : prev,
      );
      setIsEditing(false);
    } catch {
      Alert.alert('Error', 'Could not rename this track.');
    } finally {
      setRenameLoading(false);
    }
  };

  const displayTitle =
    (typeof detail?.display_label === 'string' && detail.display_label.trim()) || sourceLabel;

  const contentMessage =
    detail && !hasReport
      ? emptyMessageForSource(detail.source, createdAtLabel, sandboxState)
      : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back to My Sky</Text>
        </Pressable>

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.accent.DEFAULT} />
            <Text style={styles.loadingText}>Loading saved item…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {detail && !loading ? (
          <View style={styles.detailBlock}>
            {!isEditing ? (
              <Pressable
                onPress={() => {
                  setEditLabel(detail.display_label || '');
                  setIsEditing(true);
                }}
              >
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{displayTitle}</Text>
                  <Text style={styles.editHint}>✎</Text>
                </View>
              </Pressable>
            ) : (
              <View style={styles.renameRow}>
                <TextInput
                  value={editLabel}
                  onChangeText={setEditLabel}
                  placeholder="Name this track"
                  maxLength={100}
                  autoFocus
                  style={styles.renameInput}
                  placeholderTextColor={colors.text.muted}
                />
                <Pressable onPress={() => void handleRename()} disabled={renameLoading}>
                  <Text style={styles.renameSave}>{renameLoading ? '…' : 'Save'}</Text>
                </Pressable>
                <Pressable onPress={() => setIsEditing(false)} disabled={renameLoading}>
                  <Text style={styles.renameCancel}>Cancel</Text>
                </Pressable>
              </View>
            )}
            {createdAtLabel ? <Text style={styles.subtitle}>{createdAtLabel}</Text> : null}

            {isValidExportId(exportId) ? (
              <Pressable
                onPress={handleListen}
                style={({ pressed }) => [styles.listenButton, pressed && styles.pressed]}
              >
                <Text style={styles.listenButtonText}>Listen</Text>
              </Pressable>
            ) : null}

            {hasReport ? (
              <Text style={styles.reportText}>{reportText}</Text>
            ) : contentMessage ? (
              <Text style={styles.emptyReport}>{contentMessage}</Text>
            ) : null}

            <View style={styles.metaRow}>
              {detail.composition_type ? (
                <Text style={styles.metaBadge}>{detail.composition_type}</Text>
              ) : null}
              {createdAtLabel ? <Text style={styles.metaText}>Saved {createdAtLabel}</Text> : null}
            </View>

            {!deleteConfirm ? (
              <Pressable onPress={() => setDeleteConfirm(true)} style={styles.deleteButton}>
                <Text style={styles.deleteText}>Remove from Library</Text>
              </Pressable>
            ) : (
              <View style={styles.deleteConfirmRow}>
                <Pressable onPress={() => void handleDelete()} disabled={deleting}>
                  <Text style={styles.deleteText}>{deleting ? 'Removing…' : 'Confirm Remove'}</Text>
                </Pressable>
                <Pressable onPress={() => setDeleteConfirm(false)} disabled={deleting}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: AUTH_HORIZONTAL_PADDING,
    paddingBottom: layout.screenBottomPadding,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: 12,
  },
  backText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
  errorBlock: {
    paddingVertical: 16,
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
  detailBlock: {
    gap: layout.internalGap + 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: colors.text.primary,
    fontSize: 24,
    fontFamily: 'Cormorant-SemiBold',
  },
  editHint: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  renameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  renameInput: {
    flex: 1,
    minWidth: 160,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
  },
  renameSave: {
    color: colors.accent.DEFAULT,
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
  },
  renameCancel: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
  subtitle: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
  listenButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  listenButtonText: {
    color: colors.background,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  pressed: {
    opacity: 0.85,
  },
  reportText: {
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Manrope-Regular',
    marginTop: 8,
  },
  emptyReport: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Manrope-Regular',
    marginTop: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  metaBadge: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Medium',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  metaText: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  deleteButton: {
    paddingVertical: 16,
    marginTop: 8,
  },
  deleteConfirmRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  deleteText: {
    color: '#f87171',
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
    textAlign: 'center',
  },
  cancelText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
});
