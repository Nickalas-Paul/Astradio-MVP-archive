import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import type { CommunitySubTabId } from '../../constants/community-constants';

type CommunitySubTabsProps = {
  activeTab: CommunitySubTabId;
  onTabChange: (tab: CommunitySubTabId) => void;
  tabs: { id: CommunitySubTabId; label: string }[];
};

export function CommunitySubTabs({ activeTab, onTabChange, tabs }: CommunitySubTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.track}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onTabChange(tab.id)}
            style={({ pressed }) => [
              styles.pill,
              active && styles.pillActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.accent.DEFAULT,
    borderColor: colors.accent.DEFAULT,
  },
  pillText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
  },
  pillTextActive: {
    color: colors.text.primary,
    fontFamily: 'Manrope-SemiBold',
  },
  pressed: {
    opacity: 0.85,
  },
});
