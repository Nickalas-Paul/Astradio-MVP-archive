import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NatalWheel } from '../chart/NatalWheel';
import { SlotChipStrip } from './SlotChipStrip';
import { AUTH_HORIZONTAL_PADDING } from '../../constants/auth-styles';
import { colors } from '../../constants/colors';
import { mapSnapshotToWheel } from '../../lib/my-sky-mappers';
import { getSlotPopulationKind } from '../../lib/sandbox-slot-utils';
import type { EphemerisSnapshot } from '../../types/my-sky';
import {
  activeSlotNeedsEntryChooser,
  getJourneyTitle,
  setSlotEntryMode,
  useSandboxStore,
} from '../../store/sandbox';

function WheelPlaceholder({ size }: { size: number }) {
  return (
    <View style={[styles.wheelPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.wheelPlaceholderText}>Import or enter a chart to see the wheel.</Text>
    </View>
  );
}

export function SandboxWorkbench() {
  const { width } = useWindowDimensions();
  const wheelSize = Math.min(width - AUTH_HORIZONTAL_PADDING * 2, 360);

  const backToEntry = useSandboxStore((s) => s.backToEntry);
  const toggleDegreePanel = useSandboxStore((s) => s.toggleDegreePanel);
  const degreePanelOpen = useSandboxStore((s) => s.degreePanelOpen);
  const journeyType = useSandboxStore((s) => s.journeyType);
  const slots = useSandboxStore((s) => s.slots);
  const activeSlotIndex = useSandboxStore((s) => s.activeSlotIndex);
  const setActiveSlot = useSandboxStore((s) => s.setActiveSlot);
  const addSlot = useSandboxStore((s) => s.addSlot);
  const removeSlot = useSandboxStore((s) => s.removeSlot);
  const clearSlot = useSandboxStore((s) => s.clearSlot);

  const activeSlot = slots[activeSlotIndex];
  const showEntryChooser = activeSlotNeedsEntryChooser(activeSlot);
  const workbenchTitle = getJourneyTitle(journeyType);

  const wheelData = useMemo(() => {
    const snap = activeSlot?.snapshot;
    if (!snap) return null;
    const ephem: EphemerisSnapshot = {
      planets: snap.planets,
      houses: snap.houses,
      aspects: snap.aspects.map((a) => ({
        bodyA: a.bodyA,
        bodyB: a.bodyB,
        type: a.type,
        orb: a.orb,
      })),
    };
    return mapSnapshotToWheel(ephem);
  }, [activeSlot?.snapshot]);

  const canGenerate = activeSlot != null && getSlotPopulationKind(activeSlot) !== 'empty';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Pressable onPress={backToEntry} accessibilityRole="button">
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Pressable onPress={toggleDegreePanel} accessibilityRole="button">
            <Text style={[styles.degreeToggle, degreePanelOpen && styles.degreeToggleActive]}>
              Planet Degrees{degreePanelOpen ? ' ▾' : ' ▸'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.workbenchTitle}>Sandbox</Text>
          <Text style={styles.workbenchSubtitle}>{workbenchTitle}</Text>
        </View>

        <Text style={styles.slotMeta}>
          {slots.length} slot{slots.length === 1 ? '' : 's'} · editing slot {activeSlotIndex + 1}
        </Text>

        <SlotChipStrip
          slots={slots}
          activeSlotIndex={activeSlotIndex}
          onSelectSlot={setActiveSlot}
          onAddSlot={addSlot}
          onRemoveSlot={removeSlot}
          onClearSlot={clearSlot}
        />

        {degreePanelOpen ? (
          <View style={styles.degreePlaceholder}>
            <Text style={styles.degreePlaceholderText}>
              Planet degree editor — coming in the next update.
            </Text>
          </View>
        ) : null}

        <View style={styles.wheelSection}>
          <Text style={styles.sectionTitle}>Wheel</Text>
          {wheelData ? (
            <NatalWheel
              size={wheelSize}
              placements={wheelData.placements}
              aspects={wheelData.aspects}
              cusps={wheelData.cusps}
              ascendantLongitude={wheelData.ascendantLongitude}
            />
          ) : (
            <WheelPlaceholder size={wheelSize} />
          )}
          <Text style={styles.wheelHint}>
            Ephemeris preview for active slot {activeSlotIndex}. Positions here are not the resolved
            report or audio output.
          </Text>
        </View>

        {showEntryChooser ? (
          <View style={styles.entryChooser}>
            <Text style={styles.sectionTitle}>Start this slot</Text>
            <View style={styles.entryOptions}>
              <Pressable
                style={styles.entryOption}
                onPress={() => setSlotEntryMode(activeSlotIndex, 'chart_id')}
                accessibilityRole="button"
              >
                <Text style={styles.entryOptionTitle}>Import a chart</Text>
                <Text style={styles.entryOptionDesc}>Search for a saved chart</Text>
              </Pressable>
              <Pressable
                style={styles.entryOption}
                onPress={() => setSlotEntryMode(activeSlotIndex, 'birth_incomplete')}
                accessibilityRole="button"
              >
                <Text style={styles.entryOptionTitle}>Enter birth data</Text>
                <Text style={styles.entryOptionDesc}>Enter date, time & location</Text>
              </Pressable>
              <Pressable
                style={styles.entryOption}
                onPress={() => setSlotEntryMode(activeSlotIndex, 'blank_canvas')}
                accessibilityRole="button"
              >
                <Text style={styles.entryOptionTitle}>Blank canvas</Text>
                <Text style={styles.entryOptionDesc}>Start with an empty wheel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.resolveSection}>
          <Text style={styles.sectionTitle}>Resolve composition</Text>
          <Pressable
            style={[styles.generateButton, !canGenerate && styles.generateButtonDisabled]}
            disabled={!canGenerate}
            accessibilityRole="button"
          >
            <Text style={styles.generateButtonText}>Generate</Text>
          </Pressable>
          {!canGenerate ? (
            <Text style={styles.generateHint}>Populate a chart to generate</Text>
          ) : null}
        </View>
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
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
  degreeToggle: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
  degreeToggleActive: {
    color: colors.accent.DEFAULT,
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: 8,
  },
  workbenchTitle: {
    color: colors.text.primary,
    fontSize: 32,
    fontFamily: 'Cormorant-Bold',
    marginBottom: 6,
  },
  workbenchSubtitle: {
    color: colors.text.secondary,
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
  },
  slotMeta: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    marginBottom: 10,
  },
  degreePlaceholder: {
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  degreePlaceholderText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
  },
  wheelSection: {
    marginTop: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  sectionTitle: {
    alignSelf: 'stretch',
    color: colors.text.primary,
    fontSize: 18,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 12,
  },
  wheelHint: {
    marginTop: 12,
    color: colors.text.secondary,
    fontSize: 11,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    lineHeight: 16,
  },
  wheelPlaceholder: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  wheelPlaceholderText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  entryChooser: {
    marginBottom: 20,
  },
  entryOptions: {
    gap: 10,
  },
  entryOption: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    minHeight: 72,
  },
  entryOptionTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 4,
  },
  entryOptionDesc: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  resolveSection: {
    borderTopWidth: 1,
    borderTopColor: `${colors.border}99`,
    paddingTop: 16,
  },
  generateButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 8,
  },
  generateButtonDisabled: {
    opacity: 0.45,
  },
  generateButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  generateHint: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
});
