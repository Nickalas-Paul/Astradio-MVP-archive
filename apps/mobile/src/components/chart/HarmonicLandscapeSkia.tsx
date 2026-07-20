import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Canvas,
  Circle,
  Fill,
  Group,
  Path,
  RadialGradient,
  Shader,
  Skia,
  vec,
  useClock,
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { colors } from '../../constants/colors';
import type { EphemerisSnapshot } from '../../types/my-sky';
import {
  buildShaderPlanetUniforms,
  mapAspectArcs,
  mapPlanetSources,
  planetCanvasPosition,
  type HarmonicAspectArc,
  type HarmonicPlanetSource,
} from './harmonic-mapping';

/**
 * SkSL fragment shader — 2D top-down cymatics field.
 * Mirrors web terrain wave math as a radial color heatmap.
 */
const TERRAIN_SKSL = `
uniform float2 uResolution;
uniform float uTime;
uniform float uAudioLevel;
uniform float2 uPlanetPos[10];
uniform float uPlanetFreqs[10];
uniform float uPlanetAmps[10];
uniform half3 uPlanetColors[10];
uniform float uHighlightIdx;

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / uResolution;
  float2 center = float2(0.5, 0.5);
  float r = distance(uv, center) * 2.0;

  float mask = smoothstep(1.0, 0.9, r);
  if (mask < 0.01) {
    return half4(0.054, 0.024, 0.094, 0.0);
  }

  float d = 0.0;
  for (int i = 0; i < 10; i++) {
    float dist = distance(uv, uPlanetPos[i]);
    float f = uPlanetFreqs[i];
    float a = uPlanetAmps[i];
    float hm = 1.0;
    if (uHighlightIdx >= 0.0) {
      hm = (abs(float(i) - uHighlightIdx) < 0.5) ? 2.2 : 0.05;
    }
    d += a * hm * sin(dist * f * 20.0 - uTime * (1.0 + float(i) * 0.13)) / (1.0 + dist * 4.0);
  }
  d *= mask * (0.35 + uAudioLevel * 0.65);

  float n = clamp((d + 0.9) / 1.8, 0.0, 1.0);
  half3 colLow = half3(0.055, 0.02, 0.125);
  half3 colMid = half3(0.165, 0.082, 0.251);
  half3 colHigh = half3(0.420, 0.227, 0.102);
  half3 colPeak = half3(0.769, 0.518, 0.114);

  half3 c;
  if (n < 0.3) {
    c = mix(colLow, colMid, n / 0.3);
  } else if (n < 0.65) {
    c = mix(colMid, colHigh, (n - 0.3) / 0.35);
  } else {
    c = mix(colHigh, colPeak, (n - 0.65) / 0.35);
  }

  for (int i = 0; i < 10; i++) {
    float dist = distance(uv, uPlanetPos[i]);
    float influence = smoothstep(0.15, 0.0, dist) * 0.35;
    c = mix(c, uPlanetColors[i] * 0.7, influence);
  }

  return half4(c * mask, mask * 0.95);
}
`;

const terrainEffect = Skia.RuntimeEffect.Make(TERRAIN_SKSL);

type HarmonicLandscapeSkiaProps = {
  size: number;
  snapshot: EphemerisSnapshot;
  /** Reserved for future FFT matching (expo-audio has no AnalyserNode yet). */
  linkedExportId?: string | null;
};

type AspectBezier = {
  arc: HarmonicAspectArc;
  ax: number;
  ay: number;
  cx: number;
  cy: number;
  bx: number;
  by: number;
};

function formatDegree(degree: number): string {
  const whole = Math.floor(degree);
  const minutes = Math.round((degree - whole) * 60);
  return `${whole}°${String(minutes).padStart(2, '0')}'`;
}

function formatOrb(orb: number): string {
  return `${Math.round(orb)}°`;
}

function capitalizeAspectType(type: string): string {
  const t = type.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function buildAspectBeziers(
  size: number,
  sources: HarmonicPlanetSource[],
  arcs: HarmonicAspectArc[],
): AspectBezier[] {
  return arcs.flatMap((arc) => {
    const from = sources[arc.fromIdx];
    const to = sources[arc.toIdx];
    if (!from || !to) return [];
    const a = planetCanvasPosition(from);
    const b = planetCanvasPosition(to);
    const ax = a.x * size;
    const ay = a.y * size;
    const bx = b.x * size;
    const by = b.y * size;
    const midX = (ax + bx) / 2;
    const midY = (ay + by) / 2;
    const cx = size / 2 + (midX - size / 2) * 0.8;
    const cy = size / 2 + (midY - size / 2) * 0.8;
    return [{ arc, ax, ay, cx, cy, bx, by }];
  });
}

function StaticTerrainFallback({ size }: { size: number }) {
  const cx = size / 2;
  const radius = size * 0.48;
  return (
    <Canvas style={{ width: size, height: size }}>
      <Circle cx={cx} cy={cx} r={radius}>
        <RadialGradient
          c={vec(cx, cx)}
          r={radius}
          colors={['#2a1540', '#0e0520', '#0d0618']}
        />
      </Circle>
    </Canvas>
  );
}

function PlanetOrbs({
  size,
  sources,
  highlightIndex,
  highlightedPlanetIndices,
}: {
  size: number;
  sources: HarmonicPlanetSource[];
  highlightIndex: number;
  highlightedPlanetIndices: number[];
}) {
  const aspectHighlightActive = highlightedPlanetIndices.length > 0;
  return (
    <Group>
      {sources.map((source) => {
        const pos = planetCanvasPosition(source);
        const x = pos.x * size;
        const y = pos.y * size;
        const aspectHighlighted = highlightedPlanetIndices.includes(source.index);
        const selected = highlightIndex === source.index || aspectHighlighted;
        const dimmed =
          (highlightIndex >= 0 && highlightIndex !== source.index) ||
          (aspectHighlightActive && !aspectHighlighted);
        const base =
          source.key === 'sun' ? 8 : source.key === 'moon' ? 6 : 4;
        const orbSize = selected ? base * (aspectHighlighted ? 1.2 : 1.35) : base;
        const opacity = dimmed ? 0.3 : 1;
        return (
          <Group key={source.key} opacity={opacity}>
            <Circle cx={x} cy={y} r={orbSize * 2.5} color={source.color} opacity={0.3} />
            <Circle cx={x} cy={y} r={orbSize} color={source.color} />
            <Circle cx={x} cy={y} r={orbSize * 0.5} color="#ffffff" />
          </Group>
        );
      })}
    </Group>
  );
}

function AspectPaths({
  beziers,
  selectedIndex,
  selectedAspectKey,
}: {
  beziers: AspectBezier[];
  selectedIndex: number;
  selectedAspectKey: string | null;
}) {
  const paths = useMemo(() => {
    return beziers.map(({ arc, ax, ay, cx, cy, bx, by }) => {
      const path = Skia.Path.Make();
      path.moveTo(ax, ay);
      path.quadTo(cx, cy, bx, by);
      return { key: arc.key, path, color: arc.color, arc };
    });
  }, [beziers]);

  const selectionActive = selectedIndex >= 0 || selectedAspectKey !== null;

  return (
    <Group>
      {paths.map((item) => {
        const highlighted = selectedAspectKey === item.key;
        const incident =
          selectedIndex >= 0 &&
          (item.arc.fromIdx === selectedIndex || item.arc.toIdx === selectedIndex);
        const active = highlighted || incident;
        const opacity = !selectionActive ? 0.25 : active ? (highlighted ? 0.9 : 0.7) : 0.05;
        const strokeWidth = highlighted ? 2.5 : active ? 1.75 : 1;
        return (
          <Path
            key={item.key}
            path={item.path}
            color={item.color}
            style="stroke"
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        );
      })}
    </Group>
  );
}

/**
 * Known gap: expo-audio does not expose FFT / AnalyserNode.
 * Use breathing sine until a future PR wires real audio energy.
 */
function useBreathingAudioLevel(clockMs: { value: number }) {
  return useDerivedValue(() => {
    const t = clockMs.value / 1000;
    return 0.5 + Math.sin(t * 0.5) * 0.2;
  });
}

export function HarmonicLandscapeSkia({
  size,
  snapshot,
}: HarmonicLandscapeSkiaProps) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedAspectKey, setSelectedAspectKey] = useState<string | null>(null);
  const sources = useMemo(() => mapPlanetSources(snapshot), [snapshot]);
  const arcs = useMemo(() => mapAspectArcs(snapshot, sources), [snapshot, sources]);
  const beziers = useMemo(
    () => buildAspectBeziers(size, sources, arcs),
    [arcs, size, sources],
  );
  const planetUniforms = useMemo(() => buildShaderPlanetUniforms(sources), [sources]);
  const clock = useClock();
  const audioLevel = useBreathingAudioLevel(clock);
  const selected = selectedIndex >= 0 ? sources[selectedIndex] : null;
  const selectedAspect =
    selectedAspectKey !== null
      ? arcs.find((arc) => arc.key === selectedAspectKey) ?? null
      : null;
  const highlightedPlanetIndices = useMemo(() => {
    if (!selectedAspect) return [] as number[];
    return [selectedAspect.fromIdx, selectedAspect.toIdx];
  }, [selectedAspect]);
  const incidentArcs = useMemo(() => {
    if (selectedIndex < 0) return [] as HarmonicAspectArc[];
    return arcs.filter(
      (arc) => arc.fromIdx === selectedIndex || arc.toIdx === selectedIndex,
    );
  }, [arcs, selectedIndex]);

  const uniforms = useDerivedValue(() => ({
    uResolution: [size, size],
    uTime: clock.value / 1000,
    uAudioLevel: audioLevel.value,
    uPlanetPos: planetUniforms.positions,
    uPlanetFreqs: planetUniforms.freqs,
    uPlanetAmps: planetUniforms.amps,
    uPlanetColors: planetUniforms.colors,
    uHighlightIdx: selectedIndex,
  }));

  const selectPlanet = useCallback((index: number) => {
    setSelectedAspectKey(null);
    setSelectedIndex((current) => (current === index ? -1 : index));
  }, []);

  const selectAspect = useCallback((key: string) => {
    setSelectedAspectKey((current) => (current === key ? null : key));
    setSelectedIndex(-1);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIndex(-1);
    setSelectedAspectKey(null);
  }, []);

  const handleCanvasPress = useCallback(
    (locationX: number, locationY: number) => {
      let bestIndex = -1;
      let bestDist = 28;
      for (const source of sources) {
        const pos = planetCanvasPosition(source);
        const dx = pos.x * size - locationX;
        const dy = pos.y * size - locationY;
        const dist = Math.hypot(dx, dy);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = source.index;
        }
      }
      if (bestIndex >= 0) {
        selectPlanet(bestIndex);
        return;
      }

      let bestArcDist = 20;
      let bestArcKey: string | null = null;
      for (const bezier of beziers) {
        for (let t = 0; t <= 1; t += 0.05) {
          const invT = 1 - t;
          const px =
            invT * invT * bezier.ax +
            2 * invT * t * bezier.cx +
            t * t * bezier.bx;
          const py =
            invT * invT * bezier.ay +
            2 * invT * t * bezier.cy +
            t * t * bezier.by;
          const dist = Math.hypot(locationX - px, locationY - py);
          if (dist < bestArcDist) {
            bestArcDist = dist;
            bestArcKey = bezier.arc.key;
          }
        }
      }

      if (bestArcKey !== null) {
        selectAspect(bestArcKey);
        return;
      }

      clearSelection();
    },
    [beziers, clearSelection, selectAspect, selectPlanet, size, sources],
  );

  return (
    <View style={[styles.root, { width: size }]}>
      <View style={[styles.canvasWrap, { width: size, height: size }]}>
        {terrainEffect ? (
          <Canvas style={{ width: size, height: size }}>
            <Fill>
              <Shader source={terrainEffect} uniforms={uniforms} />
            </Fill>
            <AspectPaths
              beziers={beziers}
              selectedIndex={selectedIndex}
              selectedAspectKey={selectedAspectKey}
            />
            <PlanetOrbs
              size={size}
              sources={sources}
              highlightIndex={selectedIndex}
              highlightedPlanetIndices={highlightedPlanetIndices}
            />
          </Canvas>
        ) : (
          <>
            <StaticTerrainFallback size={size} />
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Canvas style={{ width: size, height: size }}>
                <AspectPaths
                  beziers={beziers}
                  selectedIndex={selectedIndex}
                  selectedAspectKey={selectedAspectKey}
                />
                <PlanetOrbs
                  size={size}
                  sources={sources}
                  highlightIndex={selectedIndex}
                  highlightedPlanetIndices={highlightedPlanetIndices}
                />
              </Canvas>
            </View>
          </>
        )}

        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={(event) => {
            handleCanvasPress(event.nativeEvent.locationX, event.nativeEvent.locationY);
          }}
          accessibilityLabel="Harmonic landscape"
        />
      </View>

      <View style={styles.pillRow}>
        {sources.map((source) => {
          const active = selectedIndex === source.index;
          return (
            <Pressable
              key={source.key}
              onPress={() => selectPlanet(source.index)}
              style={[styles.pill, active && styles.pillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={source.label}
            >
              <View style={[styles.pillDot, { backgroundColor: source.color }]} />
              <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>
                {source.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedAspect ? (
        <Pressable
          style={styles.infoCard}
          onPress={() => selectAspect(selectedAspect.key)}
          accessibilityRole="button"
          accessibilityLabel={`${selectedAspect.fromName} ${selectedAspect.type} ${selectedAspect.toName}`}
        >
          {sources[selectedAspect.fromIdx] ? (
            <View style={styles.aspectPlanetRow}>
              <View
                style={[
                  styles.pillDot,
                  { backgroundColor: sources[selectedAspect.fromIdx]!.color },
                ]}
              />
              <Text style={styles.infoBody}>
                <Text style={{ color: sources[selectedAspect.fromIdx]!.color }}>
                  {sources[selectedAspect.fromIdx]!.label}
                </Text>
                {` in ${sources[selectedAspect.fromIdx]!.sign} · ${Math.round(sources[selectedAspect.fromIdx]!.degreeInSign)}°`}
              </Text>
            </View>
          ) : null}
          <Text style={styles.aspectTypeLabel}>
            {capitalizeAspectType(selectedAspect.type)}
          </Text>
          {sources[selectedAspect.toIdx] ? (
            <View style={styles.aspectPlanetRow}>
              <View
                style={[
                  styles.pillDot,
                  { backgroundColor: sources[selectedAspect.toIdx]!.color },
                ]}
              />
              <Text style={styles.infoBody}>
                <Text style={{ color: sources[selectedAspect.toIdx]!.color }}>
                  {sources[selectedAspect.toIdx]!.label}
                </Text>
                {` in ${sources[selectedAspect.toIdx]!.sign} · ${Math.round(sources[selectedAspect.toIdx]!.degreeInSign)}°`}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.infoMuted, { marginTop: 8 }]}>
            Orb: {formatOrb(selectedAspect.orb)}
          </Text>
        </Pressable>
      ) : selected ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{selected.label}</Text>
          <Text style={styles.infoBody}>
            {selected.sign} {formatDegree(selected.degreeInSign)}
          </Text>
          <Text style={styles.infoMuted}>{selected.voice}</Text>
          {incidentArcs.length > 0 ? (
            <View style={styles.aspectList}>
              <Text style={styles.aspectListLabel}>Aspects</Text>
              {incidentArcs.map((arc) => {
                const otherIdx =
                  arc.fromIdx === selectedIndex ? arc.toIdx : arc.fromIdx;
                const other = sources[otherIdx];
                const otherLabel = other
                  ? `${other.label} in ${other.sign}`
                  : arc.fromIdx === selectedIndex
                    ? arc.toName
                    : arc.fromName;
                return (
                  <Pressable
                    key={arc.key}
                    onPress={() => selectAspect(arc.key)}
                    style={styles.aspectRow}
                    accessibilityRole="button"
                    accessibilityLabel={`${capitalizeAspectType(arc.type)} ${otherLabel}`}
                  >
                    <Text style={styles.aspectRowText}>
                      {capitalizeAspectType(arc.type)} {otherLabel}
                      <Text style={styles.aspectOrb}> · {formatOrb(arc.orb)}</Text>
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.hint}>Tap a planet or aspect line</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  canvasWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0d0618',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillActive: {
    borderColor: colors.accent.DEFAULT,
    backgroundColor: 'rgba(14,150,150,0.18)',
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pillText: {
    color: colors.text.secondary,
    fontSize: 11,
    fontFamily: 'Manrope-Regular',
  },
  pillTextActive: {
    color: colors.text.primary,
  },
  infoCard: {
    marginTop: 12,
    width: '100%',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  infoTitle: {
    color: '#e8c56d',
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  infoBody: {
    marginTop: 4,
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
  infoMuted: {
    marginTop: 2,
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  aspectPlanetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  aspectTypeLabel: {
    marginTop: 8,
    marginBottom: 6,
    color: '#e8c56d',
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  aspectList: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  aspectListLabel: {
    color: colors.text.muted,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: 'Manrope-Regular',
    marginBottom: 4,
  },
  aspectRow: {
    paddingVertical: 4,
  },
  aspectRowText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
  },
  aspectOrb: {
    color: colors.text.muted,
    fontWeight: '300',
  },
  hint: {
    marginTop: 10,
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
});
