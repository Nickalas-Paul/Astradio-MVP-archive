import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NatalWheel } from '../chart/NatalWheel';
import { BirthDataForm } from './BirthDataForm';
import { ChartImportSearch } from './ChartImportSearch';
import { DegreePanelSheet } from './DegreePanelSheet';
import { SandboxAudioPlayer } from './SandboxAudioPlayer';
import { SandboxReportDisplay } from './SandboxReportDisplay';
import { SlotChipStrip } from './SlotChipStrip';
import { layout } from '../../constants/layout';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { useSandboxData } from '../../hooks/useSandboxData';
import { useSandboxGenerate } from '../../hooks/useSandboxGenerate';
import { mapSandboxSlotToWheel } from '../../lib/sandbox-slot-utils';
import {
  activeSlotNeedsEntryChooser,
  activeSlotShowsBirthForm,
  activeSlotShowsImport,
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
  const wheelSize = width - layout.screenPadding * 2;

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
  const updateSlot = useSandboxStore((s) => s.updateSlot);
  const surfaceState = useSandboxStore((s) => s.surfaceState);
  const resolveResult = useSandboxStore((s) => s.resolveResult);
  const errorMessage = useSandboxStore((s) => s.errorMessage);
  const resetWorkbenchError = useSandboxStore((s) => s.resetWorkbenchError);

  const { refresh } = useSandboxData();
  const {
    canGenerate,
    generateLoading,
    saveLoading,
    audioLoading,
    canSave,
    savedThisSession,
    exportJobId,
    handleGenerate,
    handleSave,
    handleGenerateAudio,
  } = useSandboxGenerate(() => void refresh());

  const activeSlot = slots[activeSlotIndex];
  const showEntryChooser = activeSlotNeedsEntryChooser(activeSlot);
  const showImport = activeSlotShowsImport(activeSlot);
  const showBirthForm = activeSlotShowsBirthForm(activeSlot);
  const workbenchTitle = getJourneyTitle(journeyType);

  const wheelData = useMemo(() => mapSandboxSlotToWheel(activeSlot), [activeSlot]);

  const cancelImport = () => updateSlot(activeSlotIndex, { entryMode: 'empty' });
  const cancelBirth = () => updateSlot(activeSlotIndex, { entryMode: 'empty' });

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

        {showImport ? (
          <ChartImportSearch slotIndex={activeSlotIndex} onCancel={cancelImport} />
        ) : null}

        {showBirthForm ? (
          <BirthDataForm slotIndex={activeSlotIndex} onCancel={cancelBirth} />
        ) : null}

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
            Ephemeris preview for active slot {activeSlotIndex + 1}. Positions here are not the
            resolved report or audio output.
          </Text>
        </View>

        {surfaceState === 'loading_base' || generateLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accent.DEFAULT} />
            <Text style={styles.loadingText}>Composing reading…</Text>
          </View>
        ) : null}

        {surfaceState === 'ready_report' && resolveResult ? (
          <>
            <SandboxReportDisplay report={resolveResult} />
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.secondaryButton, (!canSave || saveLoading) && styles.buttonDisabled]}
                disabled={!canSave || saveLoading}
                onPress={() => void handleSave()}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>
                  {savedThisSession ? 'Saved' : saveLoading ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, audioLoading && styles.buttonDisabled]}
                disabled={audioLoading}
                onPress={() => void handleGenerateAudio()}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>
                  {audioLoading ? 'Composing audio…' : 'Hear this Soundtrack'}
                </Text>
              </Pressable>
            </View>
            {exportJobId ? <SandboxAudioPlayer exportId={exportJobId} /> : null}
          </>
        ) : null}

        {surfaceState === 'error' && errorMessage ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable onPress={resetWorkbenchError} accessibilityRole="button">
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.resolveSection}>
          <Text style={styles.sectionTitle}>Resolve composition</Text>
          <Pressable
            style={[styles.generateButton, (!canGenerate || generateLoading) && styles.generateButtonDisabled]}
            disabled={!canGenerate || generateLoading}
            onPress={() => void handleGenerate()}
            accessibilityRole="button"
          >
            <Text style={styles.generateButtonText}>Compose</Text>
          </Pressable>
          {!canGenerate ? (
            <Text style={styles.generateHint}>Populate a chart to compose</Text>
          ) : null}
        </View>
      </ScrollView>

      <DegreePanelSheet visible={degreePanelOpen} onClose={toggleDegreePanel} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 40,
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
    ...typography.screenTitle,
    color: colors.text.primary,
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
    marginBottom: layout.cardGap,
  },
  wheelSection: {
    marginTop: 16,
    marginBottom: layout.sectionGap,
    alignItems: 'center',
  },
  sectionTitle: {
    alignSelf: 'stretch',
    color: colors.accent.DEFAULT,
    fontSize: 16,
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
    marginBottom: layout.sectionGap,
  },
  entryOptions: {
    gap: layout.cardGap,
  },
  entryOption: {
    backgroundColor: layout.card.backgroundColor,
    borderWidth: layout.card.borderWidth,
    borderColor: layout.card.borderColor,
    borderRadius: layout.card.borderRadius,
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
  loadingWrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
  },
  actionRow: {
    gap: 10,
    marginBottom: 8,
  },
  secondaryButton: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  errorWrap: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${colors.error}55`,
    backgroundColor: `${colors.error}10`,
    gap: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
  },
  resetText: {
    color: colors.accent.DEFAULT,
    fontSize: 13,
    fontFamily: 'Manrope-SemiBold',
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
