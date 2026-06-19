import { create } from 'zustand';
import { SANDBOX_ENTRY_CARDS, SANDBOX_MAX_SLOTS } from '../constants/sandbox-entry-cards';
import {
  createEmptySlot,
  getSlotPopulationKind,
  parsePersistedSandboxSlots,
} from '../lib/sandbox-slot-utils';
import type {
  SavedCompositionDetail,
  SandboxJourneyType,
  SandboxSlot,
  SandboxSurfaceState,
  SlotEntryMode,
} from '../types/sandbox';

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
  resolveResult: unknown | null;
  exportJobId: string | null;
  canSave: boolean;

  selectJourney: (type: SandboxJourneyType) => void;
  continueWorkbench: () => void;
  backToEntry: () => void;
  setActiveSlot: (index: number) => void;
  addSlot: () => void;
  removeSlot: (index: number) => void;
  clearSlot: (index: number) => void;
  updateSlot: (index: number, data: Partial<SandboxSlot>) => void;
  toggleDegreePanel: () => void;
  setResolveResult: (result: unknown) => void;
  resetAll: () => void;
  loadComposition: (detail: SavedCompositionDetail) => void;
}

const initialState = {
  entryLayer: 'entry' as const,
  journeyType: null as SandboxJourneyType | null,
  slots: [createEmptySlot(0)],
  activeSlotIndex: 0,
  degreePanelOpen: false,
  surfaceState: 'ready_builder' as SandboxSurfaceState,
  resolveResult: null as unknown | null,
  exportJobId: null as string | null,
  canSave: false,
};

export const useSandboxStore = create<SandboxStore>((set, get) => ({
  ...initialState,

  selectJourney: (type) => {
    const slotCount = JOURNEY_SLOT_COUNT[type];
    const slots: SandboxSlot[] = Array.from({ length: slotCount }, (_, i) => createEmptySlot(i));

    if (type === 'whatif') {
      slots[0] = {
        index: 0,
        entryMode: 'blank_canvas',
        overrides: {},
      };
    }

    set({
      ...initialState,
      entryLayer: 'workbench',
      journeyType: type,
      slots,
      activeSlotIndex: 0,
      degreePanelOpen: defaultDegreePanelOpenForJourney(type),
      surfaceState: 'ready_builder',
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

  setResolveResult: (result) => {
    set({ resolveResult: result });
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
      resolveResult: hasReport ? detail.report : null,
      exportJobId: detail.export_id ?? null,
      canSave: false,
    });
  },
}));

export function getJourneyTitle(journeyType: SandboxJourneyType | null): string {
  if (!journeyType) return 'Sandbox';
  return SANDBOX_ENTRY_CARDS.find((c) => c.id === journeyType)?.title ?? 'Sandbox';
}

export function activeSlotNeedsEntryChooser(slot: SandboxSlot | undefined): boolean {
  if (!slot) return false;
  const kind = getSlotPopulationKind(slot);
  return kind === 'empty';
}

export function setSlotEntryMode(index: number, mode: SlotEntryMode): void {
  const store = useSandboxStore.getState();
  if (mode === 'blank_canvas') {
    store.updateSlot(index, { entryMode: 'blank_canvas', overrides: {} });
    useSandboxStore.setState({ degreePanelOpen: true });
  } else if (mode === 'birth_incomplete') {
    store.updateSlot(index, { entryMode: 'birth_incomplete' });
  } else if (mode === 'chart_id') {
    store.updateSlot(index, { entryMode: 'chart_id' });
  }
}
