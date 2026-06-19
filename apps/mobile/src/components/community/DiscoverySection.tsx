import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../../constants/colors';
import type { InventoryPair, MatchResult, PendingIntent, SearchUser } from '../../types/community';
import { UserAvatar } from './UserAvatar';

type DiscoveryRow = {
  key: string;
  userId: string;
  chartId: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
  subtitle?: string;
};

type DiscoverySectionProps = {
  matches: MatchResult[];
  pairs: InventoryPair[];
  pendingOutgoing: PendingIntent[];
  searchUsers: (query: string) => Promise<SearchUser[]>;
  searchLoading: boolean;
  onConnect: (userId: string, chartId: string) => Promise<void>;
  connectBusy?: boolean;
};

function isConnected(
  userId: string,
  pairs: InventoryPair[]
): boolean {
  return pairs.some((pair) => pair.peerUserId === userId);
}

function isPendingOutgoing(
  userId: string,
  chartId: string,
  pendingOutgoing: PendingIntent[]
): boolean {
  return pendingOutgoing.some(
    (intent) => intent.toUserId === userId && intent.toChartId === chartId
  );
}

export function DiscoverySection({
  matches,
  pairs,
  pendingOutgoing,
  searchUsers,
  searchLoading,
  onConnect,
  connectBusy = false,
}: DiscoverySectionProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [pendingLocal, setPendingLocal] = useState<Set<string>>(new Set());
  const [connectBusyId, setConnectBusyId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (debouncedQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      const results = await searchUsers(debouncedQuery);
      if (!cancelled) setSearchResults(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, searchUsers]);

  const rows: DiscoveryRow[] = useMemo(() => {
    if (debouncedQuery.length >= 2) {
      return searchResults.map((user) => ({
        key: `search-${user.userId}`,
        userId: user.userId,
        chartId: user.chartId,
        displayName: user.displayName,
        handle: user.handle,
        avatarUrl: user.avatarUrl,
        subtitle: user.bio,
      }));
    }
    return matches.map((match) => ({
      key: `match-${match.userId}`,
      userId: match.userId,
      chartId: match.chartId,
      displayName: match.displayName,
      handle: match.handle,
      avatarUrl: match.avatarUrl,
      subtitle: match.bio,
    }));
  }, [debouncedQuery, searchResults, matches]);

  const handleConnect = useCallback(
    async (row: DiscoveryRow) => {
      setConnectError(null);
      setConnectBusyId(row.userId);
      try {
        await onConnect(row.userId, row.chartId);
        setPendingLocal((prev) => new Set(prev).add(`${row.userId}:${row.chartId}`));
      } catch (err) {
        const message =
          err && typeof err === 'object' && 'error' in err
            ? String((err as { error?: string }).error ?? 'Connect failed')
            : 'Connect failed';
        setConnectError(message.replace(/_/g, ' '));
        setTimeout(() => setConnectError(null), 3000);
      } finally {
        setConnectBusyId(null);
      }
    },
    [onConnect]
  );

  const showSearchLoading = debouncedQuery.length >= 2 && searchLoading;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Discover</Text>
      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or handle"
          placeholderTextColor={colors.text.muted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {connectError ? <Text style={styles.errorText}>{connectError}</Text> : null}

      {showSearchLoading ? (
        <ActivityIndicator color={colors.accent.DEFAULT} style={styles.loader} />
      ) : null}

      {!showSearchLoading && debouncedQuery.length >= 2 && rows.length === 0 ? (
        <Text style={styles.emptyText}>No users found</Text>
      ) : null}

      {!showSearchLoading && debouncedQuery.length < 2 && rows.length === 0 ? (
        <Text style={styles.emptyText}>No matches yet</Text>
      ) : null}

      {rows.map((row) => {
        const connected = isConnected(row.userId, pairs);
        const pending =
          pendingLocal.has(`${row.userId}:${row.chartId}`) ||
          isPendingOutgoing(row.userId, row.chartId, pendingOutgoing);
        const busy = connectBusyId === row.userId;

        return (
          <View key={row.key} style={styles.row}>
            <UserAvatar
              userId={row.userId}
              displayName={row.displayName}
              avatarUrl={row.avatarUrl}
              size={40}
            />
            <View style={styles.rowText}>
              <Text style={styles.rowName}>{row.displayName}</Text>
              {row.handle ? <Text style={styles.rowHandle}>@{row.handle}</Text> : null}
            </View>
            {connected ? (
              <Text style={styles.connectedLabel}>Connected</Text>
            ) : pending ? (
              <View style={styles.pendingButton}>
                <Text style={styles.pendingText}>Pending</Text>
              </View>
            ) : (
              <Pressable
                onPress={() => void handleConnect(row)}
                disabled={busy || connectBusy}
                style={({ pressed }) => [
                  styles.connectButton,
                  pressed && styles.pressed,
                  (busy || connectBusy) && styles.disabled,
                ]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.text.primary} />
                ) : (
                  <Text style={styles.connectText}>Connect</Text>
                )}
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  heading: {
    color: colors.accent.DEFAULT,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    color: colors.text.muted,
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
  },
  loader: {
    marginVertical: 16,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    paddingVertical: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    marginBottom: 8,
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
    marginBottom: 8,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  rowHandle: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    marginTop: 1,
  },
  connectButton: {
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 84,
    alignItems: 'center',
  },
  connectText: {
    color: colors.text.primary,
    fontSize: 12,
    fontFamily: 'Manrope-SemiBold',
  },
  pendingButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surfaceLight,
  },
  pendingText: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Medium',
  },
  connectedLabel: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Medium',
    paddingHorizontal: 8,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
});
