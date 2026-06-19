import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../../constants/colors';
import type { RelationalIntent } from '../../constants/community-constants';
import { isPendingOutgoing } from '../../lib/community-match-utils';
import type { PendingIntent, SearchUser } from '../../types/community';
import { UserAvatar } from './UserAvatar';

type DiscoverySearchSectionProps = {
  intent: RelationalIntent;
  pendingOutgoing: PendingIntent[];
  searchUsers: (query: string) => Promise<SearchUser[]>;
  searchLoading: boolean;
  onRequestConnection: (userId: string, chartId: string) => Promise<void>;
  mutationBusy?: boolean;
};

export function DiscoverySearchSection({
  intent,
  pendingOutgoing,
  searchUsers,
  searchLoading,
  onRequestConnection,
  mutationBusy = false,
}: DiscoverySearchSectionProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null);
  const [requestMsg, setRequestMsg] = useState<string | null>(null);
  const [pendingLocal, setPendingLocal] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (debouncedQuery.length < 2) {
        setUsers([]);
        return;
      }
      const results = await searchUsers(debouncedQuery);
      if (!cancelled) setUsers(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, searchUsers]);

  const handleRequest = async (user: SearchUser) => {
    setRequestMsg(null);
    setRequestBusyId(user.userId);
    try {
      await onRequestConnection(user.userId, user.chartId);
      setPendingLocal((prev) => new Set(prev).add(`${user.userId}:${user.chartId}`));
      setRequestMsg('Request sent');
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error?: string }).error ?? 'Request failed')
          : 'Request failed';
      setRequestMsg(message.replace(/_/g, ' '));
    } finally {
      setRequestBusyId(null);
    }
  };

  const showResults = debouncedQuery.length >= 2;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Find someone specific</Text>
      <Text style={styles.sectionSubtitle}>Search by display name or handle</Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name..."
        placeholderTextColor={colors.text.muted}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {requestMsg ? <Text style={styles.msg}>{requestMsg}</Text> : null}

      {showResults ? (
        <View style={styles.results}>
          {searchLoading ? (
            <ActivityIndicator color={colors.accent.DEFAULT} style={styles.loader} />
          ) : users.length === 0 ? (
            <Text style={styles.emptyText}>No users found for &apos;{debouncedQuery}&apos;</Text>
          ) : (
            users.map((user) => {
              const pending =
                pendingLocal.has(`${user.userId}:${user.chartId}`) ||
                isPendingOutgoing(user.userId, user.chartId, pendingOutgoing, intent);
              const busy = requestBusyId === user.userId;

              return (
                <View key={user.userId} style={styles.row}>
                  <UserAvatar
                    userId={user.userId}
                    displayName={user.displayName}
                    avatarUrl={user.avatarUrl}
                    size={44}
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>{user.displayName}</Text>
                    {user.bio ? (
                      <Text style={styles.rowBio} numberOfLines={1}>
                        {user.bio}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => void handleRequest(user)}
                    disabled={pending || busy || mutationBusy || !user.chartId}
                    style={({ pressed }) => [
                      styles.requestButton,
                      (pending || busy || mutationBusy) && styles.requestButtonDisabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={colors.text.primary} />
                    ) : (
                      <Text style={styles.requestButtonText}>
                        {pending ? 'Request pending' : 'Request connection'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      ) : null}

      <View style={styles.separator} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.text.secondary,
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    minHeight: 44,
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
    marginBottom: 12,
  },
  msg: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  results: {
    gap: 8,
  },
  loader: {
    marginVertical: 12,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 12,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Cormorant-SemiBold',
  },
  rowBio: {
    color: colors.text.muted,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    marginTop: 2,
  },
  requestButton: {
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  requestButtonDisabled: {
    backgroundColor: colors.surfaceLight,
  },
  requestButtonText: {
    color: colors.text.primary,
    fontSize: 11,
    fontFamily: 'Manrope-SemiBold',
    textAlign: 'center',
  },
  separator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 20,
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
