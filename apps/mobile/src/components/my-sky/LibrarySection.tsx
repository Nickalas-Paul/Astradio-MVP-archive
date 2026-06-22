import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../constants/colors';
import { layout } from '../../constants/layout';
import { groupLibraryRows, type MobileLibraryItem } from '../../lib/library-groups';

type LibrarySectionProps = {
  items: MobileLibraryItem[];
};

function isValidExportId(exportId?: string | null): exportId is string {
  return typeof exportId === 'string' && /^[a-f0-9]{64}$/.test(exportId);
}

function rowLabel(row: MobileLibraryItem): string {
  if (row.subtitle?.trim()) {
    return `${row.title} · ${row.subtitle}`;
  }
  return row.title;
}

export function LibrarySection({ items }: LibrarySectionProps) {
  const router = useRouter();
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const groups = useMemo(() => groupLibraryRows(items), [items]);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleRowPress = (row: MobileLibraryItem) => {
    router.push({
      pathname: '/my-sky/library/[id]',
      params: { id: row.id },
    });
  };

  return (
    <View style={styles.container}>
      {groups.map((group) => (
        <View key={group.key} style={styles.section}>
          <Pressable onPress={() => toggleSection(group.key)} style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>{group.label}</Text>
              <Text style={styles.sectionCount}>{group.rows.length}</Text>
            </View>
            <Text style={styles.sectionToggle}>{collapsedSections.has(group.key) ? '▸' : '▾'}</Text>
          </Pressable>

          {!collapsedSections.has(group.key) ? (
            group.rows.length === 0 ? (
              <Text style={styles.emptySection}>{group.emptyMessage}</Text>
            ) : (
              group.rows.map((row) => (
                <Pressable
                  key={row.id}
                  onPress={() => handleRowPress(row)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowLeft}>
                    {isValidExportId(row.exportId) ? (
                      <Text style={styles.audioIcon}>♫</Text>
                    ) : (
                      <Text style={styles.textOnlyIcon}>text</Text>
                    )}
                    <Text style={styles.rowLabel}>{rowLabel(row)}</Text>
                  </View>
                  <Text style={styles.viewLabel}>View</Text>
                </Pressable>
              ))
            )
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: layout.sectionGap,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Manrope-SemiBold',
    color: colors.accent.DEFAULT,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  sectionCount: {
    fontSize: 12,
    color: colors.text.muted,
    fontFamily: 'Manrope-Regular',
  },
  sectionToggle: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  emptySection: {
    fontSize: 14,
    color: colors.text.muted,
    fontFamily: 'Manrope-Regular',
    paddingLeft: 8,
    paddingVertical: 8,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: layout.card.borderRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: layout.card.padding,
    paddingVertical: layout.card.padding,
    marginBottom: layout.cardGap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  audioIcon: {
    color: colors.accent.DEFAULT,
    fontSize: 12,
    fontFamily: 'Manrope-SemiBold',
  },
  textOnlyIcon: {
    color: colors.text.muted,
    fontSize: 11,
    fontFamily: 'Manrope-Regular',
  },
  rowLabel: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
  viewLabel: {
    color: colors.accent.DEFAULT,
    fontSize: 13,
    fontFamily: 'Manrope-Medium',
  },
});
