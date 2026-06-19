import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { colors } from '../../constants/colors';
import { formatApiError } from '../../lib/format-api-error';
import { searchGeocode } from '../../lib/geocode';
import { postSnapshot } from '../../lib/sandbox-fetch';
import { snapshotFromEphemeris } from '../../lib/sandbox-slot-utils';
import { useSandboxStore } from '../../store/sandbox';

type BirthDataFormProps = {
  slotIndex: number;
  onCancel: () => void;
};

const HOUSE_SYSTEMS = [
  { value: 'placidus', label: 'Placidus' },
  { value: 'equal', label: 'Equal' },
  { value: 'koch', label: 'Koch' },
] as const;

function formatDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTimeHHMM(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function parseDateYYYYMMDD(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date();
}

function parseTimeHHMM(value: string): Date {
  const d = new Date();
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (match) {
    d.setHours(Number(match[1]), Number(match[2]), 0, 0);
  } else {
    d.setHours(12, 0, 0, 0);
  }
  return d;
}

function formatTime12Hour(hhmm: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return '12:00 PM';
  let h = Number(match[1]);
  const m = match[2]!;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export function BirthDataForm({ slotIndex, onCancel }: BirthDataFormProps) {
  const updateSlot = useSandboxStore((s) => s.updateSlot);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [location, setLocation] = useState<{
    label: string;
    lat: number;
    lon: number;
    timezone: string;
  } | null>(null);
  const [tz, setTz] = useState('UTC');
  const [houseSystem, setHouseSystem] = useState<(typeof HOUSE_SYSTEMS)[number]['value']>('placidus');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<
    Array<{ label: string; lat: number; lon: number; timezone: string }>
  >([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isValid = Boolean(date && time && location);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = locationQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void (async () => {
        setGeoLoading(true);
        try {
          const rows = await searchGeocode(q);
          setSuggestions(rows);
        } catch {
          setSuggestions([]);
        } finally {
          setGeoLoading(false);
        }
      })();
    }, 300);
  }, [locationQuery]);

  const onDateChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    if (selectedDate) {
      setDate(formatDateYYYYMMDD(selectedDate));
    }
  }, []);

  const onTimeChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (event.type === 'dismissed') {
      setShowTimePicker(false);
      return;
    }
    if (selectedDate) {
      setTime(formatTimeHHMM(selectedDate));
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!location) {
      setError('Select a location from the search results before continuing');
      return;
    }
    if (!date || !time) {
      setError('Date and time are required');
      return;
    }

    setLoading(true);
    try {
      const birth = {
        date,
        time: time.length >= 5 ? time.slice(0, 5) : time,
        lat: location.lat,
        lon: location.lon,
        tz: tz || location.timezone || 'UTC',
        houseSystem,
        location: {
          label: location.label,
          lat: location.lat,
          lon: location.lon,
          timezone: tz || location.timezone || 'UTC',
        },
      };

      const snapRes = await postSnapshot(birth, { planets: {} });
      const snap = snapshotFromEphemeris(snapRes.snapshot);
      if (!snap) throw new Error('Failed to load chart');

      updateSlot(slotIndex, {
        entryMode: 'ephemeris_birth',
        birth: {
          date: birth.date,
          time: birth.time,
          lat: birth.lat,
          lon: birth.lon,
          timezone: birth.location.timezone,
          locationLabel: birth.location.label,
          houseSystem,
        },
        snapshot: snap,
        baseSnapshot: snap,
      });
    } catch (e) {
      setError(formatApiError(e, 'Failed to load birth data'));
    } finally {
      setLoading(false);
    }
  }, [date, time, location, tz, houseSystem, slotIndex, updateSlot]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Birth data</Text>
        <Pressable onPress={onCancel} accessibilityRole="button">
          <Text style={styles.cancel}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>Date</Text>
          <Pressable
            style={styles.pickerField}
            onPress={() => setShowDatePicker(true)}
            accessibilityRole="button"
          >
            <Text style={date ? styles.pickerValue : styles.pickerPlaceholder}>
              {date || 'Select date'}
            </Text>
          </Pressable>
          {showDatePicker ? (
            <DateTimePicker
              value={date ? parseDateYYYYMMDD(date) : new Date()}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          ) : null}
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Time</Text>
          <Pressable
            style={styles.pickerField}
            onPress={() => setShowTimePicker(true)}
            accessibilityRole="button"
          >
            <Text style={styles.pickerValue}>{formatTime12Hour(time)}</Text>
          </Pressable>
          {showTimePicker ? (
            <DateTimePicker
              value={parseTimeHHMM(time)}
              mode="time"
              display="default"
              is24Hour={false}
              onChange={onTimeChange}
            />
          ) : null}
        </View>
      </View>

      <Text style={styles.label}>Location</Text>
      <TextInput
        value={locationQuery}
        onChangeText={(v) => {
          setLocationQuery(v);
          setLocation(null);
        }}
        placeholder="City, State, Country"
        placeholderTextColor={colors.text.muted}
        style={styles.input}
      />
      {locationLabel ? (
        <Text style={styles.selectedLocation}>Selected: {locationLabel}</Text>
      ) : null}
      {geoLoading ? <ActivityIndicator color={colors.accent.DEFAULT} /> : null}
      <ScrollView style={styles.suggestions} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {suggestions.map((item) => (
          <Pressable
            key={`${item.label}-${item.lat}`}
            style={styles.suggestionRow}
            onPress={() => {
              setLocation(item);
              setLocationLabel(item.label);
              setLocationQuery(item.label);
              setTz(item.timezone);
              setSuggestions([]);
            }}
          >
            <Text style={styles.suggestionText}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>Timezone</Text>
          <TextInput value={tz} onChangeText={setTz} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>House system</Text>
          <View style={styles.pickerRow}>
            {HOUSE_SYSTEMS.map((hs) => (
              <Pressable
                key={hs.value}
                style={[styles.pill, houseSystem === hs.value && styles.pillActive]}
                onPress={() => setHouseSystem(hs.value)}
              >
                <Text style={[styles.pillText, houseSystem === hs.value && styles.pillTextActive]}>
                  {hs.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.submit, (!isValid || loading) && styles.submitDisabled]}
        disabled={!isValid || loading}
        onPress={() => void handleSubmit()}
        accessibilityRole="button"
      >
        <Text style={styles.submitText}>{loading ? 'Loading chart...' : 'Load Chart'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  cancel: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Medium',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  field: {
    flex: 1,
  },
  label: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Medium',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text.primary,
    fontFamily: 'Manrope-Regular',
    backgroundColor: colors.surfaceLight,
  },
  pickerField: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceLight,
    minHeight: 42,
    justifyContent: 'center',
  },
  pickerValue: {
    color: colors.text.primary,
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
  },
  pickerPlaceholder: {
    color: colors.text.muted,
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
  },
  selectedLocation: {
    color: colors.accent.DEFAULT,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  suggestions: {
    maxHeight: 120,
  },
  suggestionRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}80`,
  },
  suggestionText: {
    color: colors.text.primary,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  pillActive: {
    borderColor: colors.accent.DEFAULT,
    backgroundColor: `${colors.accent.DEFAULT}18`,
  },
  pillText: {
    color: colors.text.secondary,
    fontSize: 11,
    fontFamily: 'Manrope-Medium',
  },
  pillTextActive: {
    color: colors.accent.DEFAULT,
  },
  error: {
    color: colors.error,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  submit: {
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.45,
  },
  submitText: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
});
