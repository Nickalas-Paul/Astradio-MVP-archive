import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchProfileChartId } from '../lib/community-fetch';
import {
  checkExportAvailability,
  fetchChartSnapshot,
  fetchComparison,
  fetchRelationship,
  generateConnectionAudio,
  isValidExportId,
  materializeRelationship,
  parseCompatibilityText,
  resolveViewerPeerChartIds,
  type ComparisonJson,
  type RelationshipRow,
} from '../lib/connection-detail-fetch';
import { formatApiError } from '../lib/format-api-error';
import { mapSnapshotToWheel } from '../lib/my-sky-mappers';
import type { MySkyScreenData } from '../types/my-sky';

type UseConnectionDetailParams = {
  relationshipId: string;
  peerDisplayName?: string;
  viewerDisplayName?: string;
};

export function useConnectionDetail({
  relationshipId,
  peerDisplayName,
  viewerDisplayName,
}: UseConnectionDetailParams) {
  const [relationship, setRelationship] = useState<RelationshipRow | null>(null);
  const [comparison, setComparison] = useState<ComparisonJson | null>(null);
  const [viewerSnapshot, setViewerSnapshot] = useState<MySkyScreenData['wheel']>(null);
  const [peerSnapshot, setPeerSnapshot] = useState<MySkyScreenData['wheel']>(null);
  const [viewerLabel, setViewerLabel] = useState(viewerDisplayName?.trim() || 'You');
  const [peerLabel, setPeerLabel] = useState(peerDisplayName?.trim() || 'Connection');
  const [exportId, setExportId] = useState<string | null>(null);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [audioGenerating, setAudioGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materializeError, setMaterializeError] = useState<string | null>(null);
  const materializeOnceRef = useRef(false);

  useEffect(() => {
    if (peerDisplayName?.trim()) {
      setPeerLabel(peerDisplayName.trim());
    }
  }, [peerDisplayName]);

  const load = useCallback(async () => {
    if (!relationshipId) {
      setError('Invalid connection link');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setMaterializeError(null);
    setComparison(null);
    setRelationship(null);
    setViewerSnapshot(null);
    setPeerSnapshot(null);
    setExportId(null);
    setAudioAvailable(false);

    try {
      const profile = await fetchProfileChartId();
      if (viewerDisplayName?.trim()) {
        setViewerLabel(viewerDisplayName.trim());
      } else if (profile.userId) {
        setViewerLabel('You');
      }

      const rel = await fetchRelationship(relationshipId);
      setRelationship(rel);

      let comparisonId = rel.comparisonId?.trim() || null;
      if (!comparisonId && !materializeOnceRef.current) {
        materializeOnceRef.current = true;
        try {
          const materialized = await materializeRelationship(relationshipId);
          if (typeof materialized.comparisonId === 'string' && materialized.comparisonId) {
            comparisonId = materialized.comparisonId;
            setRelationship((prev) => (prev ? { ...prev, comparisonId } : prev));
          } else {
            setMaterializeError(
              typeof materialized.error === 'string'
                ? materialized.error
                : 'Could not create reading for this connection.'
            );
          }
        } catch (err) {
          setMaterializeError(formatApiError(err, 'Could not create reading for this connection.'));
        }
      }

      let comparisonData: ComparisonJson | null = null;
      if (comparisonId) {
        try {
          comparisonData = await fetchComparison(comparisonId);
          setComparison(comparisonData);
        } catch {
          setMaterializeError('Could not load comparison text.');
        }
      }

      const chartPair = resolveViewerPeerChartIds(rel, profile.chartId);
      if (chartPair) {
        const [viewerRaw, peerRaw] = await Promise.all([
          fetchChartSnapshot(chartPair.viewerChartId),
          fetchChartSnapshot(chartPair.peerChartId),
        ]);
        setViewerSnapshot(mapSnapshotToWheel(viewerRaw ?? undefined));
        setPeerSnapshot(mapSnapshotToWheel(peerRaw ?? undefined));
      }

      const candidateExportId =
        (comparisonData?.exportJobId?.trim() && isValidExportId(comparisonData.exportJobId.trim())
          ? comparisonData.exportJobId.trim()
          : null) ?? null;

      if (candidateExportId) {
        setExportId(candidateExportId);
        const reachable = await checkExportAvailability(candidateExportId);
        setAudioAvailable(reachable);
      }
    } catch (err) {
      setError(formatApiError(err, 'Could not load connection'));
    } finally {
      setLoading(false);
    }
  }, [relationshipId, peerDisplayName, viewerDisplayName]);

  useEffect(() => {
    materializeOnceRef.current = false;
    void load();
  }, [load]);

  const generateAudio = useCallback(async () => {
    if (!relationshipId) return;
    setAudioGenerating(true);
    try {
      const newExportId = await generateConnectionAudio(relationshipId);
      setExportId(newExportId);
      setAudioAvailable(true);
      setComparison((prev) => (prev ? { ...prev, exportJobId: newExportId } : prev));
    } catch (err) {
      throw err;
    } finally {
      setAudioGenerating(false);
    }
  }, [relationshipId]);

  const { short, long, bullets } = parseCompatibilityText(comparison);

  return {
    relationship,
    comparison,
    readingShort: short,
    readingLong: long,
    sonicBullets: bullets,
    viewerSnapshot,
    peerSnapshot,
    viewerLabel,
    peerLabel,
    exportId,
    audioAvailable,
    audioGenerating,
    generateAudio,
    materializeError,
    loading,
    error,
    refresh: load,
  };
}
