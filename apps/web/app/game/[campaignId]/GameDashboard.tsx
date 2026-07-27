'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { useGameState } from '@/hooks/useGameState';
import { useGameEncounter } from '@/hooks/useGameEncounter';
import { useGameInventory } from '@/hooks/useGameInventory';
import { useGameCharacter } from '@/hooks/useGameCharacter';
import { getClassDisplay } from '@/lib/class-display';
import {
  combatFromStoredResolution,
  resolveEncounter,
  GameApiError,
  type CombatResolutionPayload,
  type InventoryBagItem,
} from '@/lib/game-api';
import { AmbientBackdrop } from './components/AmbientBackdrop';
import { DungeonLayout } from './components/DungeonLayout';
import { HudRail } from './components/HudRail';
import { CharacterDrawer, type DrawerTab } from './components/CharacterDrawer';
import { EncounterCard } from './components/EncounterCard';
import { ChoicePanel } from './components/ChoicePanel';
import { DieRollWidget } from './components/DieRollWidget';
import { OutcomePanel } from './components/OutcomePanel';
import { ConsumableQuickUse } from './components/ConsumableQuickUse';
import { RevealHint } from './components/RevealHint';
import { ChapterTransition } from './components/ChapterTransition';

/** encounter → rolling → result → post-resolve */
type Phase = 'encounter' | 'rolling' | 'result' | 'post-resolve';

type ChapterEvent = {
  oldChapter: { house: number; domain: string; label: string };
  newChapter: { house: number; domain: string; label: string };
  relicReward: {
    name: string;
    description: string;
    rarity?: string;
    statModifiers?: Record<string, number>;
  } | null;
};

export function GameDashboard({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, loading: stateLoading, error: stateError, refresh: refreshState, setState } =
    useGameState(campaignId);
  const {
    encounter,
    resolveMeta,
    loading: encLoading,
    composing,
    error: encError,
    refresh: refreshEncounter,
    setEncounter,
  } = useGameEncounter(campaignId);
  const inventory = useGameInventory(campaignId);
  const {
    character,
    loading: characterLoading,
    error: characterError,
  } = useGameCharacter(campaignId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('encounter');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [combat, setCombat] = useState<CombatResolutionPayload | null>(null);
  const [narration, setNarration] = useState('');
  const [previousHp, setPreviousHp] = useState<number | undefined>();
  const [milestoneMessages, setMilestoneMessages] = useState<string[]>([]);
  const [chapterEvent, setChapterEvent] = useState<ChapterEvent | null>(null);
  const [showChapter, setShowChapter] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('character');
  const [preCombatUsed, setPreCombatUsed] = useState(false);
  const [usingConsumable, setUsingConsumable] = useState(false);

  useEffect(() => {
    const panel = searchParams.get('panel');
    if (panel === 'character' || panel === 'inventory' || panel === 'loot') {
      setDrawerTab(panel);
      setDrawerOpen(true);
    }
  }, [searchParams]);

  // Hydrate a previously resolved day. Never interrupt an in-progress roll.
  useEffect(() => {
    if (!encounter?.resolved || combat) return;
    if (phase === 'rolling' || phase === 'result') return;

    const stored = encounter.resolution
      ? combatFromStoredResolution(encounter.resolution as Record<string, unknown>)
      : null;
    if (stored) {
      setCombat(stored.combat);
      setNarration(stored.narration);
      setPhase('result');
      if (!selectedId) setSelectedId(encounter.choices?.[0]?.id ?? 'resolved');
    } else if (phase === 'encounter') {
      // Bare post-resolve only when resolution data is missing (reload of resolved day).
      setPhase('post-resolve');
      setNarration("Today's encounter is already resolved. Come back tomorrow.");
    }
  }, [encounter, combat, selectedId, phase]);

  useEffect(() => {
    if (stateLoading || state) return;
    if (!stateError) return;
    const msg = stateError.toLowerCase();
    if (
      msg.includes('disabled') ||
      msg.includes('combat') ||
      msg.includes('gate') ||
      msg.includes('not enabled') ||
      msg.includes('503')
    ) {
      router.replace('/game');
    }
  }, [stateLoading, stateError, state, router]);

  const display = useMemo(() => {
    if (!character) return null;
    return getClassDisplay(character.classSlug, character.subclassSlug, character.risingSlug);
  }, [character]);

  const equippedConsumable: InventoryBagItem | null = useMemo(() => {
    const bag = inventory?.inventory?.bag;
    if (!Array.isArray(bag)) return null;
    return (
      bag.find(
        (i) =>
          i.category === 'consumable' &&
          i.equipped &&
          (i.equippedSlot === 'consumable_1' || i.equippedSlot === 'consumable_2')
      ) || null
    );
  }, [inventory?.inventory]);

  const selectedChoice = useMemo(
    () => encounter?.choices?.find((c) => c.id === selectedId) || encounter?.choices?.[0] || null,
    [encounter, selectedId]
  );

  const openDrawer = useCallback((tab: DrawerTab) => {
    setDrawerTab(tab);
    setDrawerOpen(true);
  }, []);

  const handleChoose = (choiceId: string) => {
    if (phase !== 'encounter' || encounter?.resolved) return;
    setSelectedId(choiceId);
    setPhase('rolling');
    setResolveError(null);
  };

  const handleRoll = useCallback(async () => {
    if (!selectedId || selectedId === 'resolved' || !resolveMeta || !encounter || resolving) return;
    setResolving(true);
    setResolveError(null);
    setPreviousHp(state?.hp?.current ?? encounter.playerState?.hp?.current);
    const chapterBefore = state?.activeChapter ?? state?.saturnChapter;
    const saturnBefore = chapterBefore
      ? {
          house: chapterBefore.currentHouse,
          domain: chapterBefore.domain,
          label: chapterBefore.label,
        }
      : null;

    try {
      const result = await resolveEncounter(campaignId, {
        calendarDate: resolveMeta.calendarDate,
        engineVersion: resolveMeta.engineVersion,
        choiceId: selectedId,
        challengeFingerprint: resolveMeta.challengeFingerprint,
        stateHashBefore: resolveMeta.stateHashBefore,
      });

      // Prefer top-level combatResolution; fall back to nested resolution payload.
      const fromStored = result.resolution
        ? combatFromStoredResolution(result.resolution as Record<string, unknown>)
        : null;
      const combatPayload = result.combatResolution || fromStored?.combat || null;
      if (combatPayload) {
        setCombat(combatPayload);
      }
      setNarration(
        result.narration?.outcomeText || fromStored?.narration || 'The dust settles.'
      );

      const msgs: string[] = [];
      let chapterMs: NonNullable<CombatResolutionPayload['milestones']>[number] | undefined;
      for (const m of combatPayload?.milestones || []) {
        if (m.type === 'chapter_transition' || m.type === 'saturn_transition') chapterMs = m;
        else if (m.detail) msgs.push(m.detail);
      }
      setMilestoneMessages(msgs);

      if (chapterMs && saturnBefore) {
        const detail = chapterMs.detail || '';
        const match = detail.match(/(?:Chapter|Saturn)\s+(\d+)\s*→\s*(\d+):\s*(.+)/);
        const newHouse = match ? Number(match[2]) : saturnBefore.house;
        const newLabel = match ? match[3].trim() : detail;
        const relic = chapterMs.relicGranted
          ? {
              name: chapterMs.relicGranted.name,
              description: chapterMs.relicGranted.description,
              rarity: chapterMs.relicGranted.rarity,
              statModifiers: chapterMs.relicGranted.statModifiers,
            }
          : null;
        setChapterEvent({
          oldChapter: saturnBefore,
          newChapter: { house: newHouse, domain: newLabel, label: newLabel },
          relicReward: relic,
        });
      }

      await Promise.all([refreshState(), inventory.refresh()]);
      setEncounter((prev) =>
        prev
          ? {
              ...prev,
              resolved: true,
              resolution: (result.resolution as Record<string, unknown>) || prev.resolution,
            }
          : prev
      );
      // With die data, stay on 'rolling' so DieRollWidget finishes → 'result'.
      // Without it, skip the animation and show result/narration immediately.
      if (!combatPayload) setPhase('result');
    } catch (e) {
      if (e instanceof GameApiError && e.status === 503) {
        router.replace('/game');
        return;
      }
      setResolveError(e instanceof Error ? e.message : 'Resolve failed');
      setPhase('encounter');
      setSelectedId(null);
    } finally {
      setResolving(false);
    }
  }, [
    selectedId,
    resolveMeta,
    encounter,
    resolving,
    state,
    campaignId,
    refreshState,
    inventory,
    setEncounter,
    router,
  ]);

  // Die widget finished its reveal: show full outcome details.
  const handleRollComplete = useCallback(() => {
    setPhase('result');
    if (chapterEvent) setShowChapter(true);
  }, [chapterEvent]);

  const handleResultDone = useCallback(() => {
    setPhase('post-resolve');
  }, []);

  const handleQuickUse = async (instanceId: string) => {
    setUsingConsumable(true);
    setResolveError(null);
    try {
      const result = await inventory.useConsumable(instanceId);
      setPreCombatUsed(true);
      if (result.updatedState?.hp) {
        setState((prev) =>
          prev
            ? {
                ...prev,
                hp: result.updatedState.hp,
                revealActive: result.updatedState.revealActive ?? prev.revealActive,
              }
            : prev
        );
      }
      await refreshState();
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : 'Consumable use failed');
    } finally {
      setUsingConsumable(false);
    }
  };

  const dieResult =
    combat && combat.dieRoll && typeof combat.dieRoll.raw === 'number'
      ? {
          raw: combat.dieRoll.raw,
          modifier: combat.dieRoll.modifier ?? 0,
          total: combat.dieRoll.total ?? combat.dieRoll.raw,
          dc: encounter?.encounter?.dc ?? 10,
          outcome: combat.outcome ?? 'unknown',
        }
      : null;

  const loading = stateLoading || encLoading || composing;
  const hp = state?.hp || encounter?.playerState?.hp;
  const primaryStat = selectedChoice?.primaryStat || 'vitality';
  const dungeonName =
    state?.activeChapter?.label || state?.saturnChapter?.label || 'Campaign';
  const chapter = state?.chapter ?? 1;

  const showChoiceDock = phase === 'encounter' && !encounter?.resolved && !!encounter?.encounter;

  return (
    <AppShell contentClassName="p-0">
      <AmbientBackdrop element={display?.element ?? 'Earth'} />

      <DungeonLayout
        rail={
          <HudRail
            display={display}
            stats={character?.baseStats ?? null}
            inventory={inventory.inventory}
            currentHP={hp?.current ?? 0}
            maxHP={hp?.max ?? 20}
            wounded={hp?.wounded ?? false}
            streak={state?.streak ?? encounter?.playerState?.streak ?? 0}
            onAvatarClick={() => openDrawer('character')}
            onGearClick={() => openDrawer('inventory')}
          />
        }
        drawer={
          <CharacterDrawer
            campaignId={campaignId}
            open={drawerOpen}
            tab={drawerTab}
            onTabChange={setDrawerTab}
            onClose={() => setDrawerOpen(false)}
            character={character}
            characterLoading={characterLoading}
            characterError={characterError}
            inventory={inventory.inventory}
            inventoryLoading={inventory.loading}
            mutating={inventory.mutating}
            onEquip={async (id) => {
              await inventory.equip(id);
            }}
            onUnequip={async (slot) => {
              await inventory.unequip(slot);
            }}
            onUse={async (id) => {
              await inventory.useConsumable(id);
              await refreshState();
            }}
            onDiscard={async (id) => {
              await inventory.discard(id);
            }}
          />
        }
        bottomDock={
          showChoiceDock ? (
            <div className="mx-auto max-w-4xl space-y-3">
              <ConsumableQuickUse
                item={equippedConsumable}
                onUse={(id) => void handleQuickUse(id)}
                disabled={usingConsumable || preCombatUsed}
                loading={usingConsumable}
              />
              <ChoicePanel
                choices={encounter?.choices ?? []}
                onChoose={handleChoose}
                disabled={false}
                selectedId={selectedId}
              />
            </div>
          ) : null
        }
        dungeonName={dungeonName}
        chapter={chapter}
        drawerOpen={drawerOpen}
        onCharacterToggle={() => (drawerOpen ? setDrawerOpen(false) : openDrawer('character'))}
        mobileHp={hp ? { current: hp.current, max: hp.max } : null}
        mobileStreak={state?.streak}
      >
        {loading && !encounter ? (
          <div className="mx-auto max-w-2xl space-y-4 pt-8">
            <Card elevation="resting" size="md" className="h-16 animate-pulse bg-white/5" />
            <Card elevation="resting" size="lg" className="h-48 animate-pulse bg-white/5" />
          </div>
        ) : null}

        {(stateError || encError) && !encounter ? (
          <Card elevation="resting" size="md" className="mx-auto max-w-2xl space-y-3">
            <p className="text-body-sm text-danger">{stateError || encError}</p>
            <Button variant="secondary" onClick={() => void refreshEncounter()}>
              Retry
            </Button>
          </Card>
        ) : null}

        {encounter?.encounter ? (
          <>
            {phase === 'encounter' ? (
              <div className="mx-auto max-w-2xl space-y-4">
                <EncounterCard
                  theme={encounter.encounter.theme}
                  obstacle={encounter.encounter.obstacle}
                  dc={encounter.encounter.dc}
                  introNarration={encounter.encounter.introNarration}
                  saturnHouse={encounter.encounter.saturnHouse}
                />
                <RevealHint hint={encounter.playerState?.revealHint ?? null} />
              </div>
            ) : null}

            {phase === 'rolling' ? (
              <DieRollWidget
                onRoll={() => void handleRoll()}
                result={dieResult}
                primaryStat={primaryStat}
                choiceLabel={selectedChoice?.label}
                loading={resolving}
                onComplete={handleRollComplete}
              />
            ) : null}

            {phase === 'result' && combat && hp ? (
              <div className="mx-auto max-w-2xl space-y-4">
                <OutcomePanel
                  narration={narration}
                  combat={combat}
                  hp={state?.hp || hp}
                  previousHp={previousHp}
                  primaryStat={primaryStat}
                  dc={encounter.encounter.dc}
                  streak={typeof state?.streak === 'number' ? state.streak : undefined}
                  milestones={milestoneMessages}
                  onOpenInventory={() => openDrawer('inventory')}
                  onOpenCharacter={() => openDrawer('character')}
                />
                <div className="flex justify-center pb-8">
                  <button
                    type="button"
                    onClick={handleResultDone}
                    className="rounded-[10px] px-8 py-3 text-sm font-bold text-white transition-all duration-200 hover:scale-[1.04]"
                    style={{
                      background: 'linear-gradient(135deg, #0e9696, #00674f)',
                      boxShadow: '0 4px 16px rgba(14,150,150,.3)',
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : null}

            {phase === 'result' && !combat ? (
              <div className="mx-auto max-w-2xl space-y-4 pt-12 text-center">
                <p className="font-serif text-xl text-text-secondary">
                  {narration || 'The dust settles.'}
                </p>
                <button
                  type="button"
                  onClick={handleResultDone}
                  className="rounded-[10px] px-8 py-3 text-sm font-bold text-white transition-all duration-200 hover:scale-[1.04]"
                  style={{
                    background: 'linear-gradient(135deg, #0e9696, #00674f)',
                    boxShadow: '0 4px 16px rgba(14,150,150,.3)',
                  }}
                >
                  Done
                </button>
              </div>
            ) : null}

            {phase === 'post-resolve' ? (
              <div className="mx-auto max-w-2xl space-y-4 pt-12 text-center">
                <p className="font-serif text-xl text-text-secondary">
                  Come back tomorrow to continue your streak
                  {typeof state?.streak === 'number' ? ` (${state.streak})` : ''}.
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => openDrawer('inventory')}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
                  >
                    Inventory
                  </button>
                  <button
                    type="button"
                    onClick={() => openDrawer('character')}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
                  >
                    Character
                  </button>
                  <button
                    type="button"
                    onClick={() => openDrawer('loot')}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
                  >
                    Loot Table
                  </button>
                </div>
              </div>
            ) : null}

            {resolveError ? (
              <p className="mx-auto mt-4 max-w-2xl text-center text-body-sm text-danger">
                {resolveError}
              </p>
            ) : null}
          </>
        ) : null}
      </DungeonLayout>

      {chapterEvent ? (
        <ChapterTransition
          show={showChapter}
          oldChapter={chapterEvent.oldChapter}
          newChapter={chapterEvent.newChapter}
          relicReward={chapterEvent.relicReward}
          onDismiss={() => setShowChapter(false)}
        />
      ) : null}
    </AppShell>
  );
}
