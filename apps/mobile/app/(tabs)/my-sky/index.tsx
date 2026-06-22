import { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NatalWheel } from '../../../src/components/chart/NatalWheel';
import { IdentityReading } from '../../../src/components/my-sky/IdentityReading';
import { LibrarySection } from '../../../src/components/my-sky/LibrarySection';
import { MySkySkeleton } from '../../../src/components/my-sky/MySkySkeleton';
import { ProfileHeader } from '../../../src/components/my-sky/ProfileHeader';
import { AUTH_HORIZONTAL_PADDING } from '../../../src/constants/auth-styles';
import { colors } from '../../../src/constants/colors';
import { layout } from '../../../src/constants/layout';
import { typography } from '../../../src/constants/typography';
import { useMySkyData } from '../../../src/hooks/useMySkyData';
import { useAuthStore } from '../../../src/store/auth';
import { FtueBanner } from '../../../src/components/ftue/FtueBanner';
import { FTUE_KEYS } from '../../../src/lib/ftue-storage';

function SectionHeading({ title }: { title: string }) {
  return <Text style={styles.sectionHeading}>{title}</Text>;
}

function SectionDivider() {
  return <View style={styles.sectionDivider} />;
}

export default function MySkyScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const { width } = useWindowDimensions();
  const { data, isLoading, error, refetch } = useMySkyData();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'identity' | 'library'>('identity');
  const scrollRef = useRef<ScrollView>(null);

  const wheelSize = width - AUTH_HORIZONTAL_PADDING * 2;

  const handleTabChange = (tab: 'identity' | 'library') => {
    setActiveTab(tab);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const handleSignOut = async () => {
    await logout();
    router.replace('/welcome');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.accent.DEFAULT}
            colors={[colors.accent.DEFAULT]}
          />
        }
      >
        <Text style={styles.title}>My Sky</Text>

        {isLoading && !data ? <MySkySkeleton /> : null}

        {error && !data ? (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void refetch()}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {data ? (
          <>
            <ProfileHeader user={data.user} bigThree={data.bigThree} />

            <View style={styles.tabBar}>
              <Pressable
                onPress={() => handleTabChange('identity')}
                style={[
                  styles.tabButton,
                  activeTab === 'identity' && styles.tabButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    activeTab === 'identity' && styles.tabLabelActive,
                  ]}
                >
                  Identity
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleTabChange('library')}
                style={[
                  styles.tabButton,
                  activeTab === 'library' && styles.tabButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    activeTab === 'library' && styles.tabLabelActive,
                  ]}
                >
                  Library
                </Text>
              </Pressable>
            </View>

            {activeTab === 'identity' ? (
              <>
                {data.wheel ? (
                  <NatalWheel
                    size={wheelSize}
                    placements={data.wheel.placements}
                    aspects={data.wheel.aspects}
                    cusps={data.wheel.cusps}
                    ascendantLongitude={data.wheel.ascendantLongitude}
                  />
                ) : (
                  <Text style={styles.emptyText}>Chart wheel unavailable</Text>
                )}

                <SectionDivider />
                <SectionHeading title="Your Identity" />
                <IdentityReading sections={data.identitySections} />

                <FtueBanner
                  storageKey={FTUE_KEYS.todayBridgeNudge}
                  message="Your chart never changes. But the sky does, every day. See how today is activating your chart."
                  actionLabel="Go to Today →"
                  onAction={() => router.push('/(tabs)/today')}
                />
              </>
            ) : null}

            {activeTab === 'library' ? <LibrarySection items={data.libraryItems} /> : null}
          </>
        ) : null}

        <Pressable onPress={() => void handleSignOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: AUTH_HORIZONTAL_PADDING,
    paddingBottom: layout.screenBottomPadding,
  },
  title: {
    ...typography.screenTitle,
    color: colors.text.primary,
    marginTop: 8,
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: 16,
    marginTop: 8,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: colors.accent.DEFAULT,
  },
  tabLabel: {
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
    color: colors.text.muted,
  },
  tabLabelActive: {
    fontFamily: 'Manrope-Medium',
    color: colors.text.primary,
  },
  sectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: layout.sectionGap,
    marginBottom: 16,
  },
  sectionHeading: {
    color: colors.accent.DEFAULT,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 12,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    paddingVertical: 24,
  },
  errorBlock: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  errorText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryText: {
    color: colors.accent.DEFAULT,
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
  },
  signOutButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 40,
  },
  signOutText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
});
