import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { DungeonTheme } from '../../lib/game/dungeon-themes';

type Props = {
  campaignId: string;
  dungeon: DungeonTheme;
  onOpenInventory: () => void;
  onOpenCharacter: () => void;
  onOpenLoot: () => void;
};

export function CampaignQuickLinks({
  campaignId,
  dungeon,
  onOpenInventory,
  onOpenCharacter,
  onOpenLoot,
}: Props) {
  const router = useRouter();
  const openCodex = () => {
    router.push({
      pathname: '/campaign/codex/[campaignId]' as never,
      params: { campaignId, house: String(dungeon.house) },
    });
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onOpenInventory}
        style={[styles.button, { borderColor: dungeon.accent }]}
      >
        <Text style={[styles.label, { color: dungeon.textAccent }]}>Inventory</Text>
      </Pressable>
      <Pressable
        onPress={onOpenCharacter}
        style={[styles.button, { borderColor: dungeon.accent }]}
      >
        <Text style={[styles.label, { color: dungeon.textAccent }]}>Character</Text>
      </Pressable>
      <Pressable onPress={onOpenLoot} style={[styles.button, { borderColor: dungeon.accent }]}>
        <Text style={[styles.label, { color: dungeon.textAccent }]}>Loot Table</Text>
      </Pressable>
      <Pressable onPress={openCodex} style={[styles.button, { borderColor: dungeon.accent }]}>
        <Text style={[styles.label, { color: dungeon.textAccent }]}>Dungeon Codex</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  button: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  label: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 10,
  },
});
