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

function statColor(value: number) {
  if (value >= 14) return '#10B981';
  if (value >= 8) return '#F59E0B';
  return '#EF4444';
}

function rarityColor(rarity = '') {
  if (rarity.toLowerCase() === 'legendary') return '#8B5CF6';
  if (rarity.toLowerCase() === 'rare') return '#3B82F6';
  if (rarity.toLowerCase() === 'uncommon') return '#10B981';
  return '#6B7280';
}

function CharacterTab({ character }: { character: CharacterResponse | null }) {
  if (!character) return <ActivityIndicator color={colors.accent.DEFAULT} style={styles.loader} />;
  const display = getClassDisplay(character.classSlug, character.subclassSlug, character.risingSlug);
  return (
    <View style={styles.sectionStack}>
      <View>
        <Text style={styles.className}>{display.className}</Text>
        <Text style={styles.secondary}>{display.role}</Text>
      </View>
      <View style={styles.identityRow}>
        <View style={styles.identityCard}>
          <Text style={styles.micro}>SUBCLASS</Text>
          <Text style={styles.identityName}>{display.subclassName}</Text>
          <Text style={styles.meta}>Moon in {display.moonSign}</Text>
        </View>
        <View style={styles.identityCard}>
          <Text style={styles.micro}>RISING</Text>
          <Text style={styles.identityName}>{display.risingName}</Text>
          <Text style={styles.meta}>{display.risingSign} ascendant</Text>
        </View>
      </View>
      <Text style={styles.summary}>
        {display.sunSign === display.moonSign
          ? `Double ${display.sunSign} core with ${display.risingSign} rising.`
          : `${display.sunSign} core, ${display.moonSign} instincts, ${display.risingSign} rising.`}
      </Text>
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
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.max(0, Math.min(100, (effective / 20) * 100))}%`,
                    backgroundColor: statColor(effective),
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
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
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slots = ['weapon', 'armor', 'consumable_1', 'accessory', 'consumable_2', 'relic'];

  const mutate = useCallback(async (operation: () => Promise<InventoryResponse>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await operation();
      onChange(next);
      setSelected(null);
    } catch (err) {
      setError(gameErrorMessage(err, 'Inventory action failed.'));
    } finally {
      setBusy(false);
    }
  }, [onChange]);

  if (!inventory) return <ActivityIndicator color={colors.accent.DEFAULT} style={styles.loader} />;

  return (
    <View style={styles.sectionStack}>
      <Text style={styles.sectionTitle}>EQUIPPED</Text>
      <View style={styles.slotGrid}>
        {slots.map((slot) => {
          const item = inventory.equipped?.[slot] ?? null;
          const unlocked =
            inventory.slotsUnlocked.includes(slot) ||
            (slot === 'consumable_1' && inventory.slotsUnlocked.includes('consumable'));
          return (
            <Pressable
              key={slot}
              disabled={!item || busy}
              onPress={() => void mutate(() => unequipItem(campaignId, slot))}
              style={[
                styles.slot,
                {
                  borderColor: item
                    ? rarityColor(item.rarity)
                    : unlocked
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(255,255,255,0.05)',
                  opacity: unlocked ? 1 : 0.45,
                },
              ]}
            >
              <Ionicons
                name={unlocked ? 'diamond-outline' : 'lock-closed-outline'}
                size={18}
                color={item ? rarityColor(item.rarity) : '#64748B'}
              />
              <Text numberOfLines={2} style={styles.slotText}>
                {item?.name ?? (unlocked ? slot.replace('_', ' ') : 'Locked')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.bagHeader}>
        <Text style={styles.sectionTitle}>BAG</Text>
        <Text style={styles.meta}>{inventory.bagUsed} / {inventory.maxBagSize}</Text>
      </View>
      <View style={styles.bagGrid}>
        {inventory.bag.map((item) => (
          <Pressable
            key={item.instanceId}
            onPress={() => setSelected(item)}
            style={[styles.bagItem, { borderColor: rarityColor(item.rarity) }]}
          >
            <Ionicons name="cube-outline" size={20} color={rarityColor(item.rarity)} />
            <Text numberOfLines={2} style={styles.bagItemName}>{item.name}</Text>
          </Pressable>
        ))}
      </View>

      {selected ? (
        <View style={[styles.detailCard, { borderColor: rarityColor(selected.rarity) }]}>
          <Text style={[styles.identityName, { color: rarityColor(selected.rarity) }]}>
            {selected.name}
          </Text>
          <Text style={styles.meta}>{selected.rarity} · {selected.category}</Text>
          <Text style={styles.secondary}>{selected.description}</Text>
          <View style={styles.chips}>
            {Object.entries(selected.statModifiers || {}).map(([key, value]) => (
              <Text key={key} style={styles.chip}>+{value} {key}</Text>
            ))}
          </View>
          <View style={styles.actionRow}>
            {!selected.equipped ? (
              <Pressable
                disabled={busy}
                style={styles.smallButton}
                onPress={() => void mutate(() => equipItem(campaignId, selected.instanceId))}
              >
                <Text style={styles.smallButtonText}>Equip</Text>
              </Pressable>
            ) : null}
            {selected.category === 'consumable' && selected.equipped ? (
              <Pressable
                disabled={busy}
                style={styles.smallButton}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await useConsumable(campaignId, selected.instanceId);
                    await onStateRefresh();
                    setSelected(null);
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
            {!selected.equipped ? (
              <Pressable
                disabled={busy}
                style={[styles.smallButton, styles.dangerButton]}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await discardItem(campaignId, selected.instanceId);
                    await onStateRefresh();
                    setSelected(null);
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
          <Text style={[styles.rarity, { color: rarityColor(item.rarity) }]}>{item.rarity}</Text>
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
          {tabs.map((tab) => (
            <Pressable key={tab} onPress={() => props.onTabChange(tab)} style={styles.tab}>
              <Text style={[styles.tabText, props.tab === tab && styles.tabTextActive]}>
                {tab === 'loot' ? 'Loot Table' : tab[0]!.toUpperCase() + tab.slice(1)}
              </Text>
              {props.tab === tab ? <View style={styles.tabLine} /> : null}
            </Pressable>
          ))}
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {props.tab === 'character' ? <CharacterTab character={props.character} /> : null}
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
  tabLine: { position: 'absolute', bottom: 0, height: 2, width: '70%', backgroundColor: colors.accent.DEFAULT },
  scrollContent: { padding: 18, paddingBottom: 50 },
  sectionStack: { gap: 14 },
  loader: { marginTop: 50 },
  className: { fontFamily: 'Cormorant-Bold', fontSize: 24, color: '#F8FAFC' },
  secondary: { fontFamily: 'Manrope-Regular', fontSize: 13, lineHeight: 19, color: '#94A3B8' },
  micro: { fontFamily: 'Manrope-Bold', fontSize: 9, letterSpacing: 1.3, color: '#64748B' },
  meta: { fontFamily: 'Manrope-Regular', fontSize: 10, color: '#64748B' },
  identityRow: { flexDirection: 'row', gap: 10 },
  identityCard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 3 },
  identityName: { fontFamily: 'Cormorant-SemiBold', fontSize: 16, color: '#F8FAFC' },
  summary: { fontFamily: 'Cormorant-Italic', fontSize: 16, color: '#CBD5E1' },
  sectionTitle: { fontFamily: 'Manrope-Bold', fontSize: 10, letterSpacing: 1.4, color: '#64748B' },
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
  bagItem: { width: '23%', aspectRatio: 1, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 5, gap: 4, backgroundColor: 'rgba(255,255,255,0.03)' },
  bagItemName: { fontFamily: 'Manrope-Regular', fontSize: 8, lineHeight: 10, textAlign: 'center', color: '#CBD5E1' },
  detailCard: { borderRadius: 14, borderWidth: 1, padding: 14, backgroundColor: 'rgba(255,255,255,0.04)', gap: 7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: { fontFamily: 'Manrope-SemiBold', fontSize: 9, color: '#10B981', backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  smallButton: { minHeight: 38, paddingHorizontal: 15, borderRadius: 9, backgroundColor: colors.accent.DEFAULT, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { fontFamily: 'Manrope-SemiBold', fontSize: 12, color: '#fff' },
  dangerButton: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  dangerText: { fontFamily: 'Manrope-SemiBold', fontSize: 12, color: '#F87171' },
  error: { fontFamily: 'Manrope-Regular', fontSize: 12, color: '#F87171', textAlign: 'center', marginVertical: 16 },
  lootRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)' },
  rarity: { fontFamily: 'Manrope-Bold', fontSize: 9, textTransform: 'uppercase' },
});
