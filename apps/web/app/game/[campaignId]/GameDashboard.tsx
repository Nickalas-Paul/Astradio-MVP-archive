'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { useGameState } from '@/hooks/useGameState';
import { useGameEncounter } from '@/hooks/useGameEncounter';
import { useGameInventory } from '@/hooks/useGameInventory';
import {
  combatFromStoredResolution,
  fetchLootTable,
  resolveEncounter,
  GameApiError,
  type CombatResolutionPayload,
  type InventoryBagItem,
  type LootTableResponse,
} from '@/lib/game-api';
import { GameStateHeader } from './components/GameStateHeader';
import { EncounterCard } from './components/EncounterCard';
import { ChoicePanel } from './components/ChoicePanel';
import { DieRollWidget } from './components/DieRollWidget';
import { OutcomePanel } from './components/OutcomePanel';
import { LootReveal } from './components/LootReveal';
import { ConsumableQuickUse } from './components/ConsumableQuickUse';
import { RevealHint } from './components/RevealHint';
import { StreakMilestone } from './components/StreakMilestone';
import { ChapterTransition } from './components/ChapterTransition';
import { CharacterSheet } from './components/CharacterSheet';
import { InventoryDrawer } from './components/InventoryDrawer';

type Phase = 'choose' | 'roll' | 'outcome';

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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('choose');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [combat, setCombat] = useState<CombatResolutionPayload | null>(null);
  const [narration, setNarration] = useState('');
  const [previousHp, setPreviousHp] = useState<number | undefined>();
  const [milestoneMessages, setMilestoneMessages] = useState<string[]>([]);
  const [chapterEvent, setChapterEvent] = useState<ChapterEvent | null>(null);
  const [showChapter, setShowChapter] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [lootTable, setLootTable] = useState<LootTableResponse | null>(null);
  const [lootOpen, setLootOpen] = useState(false);
  const [preCombatUsed, setPreCombatUsed] = useState(false);
  const [usingConsumable, setUsingConsumable] = useState(false);

  useEffect(() => {
    const panel = searchParams.get('panel');
    if (panel === 'character') setCharacterOpen(true);
    if (panel === 'inventory') setInventoryOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!encounter?.resolved || !encounter.resolution || combat) return;
    const stored = combatFromStoredResolution(encounter.resolution as Record<string, unknown>);
    if (stored) {
      setCombat(stored.combat);
      setNarration(stored.narration);
      setPhase('outcome');
      if (!selectedId) setSelectedId(encounter.choices?.[0]?.id ?? 'resolved');
    } else {
      setPhase('outcome');
      setNarration("Today's encounter is already resolved. Come back tomorrow.");
    }
  }, [encounter, combat, selectedId]);

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

  const handleChoose = (choiceId: string) => {
    if (phase !== 'choose' || encounter?.resolved) return;
    setSelectedId(choiceId);
    setPhase('roll');
    setResolveError(null);
  };

  const handleRoll = useCallback(async () => {
    if (!selectedId || selectedId === 'resolved' || !resolveMeta || !encounter || resolving) return;
    setResolving(true);
    setResolveError(null);
    setPreviousHp(state?.hp?.current ?? encounter.playerState?.hp?.current);
    const saturnBefore = state?.saturnChapter
      ? {
          house: state.saturnChapter.currentHouse,
          domain: state.saturnChapter.domain,
          label: state.saturnChapter.label,
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

      const combatPayload = result.combatResolution || null;
      if (combatPayload) setCombat(combatPayload);
      setNarration(result.narration?.outcomeText || 'The dust settles.');

      const msgs: string[] = [];
      let saturnMs: NonNullable<CombatResolutionPayload['milestones']>[number] | undefined;
      for (const m of combatPayload?.milestones || []) {
        if (m.type === 'saturn_transition') saturnMs = m;
        else if (m.detail) msgs.push(m.detail);
      }
      setMilestoneMessages(msgs);

      if (saturnMs && saturnBefore) {
        const detail = saturnMs.detail || '';
        const match = detail.match(/Saturn\s+(\d+)\s*→\s*(\d+):\s*(.+)/);
        const newHouse = match ? Number(match[2]) : saturnBefore.house;
        const newLabel = match ? match[3].trim() : detail;
        const relic = saturnMs.relicGranted
          ? {
              name: saturnMs.relicGranted.name,
              description: saturnMs.relicGranted.description,
              rarity: saturnMs.relicGranted.rarity,
              statModifiers: saturnMs.relicGranted.statModifiers,
            }
          : null;
        setChapterEvent({
          oldChapter: saturnBefore,
          newChapter: { house: newHouse, domain: newLabel, label: newLabel },
          relicReward: relic,
        });
        setShowChapter(true);
      }

      setPhase('outcome');
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
    } catch (e) {
      if (e instanceof GameApiError && e.status === 503) {
        router.replace('/game');
        return;
      }
      setResolveError(e instanceof Error ? e.message : 'Resolve failed');
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

  const openLootTable = async () => {
    try {
      const table = await fetchLootTable(campaignId);
      setLootTable(table);
      setLootOpen(true);
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : 'Failed to load loot table');
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

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8 pb-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <p className="text-caption uppercase tracking-wide text-accent">
            <Link href="/game" className="hover:underline">
              Campaign
            </Link>
          </p>
          <h1 className="font-serif text-h2 text-text-primary">Daily Encounter</h1>
        </motion.div>

        {loading && !encounter ? (
          <div className="space-y-4">
            <Card elevation="resting" size="md" className="h-16 animate-pulse bg-white/5" />
            <Card elevation="resting" size="lg" className="h-48 animate-pulse bg-white/5" />
          </div>
        ) : null}

        {(stateError || encError) && !encounter ? (
          <Card elevation="resting" size="md" className="space-y-3">
            <p className="text-body-sm text-danger">{stateError || encError}</p>
            <Button variant="secondary" onClick={() => void refreshEncounter()}>
              Retry
            </Button>
          </Card>
        ) : null}

        {state?.hp ? (
          <GameStateHeader
            hp={state.hp}
            streak={state.streak ?? 0}
            saturnChapter={state.saturnChapter ?? null}
            chapter={state.chapter ?? 1}
          />
        ) : hp ? (
          <GameStateHeader
            hp={hp}
            streak={encounter?.playerState?.streak ?? 0}
            saturnChapter={null}
            chapter={1}
          />
        ) : null}

        {encounter?.encounter ? (
          <div className="space-y-6">
            <EncounterCard
              theme={encounter.encounter.theme}
              setting={encounter.encounter.setting}
              obstacle={encounter.encounter.obstacle}
              dc={encounter.encounter.dc}
              introNarration={encounter.encounter.introNarration}
              transitDescription={encounter.encounter.theme}
              saturnChapter={state?.saturnChapter?.label || `House ${encounter.encounter.saturnHouse}`}
            />

            {phase === 'choose' && !encounter.resolved ? (
              <>
                <ConsumableQuickUse
                  item={equippedConsumable}
                  onUse={(id) => void handleQuickUse(id)}
                  disabled={usingConsumable || preCombatUsed}
                  loading={usingConsumable}
                />
                <RevealHint hint={encounter.playerState?.revealHint ?? null} />
                <ChoicePanel
                  choices={encounter.choices ?? []}
                  onChoose={handleChoose}
                  disabled={false}
                  selectedId={selectedId}
                />
              </>
            ) : null}

            {phase === 'roll' || (phase === 'outcome' && dieResult) ? (
              <DieRollWidget
                onRoll={() => void handleRoll()}
                result={dieResult}
                primaryStat={primaryStat}
                loading={resolving}
              />
            ) : null}

            {phase === 'outcome' && combat && hp ? (
              <OutcomePanel
                narration={narration}
                combat={combat}
                hp={state?.hp || hp}
                previousHp={previousHp}
              />
            ) : null}

            {phase === 'outcome' && !combat && narration ? (
              <Card elevation="raised" size="md">
                <p className="font-serif text-lg text-text-secondary">{narration}</p>
              </Card>
            ) : null}

            <LootReveal
              show={phase === 'outcome' && !!combat?.loot?.dropped && !!combat.loot.item}
              item={
                combat?.loot?.item
                  ? { ...combat.loot.item, classAffinityBonus: false }
                  : null
              }
            />

            <StreakMilestone
              show={phase === 'outcome' && milestoneMessages.length > 0}
              messages={milestoneMessages}
            />

            {phase === 'outcome' ? (
              <Card elevation="resting" size="sm" className="text-center">
                <p className="text-body-sm text-text-secondary">
                  Come back tomorrow to continue your streak
                  {typeof state?.streak === 'number' ? ` (${state.streak})` : ''}.
                </p>
              </Card>
            ) : null}

            {resolveError ? <p className="text-body-sm text-danger">{resolveError}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" size="sm" onClick={() => setInventoryOpen(true)}>
                Inventory
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setCharacterOpen(true)}>
                Character
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void openLootTable()}>
                Loot Table
              </Button>
            </div>

            {lootOpen && lootTable ? (
              <Card elevation="raised" size="md" className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-caption uppercase text-accent">Loot table</p>
                    <h3 className="font-serif text-h4">{lootTable.label}</h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setLootOpen(false)}>
                    Close
                  </Button>
                </div>
                <ul className="space-y-2">
                  {(lootTable.items ?? []).slice(0, 12).map((item) => (
                    <li key={item.slug} className="text-body-sm text-text-secondary">
                      <span className="font-medium text-text-primary">{item.name}</span>
                      <span className="text-text-muted"> · {item.rarity} · {item.dropWeight}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>

      <InventoryDrawer
        open={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        inventory={inventory.inventory}
        loading={inventory.loading}
        mutating={inventory.mutating}
        onEquip={inventory.equip}
        onUnequip={inventory.unequip}
        onUse={async (id) => {
          await inventory.useConsumable(id);
          await refreshState();
        }}
        onDiscard={inventory.discard}
      />

      <CharacterSheet
        campaignId={campaignId}
        open={characterOpen}
        onClose={() => setCharacterOpen(false)}
      />

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
