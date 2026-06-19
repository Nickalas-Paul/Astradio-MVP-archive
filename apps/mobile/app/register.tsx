import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthButton } from '../src/components/auth/AuthButton';
import { AuthInput } from '../src/components/auth/AuthInput';
import { BackButton } from '../src/components/auth/BackButton';
import { LocationSearchInput } from '../src/components/auth/LocationSearchInput';
import { authStyles } from '../src/constants/auth-styles';
import { colors } from '../src/constants/colors';
import { api } from '../src/lib/api';
import { formatApiError } from '../src/lib/format-api-error';
import type { GeocodeResult } from '../src/lib/geocode';

type Period = 'AM' | 'PM';

function buildBirthDate(month: string, day: string, year: string): string | null {
  const m = Number.parseInt(month, 10);
  const d = Number.parseInt(day, 10);
  const y = Number.parseInt(year, 10);
  if (!Number.isFinite(m) || !Number.isFinite(d) || !Number.isFinite(y)) {
    return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) {
    return null;
  }
  const candidate = new Date(y, m - 1, d);
  if (
    candidate.getFullYear() !== y ||
    candidate.getMonth() !== m - 1 ||
    candidate.getDate() !== d
  ) {
    return null;
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function buildBirthTime(
  hour: string,
  minute: string,
  period: Period,
  unknownTime: boolean
): string | null {
  if (unknownTime) {
    return null;
  }
  const h12 = Number.parseInt(hour, 10);
  const min = Number.parseInt(minute, 10);
  if (!Number.isFinite(h12) || h12 < 1 || h12 > 12 || !Number.isFinite(min) || min < 0 || min > 59) {
    return null;
  }
  let h24 = h12 % 12;
  if (period === 'PM') {
    h24 += 12;
  }
  return `${String(h24).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function PeriodToggle({
  value,
  onChange,
  disabled = false,
}: {
  value: Period;
  onChange: (next: Period) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.periodRow}>
      {(['AM', 'PM'] as const).map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            disabled={disabled}
            onPress={() => onChange(option)}
            style={[
              styles.periodPill,
              selected && styles.periodPillSelected,
              disabled && styles.periodPillDisabled,
            ]}
          >
            <Text style={[styles.periodText, selected && styles.periodTextSelected]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function InlineInput({
  value,
  onChangeText,
  placeholder,
  maxLength,
  keyboardType = 'default',
  editable = true,
  style,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  maxLength?: number;
  keyboardType?: 'default' | 'number-pad';
  editable?: boolean;
  style?: object;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.text.muted}
      maxLength={maxLength}
      keyboardType={keyboardType}
      editable={editable}
      style={[authStyles.input, styles.inlineInput, style]}
    />
  );
}

export default function RegisterScreen() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthHour, setBirthHour] = useState('12');
  const [birthMinute, setBirthMinute] = useState('00');
  const [birthPeriod, setBirthPeriod] = useState<Period>('PM');
  const [unknownBirthTime, setUnknownBirthTime] = useState(false);
  const [birthLocationQuery, setBirthLocationQuery] = useState('');
  const [selectedBirthLocation, setSelectedBirthLocation] = useState<GeocodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const birthDate = useMemo(
    () => buildBirthDate(birthMonth, birthDay, birthYear),
    [birthMonth, birthDay, birthYear]
  );
  const birthTime = useMemo(
    () => buildBirthTime(birthHour, birthMinute, birthPeriod, unknownBirthTime),
    [birthHour, birthMinute, birthPeriod, unknownBirthTime]
  );

  const hasValidBirthLocation =
    selectedBirthLocation !== null &&
    Number.isFinite(selectedBirthLocation.lat) &&
    Number.isFinite(selectedBirthLocation.lon) &&
    (selectedBirthLocation.lat !== 0 || selectedBirthLocation.lon !== 0);

  const canSubmit =
    displayName.trim().length > 0 &&
    email.trim().includes('@') &&
    password.length >= 8 &&
    birthDate !== null &&
    hasValidBirthLocation &&
    (unknownBirthTime || birthTime !== null);

  const handleSubmit = async () => {
    setError(null);

    if (!birthDate) {
      setError('Enter a valid birth date');
      return;
    }
    if (!unknownBirthTime && !birthTime) {
      setError('Enter a valid birth time or mark it as unknown');
      return;
    }
    if (!hasValidBirthLocation) {
      setError('Select a birth location from the search results');
      return;
    }

    setLoading(true);
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          chart: {
            label: selectedBirthLocation.label,
            date: birthDate,
            time: birthTime ?? '12:00',
            lat: selectedBirthLocation.lat,
            lon: selectedBirthLocation.lon,
            timezone: selectedBirthLocation.timezone,
          },
        }),
      });

      router.replace({
        pathname: '/verify-email',
        params: { email: email.trim() },
      });
    } catch (err) {
      setError(formatApiError(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={authStyles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={authStyles.content}>
            <BackButton href="/welcome" />
            <Text style={authStyles.heading}>Create your chart</Text>

            <AuthInput
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              placeholder="Your name"
            />
            <AuthInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              placeholder="you@example.com"
            />
            <AuthInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="At least 8 characters"
            />

            <Text style={authStyles.label}>Birth date</Text>
            <View style={styles.dateRow}>
              <InlineInput
                value={birthMonth}
                onChangeText={setBirthMonth}
                keyboardType="number-pad"
                placeholder="MM"
                maxLength={2}
                style={styles.dateField}
              />
              <InlineInput
                value={birthDay}
                onChangeText={setBirthDay}
                keyboardType="number-pad"
                placeholder="DD"
                maxLength={2}
                style={styles.dateField}
              />
              <InlineInput
                value={birthYear}
                onChangeText={setBirthYear}
                keyboardType="number-pad"
                placeholder="YYYY"
                maxLength={4}
                style={styles.yearField}
              />
            </View>

            <Text style={authStyles.label}>Birth time</Text>
            <View style={styles.timeRow}>
              <InlineInput
                value={birthHour}
                onChangeText={setBirthHour}
                keyboardType="number-pad"
                placeholder="HH"
                maxLength={2}
                editable={!unknownBirthTime}
                style={styles.timeField}
              />
              <Text style={styles.timeSeparator}>:</Text>
              <InlineInput
                value={birthMinute}
                onChangeText={setBirthMinute}
                keyboardType="number-pad"
                placeholder="MM"
                maxLength={2}
                editable={!unknownBirthTime}
                style={styles.timeField}
              />
              <PeriodToggle
                value={birthPeriod}
                onChange={setBirthPeriod}
                disabled={unknownBirthTime}
              />
            </View>

            <Pressable
              onPress={() => setUnknownBirthTime((prev) => !prev)}
              style={styles.toggleRow}
            >
              <View style={[styles.checkbox, unknownBirthTime && styles.checkboxChecked]} />
              <Text style={styles.toggleText}>I don&apos;t know my birth time</Text>
            </Pressable>

            <LocationSearchInput
              value={birthLocationQuery}
              selected={selectedBirthLocation}
              onChangeQuery={setBirthLocationQuery}
              onSelect={setSelectedBirthLocation}
              onClearSelection={() => setSelectedBirthLocation(null)}
              placeholder="City, region, or address"
            />

            {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

            <AuthButton
              label={loading ? 'Creating account...' : 'Create your chart'}
              onPress={handleSubmit}
              loading={loading}
              disabled={!canSubmit}
            />

            <Pressable onPress={() => router.push('/login')}>
              <Text style={authStyles.footerText}>
                Already have an account? <Text style={authStyles.linkText}>Sign in</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  inlineInput: {
    marginBottom: 0,
  },
  dateField: {
    flex: 1,
  },
  yearField: {
    flex: 1.4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  timeField: {
    width: 72,
  },
  timeSeparator: {
    color: colors.text.primary,
    fontSize: 18,
    fontFamily: 'Manrope-Regular',
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  periodPill: {
    minHeight: 48,
    minWidth: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  periodPillSelected: {
    borderColor: colors.accent.DEFAULT,
    backgroundColor: colors.surfaceLight,
  },
  periodPillDisabled: {
    opacity: 0.5,
  },
  periodText: {
    color: colors.text.muted,
    fontFamily: 'Manrope-Medium',
    fontSize: 14,
  },
  periodTextSelected: {
    color: colors.accent.DEFAULT,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    minHeight: 48,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: colors.accent.DEFAULT,
    borderColor: colors.accent.DEFAULT,
  },
  toggleText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    flex: 1,
  },
});
