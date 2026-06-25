import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NatalWheel } from '../../../src/components/chart/NatalWheel';
import { ExpandableWheelFrame } from '../../../src/components/chart/ExpandableWheelFrame';
import { IdentityReading } from '../../../src/components/my-sky/IdentityReading';
import { IdentityAudioCard } from '../../../src/components/my-sky/IdentityAudioCard';
import { GenerateIdentityAudioButton } from '../../../src/components/my-sky/GenerateIdentityAudioButton';
import { LibrarySection } from '../../../src/components/my-sky/LibrarySection';
import { MySkySkeleton } from '../../../src/components/my-sky/MySkySkeleton';
import { ProfileHeader } from '../../../src/components/my-sky/ProfileHeader';
import { AUTH_HORIZONTAL_PADDING } from '../../../src/constants/auth-styles';
import { colors } from '../../../src/constants/colors';
import { layout } from '../../../src/constants/layout';
import { typography } from '../../../src/constants/typography';
import { useMySkyData } from '../../../src/hooks/useMySkyData';
import { API_BASE } from '../../../src/lib/api';
import { getToken } from '../../../src/lib/token-storage';
import { useAuthStore } from '../../../src/store/auth';
import { FtueBanner } from '../../../src/components/ftue/FtueBanner';
import { FTUE_KEYS } from '../../../src/lib/ftue-storage';
import { SaveToLibraryButton } from '../../../src/components/shared/SaveToLibraryButton';

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
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
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

  const finishAccountDeletion = async (password: string) => {
    setDeleteLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert('Something went wrong. Please try again.');
        return;
      }
      const response = await fetch(`${API_BASE}/api/auth/account`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        setDeleteModalVisible(false);
        setDeletePassword('');
        await logout();
        router.replace('/welcome');
        return;
      }
      if (response.status === 403) {
        Alert.alert('Incorrect password');
        return;
      }
      Alert.alert('Something went wrong. Please try again.');
    } catch {
      Alert.alert('Something went wrong. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const promptDeletePassword = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Confirm Password',
        'Enter your password to confirm account deletion.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete My Account',
            style: 'destructive',
            onPress: (value) => {
              void finishAccountDeletion(value || '');
            },
          },
        ],
        'secure-text'
      );
      return;
    }
    setDeletePassword('');
    setDeleteModalVisible(true);
  };

  const handleDeleteAccountPress = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => promptDeletePassword(),
        },
      ]
    );
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
                  <ExpandableWheelFrame wheelSize={wheelSize}>
                    {(size) => (
                      <NatalWheel
                        size={size}
                        placements={data.wheel!.placements}
                        aspects={data.wheel!.aspects}
                        cusps={data.wheel!.cusps}
                        ascendantLongitude={data.wheel!.ascendantLongitude}
                      />
                    )}
                  </ExpandableWheelFrame>
                ) : (
                  <Text style={styles.emptyText}>Chart wheel unavailable</Text>
                )}

                {data.identityExportId ? (
                  <>
                    <IdentityAudioCard exportId={data.identityExportId} />
                    <SaveToLibraryButton
                      exportId={data.identityExportId}
                      source="profile_identity"
                      compositionType="A"
                      label="Your natal soundtrack"
                      sandboxState={{
                        kind: 'profile_identity',
                        chartId: data.primaryChart?.id ?? '',
                      }}
                    />
                  </>
                ) : data.primaryChart?.id ? (
                  <GenerateIdentityAudioButton onGenerated={refetch} />
                ) : null}

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

            {activeTab === 'library' ? (
              <LibrarySection items={data.libraryItems} libraryError={data.libraryError} />
            ) : null}
          </>
        ) : null}

        <Pressable onPress={() => router.push('/privacy')} style={styles.privacyLink}>
          <Text style={styles.privacyLinkText}>Privacy Policy</Text>
        </Pressable>
        <Pressable onPress={() => void handleSignOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
        <Pressable onPress={handleDeleteAccountPress} style={styles.deleteAccountButton}>
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleteLoading) {
            setDeleteModalVisible(false);
            setDeletePassword('');
          }
        }}
      >
        <Pressable
          style={styles.deleteModalBackdrop}
          onPress={() => {
            if (!deleteLoading) {
              setDeleteModalVisible(false);
              setDeletePassword('');
            }
          }}
        >
          <Pressable style={styles.deleteModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.deleteModalTitle}>Confirm Password</Text>
            <Text style={styles.deleteModalMessage}>
              Enter your password to confirm account deletion.
            </Text>
            <TextInput
              value={deletePassword}
              onChangeText={setDeletePassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Password"
              placeholderTextColor={colors.text.muted}
              style={styles.deleteModalInput}
              editable={!deleteLoading}
            />
            <View style={styles.deleteModalActions}>
              <Pressable
                onPress={() => {
                  if (!deleteLoading) {
                    setDeleteModalVisible(false);
                    setDeletePassword('');
                  }
                }}
                style={styles.deleteModalCancel}
                disabled={deleteLoading}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void finishAccountDeletion(deletePassword)}
                style={styles.deleteModalConfirm}
                disabled={deleteLoading || !deletePassword.trim()}
              >
                <Text style={styles.deleteModalConfirmText}>
                  {deleteLoading ? 'Deleting…' : 'Delete My Account'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  privacyLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  privacyLinkText: {
    color: colors.accent.DEFAULT,
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
  },
  signOutButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  signOutText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
  deleteAccountButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  deleteAccountText: {
    color: '#f87171',
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
  deleteModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: AUTH_HORIZONTAL_PADDING,
  },
  deleteModalCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 20,
  },
  deleteModalTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 8,
  },
  deleteModalMessage: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    marginBottom: 16,
  },
  deleteModalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
    marginBottom: 16,
  },
  deleteModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  deleteModalCancel: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  deleteModalCancelText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
  },
  deleteModalConfirm: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  deleteModalConfirmText: {
    color: '#f87171',
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
  },
});
