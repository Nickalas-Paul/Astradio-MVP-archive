import { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getDungeonTheme } from '../../lib/game/dungeon-themes';

export type ChapterTransitionChapter = {
  house: number;
  domain: string;
  label: string;
};

export type ChapterTransitionRelic = {
  name: string;
  description: string;
  rarity?: string;
  statModifiers?: Record<string, number>;
} | null;

type Props = {
  show: boolean;
  oldChapter: ChapterTransitionChapter;
  newChapter: ChapterTransitionChapter;
  relicReward?: ChapterTransitionRelic;
  onDismiss: () => void;
};

function rarityBorder(rarity?: string) {
  const key = (rarity || '').toLowerCase();
  if (key === 'legendary') return '#8B5CF6';
  if (key === 'rare') return '#3B82F6';
  if (key === 'uncommon') return '#10B981';
  return '#6B7280';
}

/**
 * Minimal full-screen chapter change overlay (fade + text + optional relic).
 */
export function ChapterTransition({
  show,
  oldChapter,
  newChapter,
  relicReward,
  onDismiss,
}: Props) {
  const oldOpacity = useRef(new Animated.Value(1)).current;
  const newOpacity = useRef(new Animated.Value(0)).current;
  const newTheme = getDungeonTheme(newChapter.house);
  const border = rarityBorder(relicReward?.rarity);

  useEffect(() => {
    if (!show) return;
    oldOpacity.setValue(1);
    newOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(oldOpacity, {
        toValue: 0,
        duration: 700,
        delay: 400,
        useNativeDriver: true,
      }),
      Animated.timing(newOpacity, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
    ]).start();
  }, [show, oldOpacity, newOpacity]);

  return (
    <Modal visible={show} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={styles.root}>
        <LinearGradient colors={newTheme.gradient} style={StyleSheet.absoluteFill} />
        <View style={styles.content}>
          <Animated.Text style={[styles.oldLabel, { opacity: oldOpacity }]}>
            {oldChapter.label}
          </Animated.Text>
          <Animated.View style={{ opacity: newOpacity, alignItems: 'center', gap: 10 }}>
            <Text style={[styles.newLabel, { color: newTheme.textAccent }]}>
              {newChapter.label}
            </Text>
            <Text style={styles.domain}>
              A new chapter begins in house {newChapter.house} — the domain of{' '}
              {newChapter.domain}.
            </Text>
            {relicReward ? (
              <View style={[styles.relicCard, { borderColor: border }]}>
                <Text style={styles.relicEyebrow}>CHAPTER RELIC</Text>
                <Text style={[styles.relicName, { color: border }]}>{relicReward.name}</Text>
                <Text style={styles.relicDesc}>{relicReward.description}</Text>
                {relicReward.rarity ? (
                  <Text style={[styles.relicRarity, { color: border }]}>
                    {relicReward.rarity}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Pressable
              onPress={onDismiss}
              style={[styles.continueBtn, { backgroundColor: newTheme.accent }]}
            >
              <Text style={styles.continueText}>Continue</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 28,
  },
  oldLabel: {
    fontFamily: 'Cormorant-SemiBold',
    fontSize: 26,
    color: '#64748B',
    textAlign: 'center',
  },
  newLabel: {
    fontFamily: 'Cormorant-Bold',
    fontSize: 32,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  domain: {
    fontFamily: 'Manrope-Regular',
    fontSize: 13,
    lineHeight: 20,
    color: '#94A3B8',
    textAlign: 'center',
  },
  relicCard: {
    width: '100%',
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 6,
  },
  relicEyebrow: {
    fontFamily: 'Manrope-Bold',
    fontSize: 9,
    letterSpacing: 1.4,
    color: '#64748B',
  },
  relicName: {
    fontFamily: 'Cormorant-Bold',
    fontSize: 22,
  },
  relicDesc: {
    fontFamily: 'Manrope-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#CBD5E1',
  },
  relicRarity: {
    fontFamily: 'Manrope-Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  continueBtn: {
    marginTop: 18,
    minHeight: 48,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 14,
    color: '#0C1320',
  },
});
