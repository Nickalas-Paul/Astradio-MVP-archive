import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../constants/colors';
import { getClassDisplay } from '../../lib/class-display';
import { getElementTheme } from '../../lib/game/element-themes';
import type { DungeonTheme } from '../../lib/game/dungeon-themes';
import { rarityColor } from '../../lib/rarity-colors';
import {
  discardItem,
  equipItem,
  fetchLootTable,
  gameErrorMessage,
  unequipItem,
  useConsumable,
  type CharacterResponse,
  type InventoryItem,
  type InventoryResponse,
  type LootTableResponse,
  type StatBlock,
} from '../../lib/game-api';

export type CampaignSheetTab = 'character' | 'inventory' | 'loot';

type Props = {
  campaignId: string;
  visible: boolean;
  tab: CampaignSheetTab;
  onTabChange: (tab: CampaignSheetTab) => void;
  onClose: () => void;
  character: CharacterResponse | null;
  inventory: InventoryResponse | null;
  dungeon?: DungeonTheme | null;
  onInventoryChange: (inventory: InventoryResponse) => void;
  onStateRefresh: () => Promise<void>;
};

const STAT_KEYS: (keyof StatBlock)[] = [
  'vitality',
  'resilience',
  'cunning',
  'charm',
  'intuition',
  'willpower',
];

function slotLabel(slot: string): string {
  return slot.replace(/_/g, ' ');
}

function CharacterTab({
  character,
  inventory,
}: {
  character: CharacterResponse | null;
  inventory: InventoryResponse | null;
}) {
  if (!character) return <ActivityIndicator color={colors.accent.DEFAULT} style={styles.loader} />;
  const display = getClassDisplay(character.classSlug, character.subclassSlug, character.risingSlug);
  const classElement = display.element;
  const elementTheme = getElementTheme(classElement);
  const buffs = character.activeBuffs ?? [];
  const relic = inventory?.equipped?.relic ?? null;

  return (
    <View style={styles.sectionStack}>
      <View style={styles.identityHeader}>
        <View
          style={[
            styles.classIcon,
            {
              backgroundColor: elementTheme.badgeColor,
              borderColor: elementTheme.badgeBorder,
            },
          ]}
        >
          <Text style={[styles.classIconText, { color: elementTheme.badgeTextColor }]}>
            {display.classInitial}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.className}>{display.className}</Text>
          <Text style={styles.secondary}>{display.role}</Text>
        </View>
      </View>

      <View style={styles.identityRow}>
        <View
          style={[
            styles.identityCard,
            {
              backgroundColor: elementTheme.badgeColor,
              borderColor: elementTheme.badgeBorder,
            },
          ]}
        >
          <Text style={[styles.micro, { color: elementTheme.badgeTextColor }]}>ELEMENT</Text>
          <Text style={[styles.identityName, { color: elementTheme.badgeTextColor }]}>
            {classElement}
          </Text>
          <Text style={styles.meta}>{display.sunSign}</Text>
        </View>
        <View
          style={[
            styles.identityCard,
            {
              backgroundColor: elementTheme.badgeColor,
              borderColor: elementTheme.badgeBorder,
            },
          ]}
        >
          <Text style={[styles.micro, { color: elementTheme.badgeTextColor }]}>RISING</Text>
          <Text style={[styles.identityName, { color: elementTheme.badgeTextColor }]}>
            {display.risingName}
          </Text>
          <Text style={styles.meta}>{display.risingSign} ascendant</Text>
        </View>
      </View>

      <Text style={[styles.summary, { color: elementTheme.badgeTextColor }]}>
        {display.sunSign === display.moonSign
          ? `Double ${display.sunSign} core with ${display.risingSign} rising. ${display.role}.`
          : `${display.sunSign} core, ${display.moonSign} instincts, ${display.risingSign} rising. ${display.role}.`}
      </Text>

      {buffs.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.sectionTitle}>ACTIVE EFFECTS</Text>
          {buffs.map((buff, index) => (
            <View key={`${buff.stat}-${index}`} style={styles.effectCard}>
              <View style={styles.effectDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.effectName}>
                  {buff.stat.charAt(0).toUpperCase() + buff.stat.slice(1)} Boost
                </Text>
                <Text style={styles.meta}>
                  {buff.magnitude >= 0 ? '+' : ''}
                  {buff.magnitude} {buff.stat}
                  {buff.source ? ` · ${buff.source}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>COMBAT STATS</Text>
      {STAT_KEYS.map((key) => {
        const base = character.baseStats[key] ?? 0;
        const effective = character.effectiveStats[key] ?? base;
        const bonus = character.effectiveStats.bonuses?.[key] ?? 0;
        return (
          <View key={key} style={styles.statBlock}>
            <View style={styles.statHeader}>
              <Text style={styles.statName}>{key}</Text>
              <Text style={styles.statValue}>
                {bonus ? <Text style={styles.bonus}>+{bonus} </Text> : null}
                {effective}
                {effective !== base ? <Text style={styles.meta}> (base {base})</Text> : null}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: elementTheme.statBarBg }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.max(0, Math.min(100, (effective / 20) * 100))}%`,
                    backgroundColor: elementTheme.statBarColor,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>EQUIPPED RELICS</Text>
      {relic ? (
        <View
          style={[
            styles.relicCard,
            {
              borderColor: rarityColor(relic.rarity).glow,
              backgroundColor: rarityColor(relic.rarity).bg,
            },
          ]}
        >
          <View style={[styles.relicIcon, { borderColor: rarityColor(relic.rarity).border }]}>
            <Text style={{ color: rarityColor(relic.rarity).label }}>☿</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.effectName, { color: rarityColor(relic.rarity).label }]}>
              {relic.name}
            </Text>
            <Text style={styles.meta}>
              {relic.rarity}
              {Object.entries(relic.statModifiers || {})
                .filter(([, v]) => v)
                .map(([k, v]) => ` · +${v} ${k}`)
                .join('')}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.meta}>No relic equipped.</Text>
      )}

      <Text style={styles.sectionTitle}>TEMPERAMENT</Text>
      {Object.entries(character.temperament || {}).map(([key, raw]) => {
        const value = Math.max(0, Math.min(1, Number(raw) || 0));
        return (
          <View key={key} style={styles.temperamentRow}>
            <Text style={styles.temperamentName}>{key}</Text>
            <View style={[styles.track, styles.temperamentTrack]}>
              <View style={[styles.fill, { width: `${value * 100}%`, backgroundColor: colors.accent.DEFAULT }]} />
            </View>
            <Text style={styles.meta}>{Math.round(value * 100)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function InventoryTab({
  campaignId,
  inventory,
  onChange,
  onStateRefresh,
}: {
  campaignId: string;
  inventory: InventoryResponse | null;
  onChange: (inventory: InventoryResponse) => void;
  onStateRefresh: () => Promise<void>;
}) {
  const [selectedBagItem, setSelectedBagItem] = useState<InventoryItem | null>(null);
  const [selectedEquipSlot, setSelectedEquipSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slots = ['weapon', 'armor', 'consumable_1', 'accessory', 'consumable_2', 'relic'];

  const clearSelection = useCallback(() => {
    setSelectedBagItem(null);
    setSelectedEquipSlot(null);
  }, []);

  const mutate = useCallback(async (operation: () => Promise<InventoryResponse>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await operation();
      onChange(next);
      clearSelection();
    } catch (err) {
      setError(gameErrorMessage(err, 'Inventory action failed.'));
    } finally {
      setBusy(false);
    }
  }, [clearSelection, onChange]);

  if (!inventory) return <ActivityIndicator color={colors.accent.DEFAULT} style={styles.loader} />;

  const equippedDetail = selectedEquipSlot
    ? inventory.equipped?.[selectedEquipSlot] ?? null
    : null;
  const bagRc = selectedBagItem ? rarityColor(selectedBagItem.rarity) : null;

  return (
    <View style={styles.sectionStack}>
      <Text style={styles.sectionTitle}>EQUIPPED</Text>
      <View style={styles.slotGrid}>
        {slots.map((slot) => {
          const item = inventory.equipped?.[slot] ?? null;
          const unlocked =
            inventory.slotsUnlocked.includes(slot) ||
            (slot === 'consumable_1' && inventory.slotsUnlocked.includes('consumable'));
          const rc = item ? rarityColor(item.rarity) : null;
          const selected = selectedEquipSlot === slot;
          const slotStyle = item && rc
            ? {
                borderColor: rc.border,
                backgroundColor: rc.bg,
                borderWidth: 1.5,
                shadowColor: rc.border,
                shadowRadius: 6,
                shadowOpacity: 0.4,
                shadowOffset: { width: 0, height: 0 },
                elevation: 3,
                opacity: 1,
              }
            : unlocked
              ? {
                  borderColor: 'rgba(255,255,255,0.2)',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderWidth: 1,
                  borderStyle: 'dashed' as const,
                  opacity: 1,
                }
              : {
                  borderColor: 'rgba(255,255,255,0.05)',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  borderWidth: 1,
                  opacity: 0.35,
                };

          return (
            <Pressable
              key={slot}
              disabled={!unlocked || busy}
              onPress={() => {
                setSelectedEquipSlot(slot);
                setSelectedBagItem(null);
              }}
              style={[
                styles.slot,
                slotStyle,
                selected ? { borderColor: rc?.border ?? colors.accent.DEFAULT } : null,
              ]}
            >
              <Ionicons
                name={
                  !unlocked
                    ? 'lock-closed-outline'
                    : item
                      ? 'diamond-outline'
                      : 'add-circle-outline'
                }
                size={18}
                color={item && rc ? rc.label : '#64748B'}
              />
              <Text numberOfLines={2} style={styles.slotText}>
                {item?.name ?? (unlocked ? slotLabel(slot) : 'Locked')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedEquipSlot ? (
        equippedDetail ? (
          <View
            style={[
              styles.detailCard,
              {
                borderColor: rarityColor(equippedDetail.rarity).border,
                backgroundColor: rarityColor(equippedDetail.rarity).bg,
              },
            ]}
          >
            <Text
              style={[
                styles.identityName,
                { color: rarityColor(equippedDetail.rarity).label },
              ]}
            >
              {equippedDetail.name}
            </Text>
            <Text style={styles.meta}>
              <Text style={{ color: rarityColor(equippedDetail.rarity).label }}>
                {equippedDetail.rarity}
              </Text>
              {' · '}
              {equippedDetail.category}
            </Text>
            {equippedDetail.description ? (
              <Text style={styles.secondary}>{equippedDetail.description}</Text>
            ) : null}
            <View style={styles.chips}>
              {Object.entries(equippedDetail.statModifiers || {}).map(([key, value]) => (
                <View
                  key={key}
                  style={[
                    styles.chipWrap,
                    { borderColor: rarityColor(equippedDetail.rarity).border },
                  ]}
                >
                  <Text style={styles.chip}>+{value} {key}</Text>
                </View>
              ))}
            </View>
            <View style={styles.actionRow}>
              <Pressable
                disabled={busy}
                style={[styles.smallButton, styles.unequipButton]}
                onPress={() => {
                  void mutate(() => unequipItem(campaignId, selectedEquipSlot));
                }}
              >
                <Text style={styles.smallButtonText}>Unequip</Text>
              </Pressable>
              <Pressable
                style={[styles.smallButton, styles.closeActionButton]}
                onPress={() => setSelectedEquipSlot(null)}
              >
                <Text style={styles.closeActionText}>Close</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.detailCard}>
            <Text style={styles.identityName}>{slotLabel(selectedEquipSlot)} slot</Text>
            <Text style={styles.secondary}>
              Nothing equipped. Check your bag for items to equip.
            </Text>
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.smallButton, styles.closeActionButton]}
                onPress={() => setSelectedEquipSlot(null)}
              >
                <Text style={styles.closeActionText}>Close</Text>
              </Pressable>
            </View>
          </View>
        )
      ) : null}

      <View style={styles.bagHeader}>
        <Text style={styles.sectionTitle}>BAG</Text>
        <Text style={styles.meta}>{inventory.bagUsed} / {inventory.maxBagSize}</Text>
      </View>
      <View style={styles.bagGrid}>
        {inventory.bag.map((item) => {
          const rc = rarityColor(item.rarity);
          const isSelected = selectedBagItem?.instanceId === item.instanceId;
          return (
            <Pressable
              key={item.instanceId}
              onPress={() => {
                setSelectedBagItem(item);
                setSelectedEquipSlot(null);
              }}
              style={[
                styles.bagItem,
                {
                  borderWidth: isSelected ? 1.5 : 0,
                  borderColor: isSelected ? rc.border : 'transparent',
                  borderLeftWidth: 3,
                  borderLeftColor: rc.border,
                  backgroundColor: rc.bg,
                },
              ]}
            >
              <Ionicons name="cube-outline" size={18} color={rc.label} />
              <Text numberOfLines={2} style={styles.bagItemName}>{item.name}</Text>
              <Text style={[styles.rarityDot, { color: rc.label }]}>{item.rarity}</Text>
            </Pressable>
          );
        })}
      </View>

      {selectedBagItem && bagRc ? (
        <View
          style={[
            styles.detailCard,
            {
              borderColor: bagRc.border,
              backgroundColor: bagRc.bg,
            },
          ]}
        >
          <Text style={[styles.identityName, { color: bagRc.label }]}>
            {selectedBagItem.name}
          </Text>
          <Text style={styles.meta}>
            <Text style={{ color: bagRc.label }}>{selectedBagItem.rarity}</Text>
            {' · '}
            {selectedBagItem.category}
          </Text>
          <Text style={styles.secondary}>{selectedBagItem.description}</Text>
          <View style={styles.chips}>
            {Object.entries(selectedBagItem.statModifiers || {}).map(([key, value]) => (
              <View key={key} style={[styles.chipWrap, { borderColor: bagRc.border }]}>
                <Text style={styles.chip}>+{value} {key}</Text>
              </View>
            ))}
          </View>
          <View style={styles.actionRow}>
            {!selectedBagItem.equipped ? (
              <Pressable
                disabled={busy}
                style={styles.smallButton}
                onPress={() => void mutate(() => equipItem(campaignId, selectedBagItem.instanceId))}
              >
                <Text style={styles.smallButtonText}>Equip</Text>
              </Pressable>
            ) : null}
            {selectedBagItem.category === 'consumable' && selectedBagItem.equipped ? (
              <Pressable
                disabled={busy}
                style={styles.smallButton}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await useConsumable(campaignId, selectedBagItem.instanceId);
                    await onStateRefresh();
                    clearSelection();
                  } catch (err) {
                    setError(gameErrorMessage(err, 'Could not use item.'));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Text style={styles.smallButtonText}>Use</Text>
              </Pressable>
            ) : null}
            {!selectedBagItem.equipped ? (
              <Pressable
                disabled={busy}
                style={[styles.smallButton, styles.dangerButton]}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await discardItem(campaignId, selectedBagItem.instanceId);
                    await onStateRefresh();
                    clearSelection();
                  } catch (err) {
                    setError(gameErrorMessage(err, 'Could not discard item.'));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Text style={styles.dangerText}>Discard</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function LootTab({ campaignId }: { campaignId: string }) {
  const [table, setTable] = useState<LootTableResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchLootTable(campaignId).then(setTable).catch((err) => setError(gameErrorMessage(err, 'Could not load loot.')));
  }, [campaignId]);
  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!table) return <ActivityIndicator color={colors.accent.DEFAULT} style={styles.loader} />;
  return (
    <View style={styles.sectionStack}>
      <Text style={styles.className}>{table.label}</Text>
      <Text style={styles.secondary}>Items available in this dungeon</Text>
      {table.items.map((item) => (
        <View key={item.slug} style={styles.lootRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.identityName}>{item.name}</Text>
            <Text style={styles.meta}>{item.category}</Text>
          </View>
          <Text style={[styles.rarity, { color: rarityColor(item.rarity).label }]}>{item.rarity}</Text>
        </View>
      ))}
      {table.relicReward ? (
        <View style={[styles.detailCard, { borderColor: '#8B5CF6' }]}>
          <Text style={[styles.micro, { color: '#A78BFA' }]}>CHAPTER COMPLETION REWARD</Text>
          <Text style={styles.identityName}>{table.relicReward.name}</Text>
          <Text style={styles.secondary}>{table.relicReward.description}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function CampaignSheet(props: Props) {
  const tabs: CampaignSheetTab[] = ['character', 'inventory', 'loot'];
  const display = useMemo(
    () => props.character
      ? getClassDisplay(props.character.classSlug, props.character.subclassSlug, props.character.risingSlug)
      : null,
    [props.character],
  );
  const accent = props.dungeon?.accent ?? colors.accent.DEFAULT;
  const textAccent = props.dungeon?.textAccent ?? colors.accent.DEFAULT;
  return (
    <Modal visible={props.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>{display?.className ?? 'Character'}</Text>
            <Text style={styles.meta}>Campaign Loadout</Text>
          </View>
          <Pressable onPress={props.onClose} style={styles.closeButton}>
            <Ionicons name="close" size={22} color="#CBD5E1" />
          </Pressable>
        </View>
        <View style={styles.tabs}>
          {tabs.map((tab) => {
            const active = props.tab === tab;
            return (
              <Pressable key={tab} onPress={() => props.onTabChange(tab)} style={styles.tab}>
                <Text style={[styles.tabText, active && { color: textAccent }]}>
                  {tab === 'loot' ? 'Loot Table' : tab[0]!.toUpperCase() + tab.slice(1)}
                </Text>
                {active ? <View style={[styles.tabLine, { backgroundColor: accent }]} /> : null}
              </Pressable>
            );
          })}
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {props.tab === 'character' ? (
            <CharacterTab character={props.character} inventory={props.inventory} />
          ) : null}
          {props.tab === 'inventory' ? (
            <InventoryTab
              campaignId={props.campaignId}
              inventory={props.inventory}
              onChange={props.onInventoryChange}
              onStateRefresh={props.onStateRefresh}
            />
          ) : null}
          {props.tab === 'loot' ? <LootTab campaignId={props.campaignId} /> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#0F172A' },
  modalHeader: {
    paddingTop: 18, paddingHorizontal: 18, paddingBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: { fontFamily: 'Cormorant-Bold', fontSize: 24, color: '#F8FAFC' },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabText: { fontFamily: 'Manrope-SemiBold', fontSize: 12, color: '#64748B' },
  tabTextActive: { color: colors.accent.DEFAULT },
  tabLine: { position: 'absolute', bottom: 0, height: 2, width: '70%' },
  scrollContent: { padding: 18, paddingBottom: 50 },
  sectionStack: { gap: 14 },
  loader: { marginTop: 50 },
  identityHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  classIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classIconText: { fontFamily: 'Manrope-Bold', fontSize: 13 },
  className: { fontFamily: 'Cormorant-Bold', fontSize: 24, color: '#F8FAFC' },
  secondary: { fontFamily: 'Manrope-Regular', fontSize: 13, lineHeight: 19, color: '#94A3B8' },
  micro: { fontFamily: 'Manrope-Bold', fontSize: 9, letterSpacing: 1.3, color: '#64748B' },
  meta: { fontFamily: 'Manrope-Regular', fontSize: 10, color: '#64748B' },
  identityRow: { flexDirection: 'row', gap: 10 },
  identityCard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 3 },
  identityName: { fontFamily: 'Cormorant-SemiBold', fontSize: 16, color: '#F8FAFC' },
  summary: { fontFamily: 'Cormorant-Italic', fontSize: 16, color: '#CBD5E1' },
  sectionTitle: { fontFamily: 'Manrope-Bold', fontSize: 10, letterSpacing: 1.4, color: '#64748B' },
  effectCard: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(90,170,120,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(90,170,120,0.12)',
    alignItems: 'flex-start',
  },
  effectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    backgroundColor: '#5aaa78',
  },
  effectName: { fontFamily: 'Manrope-SemiBold', fontSize: 11, color: 'rgba(160,210,175,0.95)' },
  relicCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  relicIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBlock: { gap: 5 },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  statName: { fontFamily: 'Manrope-Regular', fontSize: 12, textTransform: 'capitalize', color: '#CBD5E1' },
  statValue: { fontFamily: 'Manrope-Bold', fontSize: 14, color: '#F8FAFC' },
  bonus: { color: '#10B981' },
  track: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  temperamentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  temperamentName: { width: 100, fontFamily: 'Manrope-Regular', fontSize: 10, textTransform: 'capitalize', color: '#94A3B8' },
  temperamentTrack: { flex: 1, height: 4 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '31%', minHeight: 82, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 8, gap: 5, backgroundColor: 'rgba(255,255,255,0.03)' },
  slotText: { fontFamily: 'Manrope-Regular', fontSize: 9, textAlign: 'center', textTransform: 'capitalize', color: '#94A3B8' },
  bagHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bagItem: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
    gap: 3,
    overflow: 'hidden',
  },
  bagItemName: { fontFamily: 'Manrope-Regular', fontSize: 8, lineHeight: 10, textAlign: 'center', color: '#CBD5E1' },
  rarityDot: { fontFamily: 'Manrope-Bold', fontSize: 7, textTransform: 'uppercase', textAlign: 'center' },
  detailCard: { borderRadius: 14, borderWidth: 1, padding: 14, backgroundColor: 'rgba(255,255,255,0.04)', gap: 7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chipWrap: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  chip: { fontFamily: 'Manrope-SemiBold', fontSize: 9, color: '#10B981' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  smallButton: { minHeight: 38, paddingHorizontal: 15, borderRadius: 9, backgroundColor: colors.accent.DEFAULT, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { fontFamily: 'Manrope-SemiBold', fontSize: 12, color: '#fff' },
  unequipButton: { backgroundColor: 'rgba(239,68,68,0.85)' },
  closeActionButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  closeActionText: { fontFamily: 'Manrope-SemiBold', fontSize: 12, color: '#CBD5E1' },
  dangerButton: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  dangerText: { fontFamily: 'Manrope-SemiBold', fontSize: 12, color: '#F87171' },
  error: { fontFamily: 'Manrope-Regular', fontSize: 12, color: '#F87171', textAlign: 'center', marginVertical: 16 },
  lootRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)' },
  rarity: { fontFamily: 'Manrope-Bold', fontSize: 9, textTransform: 'uppercase' },
});
