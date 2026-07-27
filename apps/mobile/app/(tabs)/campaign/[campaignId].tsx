import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CampaignSheet, type CampaignSheetTab } from '../../../src/components/campaign/CampaignSheet';
import {
  ChapterTransition,
  type ChapterTransitionChapter,
  type ChapterTransitionRelic,
} from '../../../src/components/campaign/ChapterTransition';
import { colors } from '../../../src/constants/colors';
import { useCampaignGame } from '../../../src/hooks/useCampaignGame';
import { useCampaignTheme } from '../../../src/hooks/useCampaignTheme';
import { getClassDisplay } from '../../../src/lib/class-display';
import {
  gameErrorMessage,
  resolveChapterLabel,
  resolveEncounter,
  useConsumable,
  type CombatMilestone,
  type CombatResolution,
  type EncounterChoice,
} from '../../../src/lib/game-api';
import { getDungeonTheme, type DungeonTheme } from '../../../src/lib/game/dungeon-themes';

type Phase = 'choose' | 'roll' | 'outcome';

type ChapterEvent = {
  oldChapter: ChapterTransitionChapter;
  newChapter: ChapterTransitionChapter;
  relicReward: ChapterTransitionRelic;
};

const OUTCOME_COLORS: Record<string, string> = {
  success: '#10B981',
  partial: '#F59E0B',
  failure: '#EF4444',
  critical_success: '#D4AF37',
  critical_failure: '#991B1B',
};

function riskLabel(value: string) {
  const risk = value.toLowerCase();
  if (risk.includes('high')) return 'High';
  if (risk.includes('low')) return 'Low';
  return 'Moderate';
}

function parseTheme(theme: string) {
  const match = /^\s*(\w+)\s+to\s+(\w+)\s*\(([^)]+)\)\s*(?:in\s+(.+))?$/i.exec(theme || '');
  if (!match) return { aspect: '', tags: [] as string[] };
  const glyphs: Record<string, string> = {
    conjunction: '☌',
    opposition: '☍',
    square: '□',
    trine: '△',
    sextile: '✶',
  };
  const title = (value: string) => value[0]!.toUpperCase() + value.slice(1);
  return {
    aspect: `${title(match[1]!)} ${glyphs[match[3]!.toLowerCase()] ?? match[3]} ${title(match[2]!)}`,
    tags: (match[4] || '')
      .split(/,|\band\b/i)
      .map((value) => value.trim())
      .filter(Boolean)
      .map(title),
  };
}

function HpBar({ current, max, wounded }: { current: number; max: number; wounded: boolean }) {
  const ratio = Math.max(0, Math.min(1, current / Math.max(1, max)));
  const color = wounded ? '#991B1B' : ratio > 0.6 ? '#10B981' : ratio > 0.3 ? '#F59E0B' : '#EF4444';
  return (
    <View style={styles.hpWrap}>
      <View style={styles.hpHeader}>
        <Text style={styles.micro}>HEALTH</Text>
        <Text style={styles.hpValue}>{current} / {max}</Text>
      </View>
      <View style={styles.hpTrack}>
        <View style={[styles.hpFill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ChoiceCard({
  choice,
  best,
  onPress,
  dungeon,
}: {
  choice: EncounterChoice;
  best: boolean;
  onPress: () => void;
  dungeon: DungeonTheme;
}) {
  const modifierColor = choice.currentModifier > 0 ? '#10B981' : choice.currentModifier < 0 ? '#EF4444' : '#94A3B8';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceCard,
        best && { backgroundColor: dungeon.accentMuted, borderColor: dungeon.accent },
        pressed && styles.pressed,
      ]}
    >
      {best ? (
        <Text style={[styles.bestBadge, { backgroundColor: dungeon.accent }]}>BEST ODDS</Text>
      ) : null}
      <View style={styles.choiceHeader}>
        <Text style={styles.choiceLabel}>{choice.label}</Text>
        <Text style={[styles.modifier, { color: modifierColor }]}>
          {choice.currentModifier >= 0 ? '+' : ''}{choice.currentModifier}
        </Text>
      </View>
      <Text numberOfLines={3} style={styles.choiceDescription}>{choice.symbolicGesture}</Text>
      <View style={styles.choiceFooter}>
        <View style={styles.choiceFooterLeft}>
          <Text style={[styles.statLabel, { color: dungeon.textAccent }]}>
            {choice.primaryStat.toUpperCase()}
          </Text>
          <Text style={styles.meta}>{riskLabel(choice.riskProfile)} risk</Text>
        </View>
        <View style={[styles.chooseChip, { borderColor: dungeon.accent }]}>
          <Text style={[styles.chooseChipText, { color: dungeon.textAccent }]}>Choose</Text>
        </View>
      </View>
    </Pressable>
  );
}

function DieStage({
  choice,
  resolving,
  combat,
  displayNumber,
  rotation,
  onRoll,
}: {
  choice: EncounterChoice;
  resolving: boolean;
  combat: CombatResolution | null;
  displayNumber: number;
  rotation: Animated.Value;
  onRoll: () => void;
}) {
  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '1080deg'] });
  return (
    <View style={styles.dieStage}>
      <Text style={styles.choiceRecap}>
        You chose: <Text style={styles.choiceRecapStrong}>{choice.label}</Text> ({choice.primaryStat})
      </Text>
      <Animated.View style={[styles.die, { transform: [{ rotate }, { scale: resolving ? 1.04 : 1 }] }]}>
        <Text style={styles.dieNumber}>{resolving || combat ? displayNumber : 20}</Text>
      </Animated.View>
      {!combat ? (
        <Pressable
          disabled={resolving}
          onPress={onRoll}
          style={({ pressed }) => [styles.rollButton, (pressed || resolving) && styles.pressed]}
        >
          {resolving ? <ActivityIndicator color="#fff" /> : <Ionicons name="dice-outline" size={20} color="#fff" />}
          <Text style={styles.rollButtonText}>{resolving ? 'Rolling…' : 'Roll d20'}</Text>
        </Pressable>
      ) : (
        <View style={styles.rollResult}>
          <Text style={styles.rollBreakdown}>
            {combat.dieRoll.raw} {combat.dieRoll.modifier >= 0 ? '+' : '−'} {Math.abs(combat.dieRoll.modifier)}
            {' '}({choice.primaryStat}) = <Text style={styles.rollTotal}>{combat.dieRoll.total}</Text>
          </Text>
          <Text style={[styles.outcomeLabel, { color: OUTCOME_COLORS[combat.outcome] ?? '#F8FAFC' }]}>
            {combat.outcome.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function CampaignDashboardScreen() {
  const params = useLocalSearchParams<{ campaignId: string }>();
  const campaignId = Array.isArray(params.campaignId) ? params.campaignId[0] : params.campaignId;
  const router = useRouter();
  const game = useCampaignGame(campaignId || '');
  const [phase, setPhase] = useState<Phase>('choose');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [combat, setCombat] = useState<CombatResolution | null>(null);
  const [narration, setNarration] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetTab, setSheetTab] = useState<CampaignSheetTab>('character');
  const [displayNumber, setDisplayNumber] = useState(20);
  const [consumableUsed, setConsumableUsed] = useState(false);
  const [chapterEvent, setChapterEvent] = useState<ChapterEvent | null>(null);
  const [showChapter, setShowChapter] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;

  const display = useMemo(
    () => game.character
      ? getClassDisplay(game.character.classSlug, game.character.subclassSlug, game.character.risingSlug)
      : null,
    [game.character],
  );
  const chapterState = game.state?.activeChapter ?? game.state?.saturnChapter ?? null;
  const { dungeon } = useCampaignTheme(chapterState, display?.element ?? 'Earth');
  const hp = game.state?.hp ?? game.encounter?.playerState.hp;
  const selectedChoice = game.encounter?.choices.find((choice) => choice.id === selectedId) ?? null;
  const theme = parseTheme(game.encounter?.encounter.theme ?? '');
  const bestModifier = Math.max(...(game.encounter?.choices ?? []).map((choice) => choice.currentModifier), 0);
  const equippedConsumable = game.inventory?.bag.find(
    (item) => item.category === 'consumable' && item.equipped,
  ) ?? null;
  const dungeonTitle = resolveChapterLabel(game.state) ?? dungeon.label;

  const openSheet = useCallback((tab: CampaignSheetTab) => {
    setSheetTab(tab);
    setSheetVisible(true);
  }, []);

  const handleRoll = useCallback(async () => {
    if (!campaignId || !selectedChoice || !game.resolveMeta || resolving) return;
    setResolving(true);
    game.setError(null);
    rotation.setValue(0);
    const chapterBefore = game.state?.activeChapter ?? game.state?.saturnChapter ?? null;
    const beforeSnapshot = chapterBefore
      ? {
          house: chapterBefore.currentHouse,
          domain: chapterBefore.domain,
          label: chapterBefore.label,
        }
      : null;
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 850,
        useNativeDriver: true,
      }),
    );
    animation.start();
    const ticker = setInterval(() => setDisplayNumber(Math.floor(Math.random() * 20) + 1), 70);
    try {
      const result = await resolveEncounter(campaignId, {
        ...game.resolveMeta,
        choiceId: selectedChoice.id,
      });
      if (!result.combatResolution) throw new Error('The encounter returned no combat result.');
      await new Promise((resolve) => setTimeout(resolve, 850));
      clearInterval(ticker);
      animation.stop();
      rotation.setValue(0);
      setDisplayNumber(result.combatResolution.dieRoll.raw);
      setCombat(result.combatResolution);
      setNarration(result.narration?.outcomeText ?? 'The dust settles.');

      let chapterMs: CombatMilestone | undefined;
      for (const m of result.combatResolution.milestones ?? []) {
        if (m.type === 'chapter_transition' || m.type === 'saturn_transition') {
          chapterMs = m;
          break;
        }
      }
      if (chapterMs && beforeSnapshot) {
        const detail = chapterMs.detail || '';
        const match = detail.match(/(?:Chapter|Saturn)\s+(\d+)\s*→\s*(\d+):\s*(.+)/);
        const newHouse = match ? Number(match[2]) : beforeSnapshot.house;
        const parsedLabel = match ? match[3]!.trim() : detail;
        const newTheme = getDungeonTheme(newHouse);
        setChapterEvent({
          oldChapter: beforeSnapshot,
          newChapter: {
            house: newHouse,
            domain: newTheme.domain,
            label: parsedLabel || newTheme.label,
          },
          relicReward: chapterMs.relicGranted
            ? {
                name: chapterMs.relicGranted.name,
                description: chapterMs.relicGranted.description,
                rarity: chapterMs.relicGranted.rarity,
                statModifiers: chapterMs.relicGranted.statModifiers,
              }
            : null,
        });
      }

      await game.refreshStateAndInventory();
      setTimeout(() => setPhase('outcome'), 1500);
    } catch (err) {
      clearInterval(ticker);
      animation.stop();
      rotation.setValue(0);
      game.setError(gameErrorMessage(err, 'Could not resolve the encounter.'));
    } finally {
      setResolving(false);
    }
  }, [campaignId, game, resolving, rotation, selectedChoice]);

  useEffect(() => {
    if (chapterEvent) setShowChapter(true);
  }, [chapterEvent]);

  const quickUse = useCallback(async () => {
    if (!campaignId || !equippedConsumable || consumableUsed) return;
    try {
      await useConsumable(campaignId, equippedConsumable.instanceId);
      setConsumableUsed(true);
      await game.refreshStateAndInventory();
    } catch (err) {
      game.setError(gameErrorMessage(err, 'Could not use the item.'));
    }
  }, [campaignId, consumableUsed, equippedConsumable, game]);

  if (!campaignId) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient colors={dungeon.gradient} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View pointerEvents="none" style={[styles.ambientOrb, { backgroundColor: dungeon.accentMuted }]} />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={22} color="#CBD5E1" />
        </Pressable>
        <View style={styles.topTitle}>
          <Text numberOfLines={1} style={[styles.dungeonName, { color: dungeon.textAccent }]}>
            {dungeonTitle}
          </Text>
          <Text style={styles.meta}>
            Chapter {game.state?.chapter ?? 1} · {dungeon.domain}
          </Text>
        </View>
        {hp ? (
          <View style={styles.topHp}>
            <Ionicons name="heart" size={12} color="#EF4444" />
            <Text style={styles.topHpText}>{hp.current}/{hp.max}</Text>
          </View>
        ) : null}
        {(game.state?.streak ?? 0) >= 7 ? (
          <View style={styles.streakBadge}>
            <Text style={styles.streakBadgeText}>🔥 {game.state?.streak}</Text>
          </View>
        ) : null}
        <Pressable
          onPress={() => openSheet('character')}
          style={[styles.avatar, { backgroundColor: dungeon.accent }]}
        >
          <Text style={styles.avatarText}>{display?.classInitial ?? '??'}</Text>
        </Pressable>
      </View>

      {game.loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent.DEFAULT} />
          <Text style={styles.loadingText}>Composing today’s encounter…</Text>
        </View>
      ) : game.error && !game.encounter ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{game.error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void game.load()}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={game.refreshing}
              onRefresh={() => void game.load(true)}
              tintColor={colors.accent.DEFAULT}
            />
          }
        >
          {phase === 'choose' && game.encounter && !game.encounter.resolved ? (
            <>
              <View style={styles.encounter}>
                <Text style={styles.narration}>
                  {game.encounter.encounter.introNarration || game.encounter.encounter.obstacle}
                </Text>
                <View style={styles.tags}>
                  {theme.tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}
                </View>
                <View style={styles.dcBadge}>
                  <Text style={styles.micro}>DIFFICULTY</Text>
                  <Text style={styles.dc}>{game.encounter.encounter.dc}</Text>
                </View>
                {theme.aspect ? <Text style={styles.aspect}>{theme.aspect}</Text> : null}
              </View>

              {game.encounter.playerState.revealHint ? (
                <View style={styles.hint}>
                  <Ionicons name="sparkles-outline" size={15} color={colors.accent.DEFAULT} />
                  <Text style={styles.hintText}>{game.encounter.playerState.revealHint}</Text>
                </View>
              ) : null}

              {equippedConsumable ? (
                <View style={styles.consumable}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.micro}>PREPARED ITEM</Text>
                    <Text style={styles.consumableName}>{equippedConsumable.name}</Text>
                    <Text style={styles.meta}>
                      {equippedConsumable.consumableEffect?.type ?? 'Consumable'}{' '}
                      {equippedConsumable.consumableEffect?.magnitude
                        ? `+${equippedConsumable.consumableEffect.magnitude}`
                        : ''}
                    </Text>
                  </View>
                  <Pressable
                    disabled={consumableUsed}
                    style={[styles.useButton, consumableUsed && styles.pressed]}
                    onPress={() => void quickUse()}
                  >
                    <Text style={styles.useButtonText}>{consumableUsed ? 'Used' : 'Use'}</Text>
                  </Pressable>
                </View>
              ) : null}

              <Text style={styles.chooseTitle}>Choose your response</Text>
              <View style={styles.choices}>
                {game.encounter.choices.map((choice) => (
                  <ChoiceCard
                    key={choice.id}
                    choice={choice}
                    best={choice.currentModifier === bestModifier}
                    dungeon={dungeon}
                    onPress={() => {
                      setSelectedId(choice.id);
                      setPhase('roll');
                    }}
                  />
                ))}
              </View>
            </>
          ) : null}

          {phase === 'roll' && selectedChoice ? (
            <DieStage
              choice={selectedChoice}
              resolving={resolving}
              combat={combat}
              displayNumber={displayNumber}
              rotation={rotation}
              onRoll={() => void handleRoll()}
            />
          ) : null}

          {phase === 'outcome' && combat && selectedChoice && hp ? (
            <View style={styles.outcome}>
              <Text style={[styles.outcomeTitle, { color: OUTCOME_COLORS[combat.outcome] ?? '#F8FAFC' }]}>
                {combat.outcome.replace(/_/g, ' ').toUpperCase()}
              </Text>
              <Text style={styles.rollBreakdown}>
                Rolled {combat.dieRoll.raw} {combat.dieRoll.modifier >= 0 ? '+' : '−'} {Math.abs(combat.dieRoll.modifier)}
                {' '}({selectedChoice.primaryStat}) = {combat.dieRoll.total} vs DC {game.encounter?.encounter.dc}
              </Text>
              <Text style={styles.outcomeNarration}>{narration}</Text>
              {combat.damageDealt > 0 ? (
                <View style={styles.damageCard}>
                  <Text style={styles.micro}>DAMAGE TAKEN</Text>
                  <Text style={styles.damage}>−{combat.damageDealt}</Text>
                  {combat.woundedTriggered ? <Text style={styles.errorText}>You are wounded.</Text> : null}
                </View>
              ) : null}
              {combat.healAmount > 0 ? (
                <View style={styles.healCard}>
                  <Text style={styles.micro}>RECOVERY</Text>
                  <Text style={styles.heal}>+{combat.healAmount}</Text>
                </View>
              ) : null}
              {combat.loot.dropped && combat.loot.item ? (
                <View style={styles.lootCard}>
                  <Text style={styles.micro}>LOOT FOUND</Text>
                  <Text style={styles.lootName}>{combat.loot.item.name}</Text>
                  <Text style={styles.choiceDescription}>{combat.loot.item.description}</Text>
                </View>
              ) : null}
              {(combat.milestones ?? []).map((milestone) => (
                <View key={`${milestone.type}-${milestone.detail}`} style={styles.milestone}>
                  <Ionicons name="sparkles" size={18} color="#D4AF37" />
                  <Text style={styles.milestoneText}>{milestone.detail}</Text>
                </View>
              ))}
              <HpBar current={hp.current} max={hp.max} wounded={hp.wounded} />
              <View style={styles.resolvedFooter}>
                <Text style={styles.resolvedTitle}>Encounter resolved</Text>
                <Text style={styles.secondaryCenter}>
                  Your next encounter appears tomorrow. Keep the streak alive.
                  {(game.state?.streak ?? 0) >= 7 ? ` 🔥 ${game.state?.streak}-day streak` : ''}
                </Text>
                <View style={styles.footerActions}>
                  <Pressable
                    style={[styles.secondaryButton, { borderColor: dungeon.accent }]}
                    onPress={() => openSheet('inventory')}
                  >
                    <Text style={[styles.secondaryButtonText, { color: dungeon.textAccent }]}>
                      Manage Inventory
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.secondaryButton, { borderColor: dungeon.accent }]}
                    onPress={() => openSheet('character')}
                  >
                    <Text style={[styles.secondaryButtonText, { color: dungeon.textAccent }]}>
                      View Character
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.doneButton, { backgroundColor: dungeon.accent }]}
                    onPress={() => router.back()}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}

          {game.encounter?.resolved && phase === 'choose' ? (
            <View style={styles.resolvedCard}>
              <Ionicons name="checkmark-circle-outline" size={34} color={colors.accent.DEFAULT} />
              <Text style={styles.resolvedTitle}>Today’s encounter is complete</Text>
              <Text style={styles.secondaryCenter}>Return tomorrow to continue your streak.</Text>
            </View>
          ) : null}
          {game.error ? <Text style={styles.errorText}>{game.error}</Text> : null}
        </ScrollView>
      )}

      <View style={styles.quickNav}>
        <Pressable onPress={() => openSheet('character')} style={styles.quickNavButton}>
          <Ionicons name="person-outline" size={18} color="#94A3B8" />
          <Text style={styles.quickNavText}>Character</Text>
        </Pressable>
        <Pressable onPress={() => openSheet('inventory')} style={styles.quickNavButton}>
          <Ionicons name="bag-handle-outline" size={18} color="#94A3B8" />
          <Text style={styles.quickNavText}>Inventory</Text>
        </Pressable>
        <Pressable onPress={() => openSheet('loot')} style={styles.quickNavButton}>
          <Ionicons name="diamond-outline" size={18} color="#94A3B8" />
          <Text style={styles.quickNavText}>Loot</Text>
        </Pressable>
      </View>

      <CampaignSheet
        campaignId={campaignId}
        visible={sheetVisible}
        tab={sheetTab}
        onTabChange={setSheetTab}
        onClose={() => setSheetVisible(false)}
        character={game.character}
        inventory={game.inventory}
        dungeon={dungeon}
        onInventoryChange={game.setInventory}
        onStateRefresh={game.refreshStateAndInventory}
      />

      {chapterEvent ? (
        <ChapterTransition
          show={showChapter}
          oldChapter={chapterEvent.oldChapter}
          newChapter={chapterEvent.newChapter}
          relicReward={chapterEvent.relicReward}
          onDismiss={() => {
            setShowChapter(false);
            setChapterEvent(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0C1320' },
  ambientOrb: { position: 'absolute', width: 340, height: 340, borderRadius: 170, top: -100, right: -130 },
  topBar: {
    minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.24)', borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  topTitle: { flex: 1 },
  dungeonName: {
    fontFamily: 'Cormorant-SemiBold',
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  bestChoice: { backgroundColor: 'rgba(14,150,150,0.08)', borderColor: 'rgba(14,150,150,0.35)' },
  bestBadge: {
    position: 'absolute',
    right: 10,
    top: -8,
    fontFamily: 'Manrope-Bold',
    fontSize: 8,
    color: '#fff',
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 3,
    letterSpacing: 0.8,
    overflow: 'hidden',
  },
  topHp: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topHpText: { fontFamily: 'Manrope-Bold', fontSize: 11, color: '#CBD5E1' },
  avatarText: { fontFamily: 'Manrope-Bold', fontSize: 11, color: '#fff' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 18, paddingBottom: 110 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 14 },
  loadingText: { fontFamily: 'Manrope-Regular', fontSize: 13, color: '#94A3B8' },
  encounter: { alignItems: 'center', gap: 16, paddingVertical: 22 },
  narration: { fontFamily: 'Cormorant-Regular', fontSize: 23, lineHeight: 31, textAlign: 'center', color: '#F8FAFC' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 },
  tag: { fontFamily: 'Manrope-Regular', fontSize: 10, color: '#94A3B8', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  dcBadge: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  micro: { fontFamily: 'Manrope-Bold', fontSize: 9, letterSpacing: 1.2, color: '#64748B' },
  dc: { fontFamily: 'Manrope-Bold', fontSize: 17, color: '#F8FAFC' },
  aspect: { fontFamily: 'Manrope-SemiBold', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.accent.DEFAULT },
  hint: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(14,150,150,0.08)', borderWidth: 1, borderColor: 'rgba(14,150,150,0.2)', marginBottom: 12 },
  hintText: { flex: 1, fontFamily: 'Cormorant-Italic', fontSize: 15, color: '#7DD3D3' },
  consumable: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 13, padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  consumableName: { fontFamily: 'Manrope-SemiBold', fontSize: 13, color: '#E2E8F0', marginTop: 2 },
  useButton: { paddingHorizontal: 15, minHeight: 38, borderRadius: 9, backgroundColor: colors.accent.DEFAULT, justifyContent: 'center' },
  useButtonText: { fontFamily: 'Manrope-Bold', fontSize: 11, color: '#fff' },
  chooseTitle: { fontFamily: 'Manrope-Bold', fontSize: 13, color: '#E2E8F0', marginBottom: 10 },
  choices: { gap: 11 },
  choiceCard: { borderRadius: 15, padding: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', gap: 8 },
  choiceHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  choiceLabel: { flex: 1, fontFamily: 'Manrope-Bold', fontSize: 13, color: '#F8FAFC' },
  modifier: { fontFamily: 'Manrope-Bold', fontSize: 17 },
  choiceDescription: { fontFamily: 'Manrope-Regular', fontSize: 12, lineHeight: 18, color: '#94A3B8' },
  choiceFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  choiceFooterLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  chooseChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'transparent',
  },
  chooseChipText: { fontFamily: 'Manrope-SemiBold', fontSize: 10, letterSpacing: 0.6 },
  streakBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(220,100,40,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(220,120,50,0.35)',
  },
  streakBadgeText: { fontFamily: 'Manrope-Bold', fontSize: 10, color: '#E8A060' },
  statLabel: { fontFamily: 'Manrope-Bold', fontSize: 9, letterSpacing: 1 },
  meta: { fontFamily: 'Manrope-Regular', fontSize: 10, color: '#64748B' },
  pressed: { opacity: 0.68, transform: [{ scale: 0.99 }] },
  dieStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 35 },
  choiceRecap: { fontFamily: 'Manrope-Regular', fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  choiceRecapStrong: { fontFamily: 'Manrope-SemiBold', color: '#E2E8F0' },
  die: { width: 140, height: 140, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent.DEFAULT, shadowColor: colors.accent.DEFAULT, shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  dieNumber: { fontFamily: 'Manrope-Bold', fontSize: 48, color: '#fff' },
  rollButton: { minHeight: 50, paddingHorizontal: 30, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent.DEFAULT },
  rollButtonText: { fontFamily: 'Manrope-Bold', fontSize: 14, color: '#fff' },
  rollResult: { alignItems: 'center', gap: 12 },
  rollBreakdown: { fontFamily: 'Manrope-Regular', fontSize: 12, color: '#94A3B8', textAlign: 'center' },
  rollTotal: { fontFamily: 'Manrope-Bold', color: '#F8FAFC' },
  outcomeLabel: { fontFamily: 'Manrope-Bold', fontSize: 20, letterSpacing: 2.5, textAlign: 'center' },
  outcome: { gap: 18, paddingTop: 24 },
  outcomeTitle: { fontFamily: 'Manrope-Bold', fontSize: 21, letterSpacing: 2.5, textAlign: 'center' },
  outcomeNarration: { fontFamily: 'Cormorant-Regular', fontSize: 21, lineHeight: 29, color: '#F8FAFC', textAlign: 'center' },
  damageCard: { alignItems: 'center', gap: 4, borderRadius: 14, padding: 16, backgroundColor: 'rgba(239,68,68,0.07)', borderWidth: 1, borderColor: '#EF4444' },
  damage: { fontFamily: 'Manrope-Bold', fontSize: 28, color: '#EF4444' },
  healCard: { alignItems: 'center', gap: 4, borderRadius: 14, padding: 16, backgroundColor: 'rgba(16,185,129,0.07)', borderWidth: 1, borderColor: '#10B981' },
  heal: { fontFamily: 'Manrope-Bold', fontSize: 28, color: '#10B981' },
  lootCard: { gap: 5, borderRadius: 14, padding: 16, backgroundColor: 'rgba(139,92,246,0.08)', borderWidth: 1, borderColor: '#8B5CF6' },
  lootName: { fontFamily: 'Cormorant-Bold', fontSize: 21, color: '#F8FAFC' },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 13, backgroundColor: 'rgba(212,175,55,0.08)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  milestoneText: { flex: 1, fontFamily: 'Manrope-Regular', fontSize: 12, color: '#E2E8F0' },
  hpWrap: { gap: 7 },
  hpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hpValue: { fontFamily: 'Manrope-Bold', fontSize: 12, color: '#E2E8F0' },
  hpTrack: { height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' },
  hpFill: { height: '100%', borderRadius: 5 },
  resolvedFooter: { alignItems: 'center', gap: 10, paddingVertical: 10 },
  resolvedTitle: { fontFamily: 'Manrope-Bold', fontSize: 15, color: '#F8FAFC', textAlign: 'center' },
  secondaryCenter: { fontFamily: 'Manrope-Regular', fontSize: 12, lineHeight: 18, color: '#94A3B8', textAlign: 'center' },
  footerActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 4 },
  secondaryButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  secondaryButtonText: { fontFamily: 'Manrope-SemiBold', fontSize: 11, color: '#CBD5E1' },
  doneButton: { minHeight: 42, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  doneButtonText: { fontFamily: 'Manrope-Bold', fontSize: 12, color: '#0C1320' },
  resolvedCard: { alignItems: 'center', gap: 10, padding: 22, borderRadius: 16, backgroundColor: 'rgba(14,150,150,0.08)', borderWidth: 1, borderColor: 'rgba(14,150,150,0.25)', marginTop: 25 },
  errorText: { fontFamily: 'Manrope-Regular', fontSize: 12, color: '#F87171', textAlign: 'center' },
  retryButton: { minHeight: 44, paddingHorizontal: 20, borderRadius: 10, backgroundColor: colors.accent.DEFAULT, justifyContent: 'center' },
  retryText: { fontFamily: 'Manrope-Bold', fontSize: 13, color: '#fff' },
  quickNav: { position: 'absolute', left: 12, right: 12, bottom: 8, minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: 'rgba(15,23,42,0.97)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  quickNavButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  quickNavText: { fontFamily: 'Manrope-Regular', fontSize: 9, color: '#94A3B8' },
});
