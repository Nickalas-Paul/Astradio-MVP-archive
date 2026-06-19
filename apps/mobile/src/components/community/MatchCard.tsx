import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import type { RelationalIntent } from '../../constants/community-constants';
import {
  discoveryBulletFromEp,
  isPendingOutgoing,
} from '../../lib/community-match-utils';
import type { CompatibilityExplanationProfile, MatchResult, PendingIntent } from '../../types/community';
import { UserAvatar } from './UserAvatar';

type MatchCardProps = {
  match: MatchResult;
  intent: RelationalIntent;
  pendingOutgoing: PendingIntent[];
  onRequestConnection: (userId: string, chartId: string) => Promise<void>;
  requestBusy?: boolean;
  mutationBusy?: boolean;
};

function SynastryBulletBlock({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.bulletBlock}>
      <Text style={styles.bulletLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function getBullets(ep: CompatibilityExplanationProfile | undefined) {
  if (!ep) {
    return [
      { label: "Why you're good for them", text: 'Compatibility insight unavailable' },
      { label: "Why they're good for you", text: 'Compatibility insight unavailable' },
      { label: "Why you're good together", text: 'Compatibility insight unavailable' },
    ];
  }
  return [
    discoveryBulletFromEp(ep, 'forThem'),
    discoveryBulletFromEp(ep, 'forYou'),
    discoveryBulletFromEp(ep, 'together'),
  ].map((line) => ({ label: line.anchor, text: line.text }));
}

export function MatchCard({
  match,
  intent,
  pendingOutgoing,
  onRequestConnection,
  requestBusy = false,
  mutationBusy = false,
}: MatchCardProps) {
  const pending = isPendingOutgoing(match.userId, match.chartId, pendingOutgoing, intent);
  const busy = requestBusy;
  const bullets = getBullets(match.explanationProfile);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <UserAvatar
          userId={match.userId}
          displayName={match.displayName}
          avatarUrl={match.avatarUrl}
          size={72}
        />
        <Text style={styles.name}>{match.displayName}</Text>
        {match.handle ? <Text style={styles.handle}>@{match.handle}</Text> : null}
        {match.bio ? (
          <Text style={styles.bio} numberOfLines={2}>
            {match.bio}
          </Text>
        ) : null}
      </View>

      <View style={styles.divider} />

      {bullets.map((bullet, idx) => (
        <SynastryBulletBlock key={idx} label={bullet.label} text={bullet.text} />
      ))}

      <View style={styles.actions}>
        <Pressable
          onPress={() => console.log('view profile', match.userId)}
          style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
        >
          <Text style={styles.outlineButtonText}>View profile</Text>
        </Pressable>
        <Pressable
          onPress={() => void onRequestConnection(match.userId, match.chartId)}
          disabled={pending || busy || mutationBusy}
          style={({ pressed }) => [
            styles.primaryButton,
            (pending || busy || mutationBusy) && styles.primaryButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.text.primary} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {pending ? 'Awaiting response' : 'Request connection'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
  },
  header: {
    alignItems: 'center',
  },
  name: {
    color: colors.text.primary,
    fontSize: 22,
    fontFamily: 'Cormorant-SemiBold',
    marginTop: 10,
    textAlign: 'center',
  },
  handle: {
    color: colors.text.muted,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    marginTop: 2,
  },
  bio: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    marginTop: 8,
    textAlign: 'center',
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginVertical: 16,
  },
  bulletBlock: {
    borderLeftWidth: 2,
    borderLeftColor: `${colors.accent.DEFAULT}33`,
    paddingLeft: 12,
    marginBottom: 14,
  },
  bulletLabel: {
    color: colors.accent.DEFAULT,
    fontSize: 11,
    fontFamily: 'Manrope-SemiBold',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bulletText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  outlineButton: {
    flex: 1,
    minWidth: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Medium',
  },
  primaryButton: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: colors.surfaceLight,
  },
  primaryButtonText: {
    color: colors.text.primary,
    fontSize: 13,
    fontFamily: 'Manrope-SemiBold',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
