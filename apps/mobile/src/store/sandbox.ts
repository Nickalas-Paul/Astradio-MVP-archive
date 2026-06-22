import { create } from 'zustand';
import { SANDBOX_ENTRY_CARDS, SANDBOX_MAX_SLOTS } from '../constants/sandbox-entry-cards';
import {
  buildBlankCanvasSnapshot,
  DEFAULT_FREE_BUILD_ASC_DEG,
} from '../lib/sandbox-blank-canvas';
import {
  createEmptySlot,
  getSlotPopulationKind,
  parsePersistedSandboxSlots,
} from '../lib/sandbox-slot-utils';
import type {
  SavedCompositionDetail,
  SandboxJourneyType,
  SandboxResolveReport,
  SandboxSlot,
  SandboxSurfaceState,
  SlotEntryMode,
} from '../types/sandbox';
import type { HistoricalPreset } from '../data/historical-presets';

const JOURNEY_SLOT_COUNT: Record<SandboxJourneyType, number> = {
  solo: 1,
  pair: 2,
  whatif: 1,
  group: 3,
};

function defaultDegreePanelOpenForJourney(mode: SandboxJourneyType): boolean {
  return mode === 'whatif';
}

function reindexSlots(slots: SandboxSlot[]): SandboxSlot[] {
  return slots.map((slot, index) => ({ ...slot, index }));
}

export interface SandboxStore {
  entryLayer: 'entry' | 'workbench';
  journeyType: SandboxJourneyType | null;
  slots: SandboxSlot[];
  activeSlotIndex: number;
  degreePanelOpen: boolean;
  surfaceState: SandboxSurfaceState;
  resolveResult: SandboxResolveReport | null;
  exportJobId: string | null;
  canSave: boolean;
  planHash: string | null;
  combinedHash: string | null;
  canonicalObjectHash: string | null;
  lastResolveBody: Record<string, unknown> | null;
  errorMessage: string | null;
  savedThisSession: boolean;
  saveLoading: boolean;
  generateLoading: boolean;
  audioLoading: boolean;
  pendingHistoricalPreset: HistoricalPreset | null;

  selectJourney: (type: SandboxJourneyType, options?: { historicalPreset?: HistoricalPreset }) => void;
  continueWorkbench: () => void;
  backToEntry: () => void;
  setActiveSlot: (index: number) => void;
  addSlot: () => void;
  removeSlot: (index: number) => void;
  clearSlot: (index: number) => void;
  updateSlot: (index: number, data: Partial<SandboxSlot>) => void;
  toggleDegreePanel: () => void;
  setResolveSession: (payload: {
    report: SandboxResolveReport;
    planHash: string;
    combinedHash: string;
    canonicalObjectHash: string | null;
    exportJobId: string | null;
    lastResolveBody: Record<string, unknown>;
  }) => void;
  setExportJobId: (id: string | null) => void;
  setSurfaceState: (state: SandboxSurfaceState) => void;
  setErrorMessage: (message: string | null) => void;
  setSaveLoading: (loading: boolean) => void;
  setGenerateLoading: (loading: boolean) => void;
  setAudioLoading: (loading: boolean) => void;
  markSaved: () => void;
  resetWorkbenchError: () => void;
  resetAll: () => void;
  loadComposition: (detail: SavedCompositionDetail) => void;
}

const sessionInitial = {
  surfaceState: 'ready_builder' as SandboxSurfaceState,
  resolveResult: null as SandboxResolveReport | null,
  exportJobId: null as string | null,
  canSave: false,
  planHash: null as string | null,
  combinedHash: null as string | null,
  canonicalObjectHash: null as string | null,
  lastResolveBody: null as Record<string, unknown> | null,
  errorMessage: null as string | null,
  savedThisSession: false,
  saveLoading: false,
  generateLoading: false,
  audioLoading: false,
  pendingHistoricalPreset: null as HistoricalPreset | null,
};

const initialState = {
  entryLayer: 'entry' as const,
  journeyType: null as SandboxJourneyType | null,
  slots: [createEmptySlot(0)],
  activeSlotIndex: 0,
  degreePanelOpen: false,
  ...sessionInitial,
};

export const useSandboxStore = create<SandboxStore>((set, get) => ({
  ...initialState,

  selectJourney: (type, options) => {
    const slotCount = JOURNEY_SLOT_COUNT[type];
    const slots: SandboxSlot[] = Array.from({ length: slotCount }, (_, i) => createEmptySlot(i));

    if (type === 'whatif') {
      const asc = DEFAULT_FREE_BUILD_ASC_DEG;
      slots[0] = {
        index: 0,
        entryMode: 'blank_canvas',
        overrides: {},
        freeBuildAscDeg: asc,
        snapshot: buildBlankCanvasSnapshot({}, asc),
      };
    }

    set({
      ...initialState,
      entryLayer: 'workbench',
      journeyType: type,
      slots,
      activeSlotIndex: 0,
      degreePanelOpen: defaultDegreePanelOpenForJourney(type),
      pendingHistoricalPreset: options?.historicalPreset ?? null,
    });
  },

  continueWorkbench: () => {
    set({ entryLayer: 'workbench' });
  },

  backToEntry: () => {
    set({ entryLayer: 'entry' });
  },

  setActiveSlot: (index) => {
    const { slots } = get();
    if (index < 0 || index >= slots.length) return;
    set({ activeSlotIndex: index });
  },

  addSlot: () => {
    const { slots } = get();
    if (slots.length >= SANDBOX_MAX_SLOTS) return;
    const next = reindexSlots([...slots, createEmptySlot(slots.length)]);
    set({ slots: next });
  },

  removeSlot: (index) => {
    const { slots, activeSlotIndex } = get();
    if (slots.length <= 1) return;
    const next = reindexSlots(slots.filter((_, i) => i !== index));
    let nextActive = activeSlotIndex;
    if (index === activeSlotIndex) nextActive = Math.min(index, next.length - 1);
    else if (index < activeSlotIndex) nextActive = activeSlotIndex - 1;
    set({ slots: next, activeSlotIndex: nextActive });
  },

  clearSlot: (index) => {
    const { slots } = get();
    if (index < 0 || index >= slots.length) return;
    const next = [...slots];
    next[index] = createEmptySlot(index);
    set({ slots: reindexSlots(next) });
  },

  updateSlot: (index, data) => {
    const { slots } = get();
    if (index < 0 || index >= slots.length) return;
    const next = [...slots];
    next[index] = { ...next[index]!, ...data, index };
    set({ slots: next });
  },

  toggleDegreePanel: () => {
    set((state) => ({ degreePanelOpen: !state.degreePanelOpen }));
  },

  setResolveSession: (payload) => {
    set({
      resolveResult: payload.report,
      planHash: payload.planHash,
      combinedHash: payload.combinedHash,
      canonicalObjectHash: payload.canonicalObjectHash,
      exportJobId: payload.exportJobId,
      lastResolveBody: payload.lastResolveBody,
      canSave: true,
      savedThisSession: false,
      surfaceState: 'ready_report',
      errorMessage: null,
    });
  },

  setExportJobId: (id) => {
    set({ exportJobId: id });
  },

  setSurfaceState: (state) => {
    set({ surfaceState: state });
  },

  setErrorMessage: (message) => {
    set({ errorMessage: message });
  },

  setSaveLoading: (loading) => {
    set({ saveLoading: loading });
  },

  setGenerateLoading: (loading) => {
    set({ generateLoading: loading });
  },

  setAudioLoading: (loading) => {
    set({ audioLoading: loading });
  },

  markSaved: () => {
    set({ savedThisSession: true, canSave: false });
  },

  resetWorkbenchError: () => {
    set({
      surfaceState: 'ready_builder',
      errorMessage: null,
      resolveResult: null,
      canSave: false,
      planHash: null,
      combinedHash: null,
      canonicalObjectHash: null,
      lastResolveBody: null,
      exportJobId: null,
      savedThisSession: false,
    });
  },

  resetAll: () => {
    set({ ...initialState, slots: [createEmptySlot(0)] });
  },

  loadComposition: (detail) => {
    const { slots, activeSlotIndex } = parsePersistedSandboxSlots(detail.sandbox_state);
    const hasReport = detail.report != null && detail.plan_hash;
    set({
      entryLayer: 'workbench',
      journeyType: null,
      slots,
      activeSlotIndex,
      degreePanelOpen: slots.some((s) => s.entryMode === 'blank_canvas'),
      surfaceState: hasReport ? 'ready_report' : 'ready_builder',
      resolveResult: hasReport ? (detail.report as SandboxResolveReport) : null,
      exportJobId: detail.export_id ?? null,
      canSave: false,
      planHash: hasReport ? detail.plan_hash : null,
      combinedHash: detail.vector_hash ?? detail.seed ?? null,
      canonicalObjectHash: detail.object_identity_hash ?? null,
      lastResolveBody: null,
      savedThisSession: true,
      errorMessage: null,
    });
  },
}));

export function getJourneyTitle(journeyType: SandboxJourneyType | null): string {
  if (!journeyType) return 'Sandbox';
  return SANDBOX_ENTRY_CARDS.find((c) => c.id === journeyType)?.title ?? 'Sandbox';
}

export function activeSlotNeedsEntryChooser(slot: SandboxSlot | undefined): boolean {
  if (!slot) return false;
  return getSlotPopulationKind(slot) === 'empty' && slot.entryMode === 'empty';
}

export function activeSlotShowsImport(slot: SandboxSlot | undefined): boolean {
  if (!slot) return false;
  return slot.entryMode === 'chart_id' && !slot.chartId;
}

export function activeSlotShowsBirthForm(slot: SandboxSlot | undefined): boolean {
  if (!slot) return false;
  return slot.entryMode === 'birth_incomplete' && !slot.birth;
}

export function setSlotEntryMode(index: number, mode: SlotEntryMode): void {
  const store = useSandboxStore.getState();
  if (mode === 'blank_canvas') {
    const asc = DEFAULT_FREE_BUILD_ASC_DEG;
    store.updateSlot(index, {
      entryMode: 'blank_canvas',
      overrides: {},
      freeBuildAscDeg: asc,
      snapshot: buildBlankCanvasSnapshot({}, asc),
    });
    useSandboxStore.setState({ degreePanelOpen: true });
  } else if (mode === 'birth_incomplete') {
    store.updateSlot(index, { entryMode: 'birth_incomplete' });
  } else if (mode === 'chart_id') {
    store.updateSlot(index, { entryMode: 'chart_id' });
  }
}
