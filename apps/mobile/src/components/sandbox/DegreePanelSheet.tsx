import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AUTH_HORIZONTAL_PADDING } from '../../constants/auth-styles';
import { colors } from '../../constants/colors';
import {
  BODY_DISPLAY_ORDER,
  BODY_LABELS,
  type SandboxPlanetKey,
} from '../../constants/sandbox-planets';
import { DEFAULT_FREE_BUILD_ASC_DEG } from '../../lib/sandbox-blank-canvas';
import {
  lonToSignDeg,
  roundSandboxDegree,
  signDegToLon,
  SIGN_NAMES,
} from '../../lib/sandbox-zodiac';
import { useSandboxPreviewSync } from '../../hooks/useSandboxPreviewSync';
import { useSandboxStore } from '../../store/sandbox';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function lonFromSnapshotPlanets(
  snapshot: unknown,
  body: string
): number | null {
  const snap = snapshot as { planets?: Array<{ name?: string; lon?: number }> } | null;
  const row = snap?.planets?.find((p) => p.name?.toLowerCase() === body.toLowerCase());
  return typeof row?.lon === 'number' && Number.isFinite(row.lon) ? row.lon : null;
}

function ascendantFromSlot(slot: {
  entryMode?: string;
  freeBuildAscDeg?: number;
  snapshot?: unknown;
}): number | null {
  if (slot.entryMode === 'blank_canvas') {
    return slot.freeBuildAscDeg ?? DEFAULT_FREE_BUILD_ASC_DEG;
  }
  const snap = slot.snapshot as { houses?: number[] } | undefined;
  if (snap?.houses?.length === 12) return snap.houses[0]!;
  return lonFromSnapshotPlanets(slot.snapshot, 'ascendant');
}

export function DegreePanelSheet({ visible, onClose }: Props) {
  const activeSlotIndex = useSandboxStore((s) => s.activeSlotIndex);
  const slot = useSandboxStore((s) => s.slots[s.activeSlotIndex]);
  const updateSlot = useSandboxStore((s) => s.updateSlot);
  const { handleOverrideChange, handleAscendantChange, handleResetPlanet } =
    useSandboxPreviewSync(activeSlotIndex);

  const isBlankCanvas = slot?.entryMode === 'blank_canvas';
  const resetLabel = isBlankCanvas ? 'Clear' : 'Restore';

  const basePositions = useMemo(() => {
    const out: Record<string, number> = {};
    const snap = slot?.snapshot as { planets?: Array<{ name?: string; lon?: number }> } | undefined;
    for (const p of snap?.planets ?? []) {
      if (p.name && typeof p.lon === 'number') out[p.name] = p.lon;
    }
    return out;
  }, [slot?.snapshot]);

  const ascLon = slot ? ascendantFromSlot(slot) : null;

  const onAscReset = useCallback(() => {
    if (!slot || !isBlankCanvas) return;
    updateSlot(activeSlotIndex, {
      freeBuildAscDeg: DEFAULT_FREE_BUILD_ASC_DEG,
    });
    handleAscendantChange(DEFAULT_FREE_BUILD_ASC_DEG);
  }, [activeSlotIndex, handleAscendantChange, isBlankCanvas, slot, updateSlot]);

  if (!slot) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Planet degrees</Text>
          <Text style={styles.hint}>Sign, degree (0–29), and minutes. Stored as longitude 0–360°.</Text>
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {ascLon != null ? (
              <PlanetRow
                label="Ascendant"
                lon={ascLon}
                editable={isBlankCanvas}
                resetLabel={resetLabel}
                showReset={isBlankCanvas && ascLon !== DEFAULT_FREE_BUILD_ASC_DEG}
                onChange={(lon) => handleAscendantChange(lon)}
                onReset={onAscReset}
              />
            ) : null}
            {BODY_DISPLAY_ORDER.map((body) => (
              <PlanetRow
                key={body}
                label={BODY_LABELS[body] ?? body}
                lon={slot.overrides?.[body]?.lon ?? basePositions[body] ?? 0}
                editable
                resetLabel={resetLabel}
                showReset={slot.overrides?.[body] != null}
                onChange={(lon) => handleOverrideChange(body as SandboxPlanetKey, lon)}
                onReset={() => handleResetPlanet(body as SandboxPlanetKey)}
              />
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PlanetRow({
  label,
  lon,
  editable,
  resetLabel,
  showReset,
  onChange,
  onReset,
}: {
  label: string;
  lon: number;
  editable: boolean;
  resetLabel: string;
  showReset?: boolean;
  onChange: (lon: number) => void;
  onReset: () => void;
}) {
  const parts = lonToSignDeg(lon);
  const [signIndex, setSignIndex] = useState(parts.signIdx);
  const [deg, setDeg] = useState(String(parts.deg));
  const [min, setMin] = useState(String(parts.min));
  const [signModalOpen, setSignModalOpen] = useState(false);

  React.useEffect(() => {
    const p = lonToSignDeg(lon);
    setSignIndex(p.signIdx);
    setDeg(String(p.deg));
    setMin(String(p.min));
  }, [lon]);

  const emit = (si: number, d: string, m: string) => {
    const lonOut = roundSandboxDegree(
      signDegToLon(si, Number(d) || 0, Number(m) || 0)
    );
    onChange(lonOut);
  };

  return (
    <View style={styles.row}>
      <Text style={styles.planetLabel}>{label}</Text>
      <View style={styles.inputs}>
        {editable ? (
          <>
            <Pressable style={styles.signBtn} onPress={() => setSignModalOpen(true)}>
              <Text style={styles.signBtnText}>{SIGN_NAMES[signIndex]}</Text>
            </Pressable>
            <TextInput
              style={styles.numInput}
              value={deg}
              onChangeText={(t) => {
                setDeg(t);
                emit(signIndex, t, min);
              }}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="°"
              placeholderTextColor={colors.text.muted}
            />
            <TextInput
              style={styles.numInput}
              value={min}
              onChangeText={(t) => {
                setMin(t);
                emit(signIndex, deg, t);
              }}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="'"
              placeholderTextColor={colors.text.muted}
            />
          </>
        ) : (
          <Text style={styles.readOnly}>
            {parts.sign} {parts.deg}°{String(parts.min).padStart(2, '0')}&apos;
          </Text>
        )}
        {editable && showReset ? (
          <Pressable onPress={onReset} hitSlop={8}>
            <Text style={styles.resetBtn}>{resetLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal visible={signModalOpen} transparent animationType="fade">
        <Pressable style={styles.signModalBackdrop} onPress={() => setSignModalOpen(false)}>
          <View style={styles.signModalSheet}>
            <ScrollView>
              {SIGN_NAMES.map((sign, i) => (
                <Pressable
                  key={sign}
                  style={styles.signOption}
                  onPress={() => {
                    setSignIndex(i);
                    emit(i, deg, min);
                    setSignModalOpen(false);
                  }}
                >
                  <Text style={styles.signOptionText}>{sign}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '60%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Cormorant-Bold',
    fontSize: 20,
    color: colors.text.primary,
    paddingHorizontal: AUTH_HORIZONTAL_PADDING,
    marginBottom: 4,
  },
  hint: {
    fontFamily: 'Manrope-Regular',
    fontSize: 11,
    color: colors.text.secondary,
    paddingHorizontal: AUTH_HORIZONTAL_PADDING,
    marginBottom: 8,
  },
  scroll: {
    paddingHorizontal: AUTH_HORIZONTAL_PADDING,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  planetLabel: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 6,
  },
  inputs: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  signBtn: {
    flex: 1,
    minWidth: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surfaceLight,
  },
  signBtnText: {
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
    color: colors.text.primary,
  },
  numInput: {
    width: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
    color: colors.text.primary,
    textAlign: 'center',
    backgroundColor: colors.surfaceLight,
  },
  readOnly: {
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
    color: colors.text.secondary,
    flex: 1,
  },
  resetBtn: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 13,
    color: colors.accent.DEFAULT,
  },
  signModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  signModalSheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  signOptionText: {
    fontFamily: 'Manrope-Regular',
    fontSize: 15,
    color: colors.text.primary,
  },
});
