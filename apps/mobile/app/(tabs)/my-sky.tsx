import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NatalWheel } from '../../src/components/chart/NatalWheel';
import { IdentityAudioCard } from '../../src/components/my-sky/IdentityAudioCard';
import { IdentityReading } from '../../src/components/my-sky/IdentityReading';
import { LibrarySection } from '../../src/components/my-sky/LibrarySection';
import { MySkySkeleton } from '../../src/components/my-sky/MySkySkeleton';
import { ProfileHeader } from '../../src/components/my-sky/ProfileHeader';
import { AUTH_HORIZONTAL_PADDING } from '../../src/constants/auth-styles';
import { colors } from '../../src/constants/colors';
import { useMySkyData } from '../../src/hooks/useMySkyData';
import { useAuthStore } from '../../src/store/auth';

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

  const wheelSize = width - AUTH_HORIZONTAL_PADDING * 2;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleSignOut = async () => {
    await logout();
    router.replace('/welcome');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
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

            {data.identityExportId ? (
              <IdentityAudioCard exportId={data.identityExportId} />
            ) : null}

            <SectionDivider />
            <SectionHeading title="Library" />
            <LibrarySection items={data.libraryItems} />
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
    paddingBottom: 40,
  },
  title: {
    color: colors.text.primary,
    fontSize: 28,
    fontFamily: 'Cormorant-SemiBold',
    marginTop: 8,
    marginBottom: 16,
  },
  sectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 20,
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
