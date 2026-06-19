import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import type { CommunitySubTabId } from '../../constants/community-constants';

type CommunitySubTabsProps = {
  activeTab: CommunitySubTabId;
  onTabChange: (tab: CommunitySubTabId) => void;
  tabs: { id: CommunitySubTabId; label: string }[];
};

export function CommunitySubTabs({ activeTab, onTabChange, tabs }: CommunitySubTabsProps) {
  return (
    <View style={styles.row}>
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
            <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  pillActive: {
    backgroundColor: colors.accent.DEFAULT,
    borderColor: colors.accent.DEFAULT,
  },
  pillText: {
    color: colors.text.secondary,
    fontSize: 11,
    fontFamily: 'Manrope-Medium',
    textAlign: 'center',
  },
  pillTextActive: {
    color: colors.text.primary,
    fontFamily: 'Manrope-SemiBold',
  },
  pressed: {
    opacity: 0.85,
  },
});
