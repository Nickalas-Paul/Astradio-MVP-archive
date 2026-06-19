import { useCallback, useEffect, useRef } from 'react';
import { buildBlankCanvasSnapshot, dailyTransitBirthForBlankCanvas } from '../lib/sandbox-blank-canvas';
import { overridesToWire, birthToWire } from '../lib/sandbox-resolve';
import { postSnapshot } from '../lib/sandbox-fetch';
import { snapshotFromEphemeris } from '../lib/sandbox-slot-utils';
import { roundSandboxDegree } from '../lib/sandbox-zodiac';
import { useSandboxStore } from '../store/sandbox';
import type { SandboxSlot } from '../types/sandbox';

function birthWireFromSlot(slot: SandboxSlot) {
  return birthToWire(slot);
}

export function useSandboxPreviewSync(activeSlotIndex: number) {
  const updateSlot = useSandboxStore((s) => s.updateSlot);
  const slots = useSandboxStore((s) => s.slots);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  const activeSlot = slots[activeSlotIndex];

  const syncSnapshot = useCallback(
    async (slot: SandboxSlot, overrides: Record<string, { lon: number }>) => {
      const seq = ++seqRef.current;
      const birth = birthWireFromSlot(slot);
      const isBlank = slot.entryMode === 'blank_canvas';

      if (isBlank && !birth) {
        const snap = buildBlankCanvasSnapshot(overrides, slot.freeBuildAscDeg ?? 0);
        if (seq !== seqRef.current) return;
        updateSlot(slot.index, { snapshot: snap });
        return;
      }

      if (!birth && slot.chartId) return;

      if (!birth) return;

      try {
        const res = await postSnapshot(birth, overridesToWire(overrides));
        if (seq !== seqRef.current) return;
        const snap = snapshotFromEphemeris(res.snapshot);
        if (snap) {
          updateSlot(slot.index, {
            snapshot: snap,
            baseSnapshot: slot.baseSnapshot ?? snap,
          });
        }
      } catch {
        /* preview errors surface on explicit submit */
      }
    },
    [updateSlot]
  );

  const handleOverrideChange = useCallback(
    (planet: string, lonDeg: number | null) => {
      const slot = useSandboxStore.getState().slots[activeSlotIndex];
      if (!slot) return;
      const prev = slot.overrides ?? {};
      const next = { ...prev };
      if (lonDeg === null) delete next[planet];
      else next[planet] = { lon: roundSandboxDegree(lonDeg) };

      if (slot.entryMode === 'blank_canvas' && Object.keys(next).length === 0) {
        updateSlot(activeSlotIndex, {
          overrides: next,
          snapshot: buildBlankCanvasSnapshot({}, slot.freeBuildAscDeg ?? 0),
        });
        return;
      }

      updateSlot(activeSlotIndex, { overrides: next });

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        void syncSnapshot({ ...slot, overrides: next }, next);
      }, 300);
    },
    [activeSlotIndex, syncSnapshot, updateSlot]
  );

  const handleAscendantChange = useCallback(
    (lonDeg: number) => {
      const slot = useSandboxStore.getState().slots[activeSlotIndex];
      if (!slot || slot.entryMode !== 'blank_canvas') return;
      const asc = roundSandboxDegree(lonDeg);
      const overrides = slot.overrides ?? {};
      updateSlot(activeSlotIndex, { freeBuildAscDeg: asc });
      const snap = buildBlankCanvasSnapshot(overrides, asc);
      updateSlot(activeSlotIndex, { freeBuildAscDeg: asc, snapshot: snap });
    },
    [activeSlotIndex, updateSlot]
  );

  const handleResetPlanet = useCallback(
    (planet: string) => {
      handleOverrideChange(planet, null);
    },
    [handleOverrideChange]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeSlot) return;
    if (activeSlot.entryMode === 'blank_canvas' && !activeSlot.snapshot) {
      updateSlot(activeSlot.index, {
        snapshot: buildBlankCanvasSnapshot(
          activeSlot.overrides ?? {},
          activeSlot.freeBuildAscDeg ?? 0
        ),
      });
    }
  }, [activeSlot, updateSlot]);

  return {
    handleOverrideChange,
    handleAscendantChange,
    handleResetPlanet,
    dailyTransitBirthForBlankCanvas,
  };
}
