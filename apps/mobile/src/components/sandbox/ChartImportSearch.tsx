import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../../constants/colors';
import { formatApiError } from '../../lib/format-api-error';
import {
  chartApiOwnerDisplayLabel,
  chartApiRecordHasEngineBirthFields,
  chartApiRecordToBirthWire,
  CHART_IMPORT_UNAVAILABLE_MSG,
} from '../../lib/sandbox-chart-import';
import {
  fetchChartRecord,
  fetchChartSnapshot,
  postSnapshot,
  searchCharts,
} from '../../lib/sandbox-fetch';
import { applyOverridesToSnapshotLite } from '../../lib/sandbox-resolve';
import { snapshotFromEphemeris } from '../../lib/sandbox-slot-utils';
import { useAuthStore } from '../../store/auth';
import { useSandboxStore } from '../../store/sandbox';
import type { ChartSearchResult } from '../../types/sandbox';

type ChartImportSearchProps = {
  slotIndex: number;
  onCancel: () => void;
};

const DEBOUNCE_MS = 400;

export function ChartImportSearch({ slotIndex, onCancel }: ChartImportSearchProps) {
  const userId = useAuthStore((s) => s.user?.id);
  const updateSlot = useSandboxStore((s) => s.updateSlot);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChartSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const rows = await searchCharts(trimmed, userId);
          setResults(rows);
          setError(null);
        } catch (e) {
          setResults([]);
          setError(formatApiError(e, 'Search unavailable'));
        } finally {
          setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);
  }, [query, userId]);

  const importChart = useCallback(
    async (chartId: string, displayLabel?: string) => {
      setImporting(true);
      setError(null);
      try {
        const chartData = await fetchChartRecord(chartId);
        const displayName = displayLabel ?? chartApiOwnerDisplayLabel(chartData);
        const slot = useSandboxStore.getState().slots[slotIndex];
        const overrides = slot?.overrides ?? {};

        if (chartApiRecordHasEngineBirthFields(chartData)) {
          const wire = chartApiRecordToBirthWire(chartData);
          const snapRes = await postSnapshot(wire, {
            planets: Object.fromEntries(
              Object.entries(overrides).map(([k, v]) => [k, { lonDeg: v.lon }])
            ),
          });
          const snap = snapshotFromEphemeris(snapRes.snapshot);
          if (!snap) throw new Error('Snapshot failed after import');
          updateSlot(slotIndex, {
            entryMode: 'chart_id',
            chartId,
            chartDisplayName: displayName,
            snapshot: snap,
            baseSnapshot: snap,
            birth: {
              date: wire.date,
              time: wire.time,
              lat: wire.lat,
              lon: wire.lon,
              timezone: wire.timezone,
              locationLabel: wire.location.label,
            },
          });
        } else {
          const serverSnap = await fetchChartSnapshot(chartId);
          if (!serverSnap) {
            throw { status: 403, message: CHART_IMPORT_UNAVAILABLE_MSG };
          }
          const base = snapshotFromEphemeris(serverSnap);
          if (!base) throw new Error('Chart snapshot missing ephemeris data');
          const effective = applyOverridesToSnapshotLite(base, overrides);
          updateSlot(slotIndex, {
            entryMode: 'chart_id',
            chartId,
            chartDisplayName: displayName,
            snapshot: effective,
            baseSnapshot: base,
          });
        }
      } catch (e) {
        setError(formatApiError(e, 'Import failed'));
      } finally {
        setImporting(false);
      }
    },
    [slotIndex, updateSlot]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Import chart</Text>
        <Pressable onPress={onCancel} accessibilityRole="button">
          <Text style={styles.cancel}>Back</Text>
        </Pressable>
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or chart ID"
        placeholderTextColor={colors.text.muted}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading || importing ? (
        <ActivityIndicator color={colors.accent.DEFAULT} style={styles.loader} />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.list}>
        {results.map((item) => (
          <Pressable
            key={item.chart_id}
            style={styles.row}
            disabled={importing}
            onPress={() => void importChart(item.chart_id, item.label)}
            accessibilityRole="button"
          >
            <View style={styles.rowText}>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {item.label}
              </Text>
              {item.handle ? (
                <Text style={styles.rowHandle} numberOfLines={1}>
                  @{item.handle.replace(/^@/, '')}
                </Text>
              ) : null}
            </View>
            <Text style={styles.badge}>
              {item.source === 'own' ? 'Your chart' : 'Connection'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  cancel: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Medium',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text.primary,
    fontFamily: 'Manrope-Regular',
    backgroundColor: colors.surfaceLight,
  },
  loader: {
    marginVertical: 8,
  },
  error: {
    color: colors.error,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
  },
  rowHandle: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    marginTop: 2,
  },
  badge: {
    color: colors.text.secondary,
    fontSize: 10,
    fontFamily: 'Manrope-Medium',
    borderWidth: 1,
    borderColor: `${colors.border}cc`,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
});
