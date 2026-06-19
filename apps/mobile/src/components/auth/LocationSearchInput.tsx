import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { authStyles } from '../../constants/auth-styles';
import { colors } from '../../constants/colors';
import { searchGeocode, type GeocodeResult } from '../../lib/geocode';

const DEBOUNCE_MS = 300;

type LocationSearchInputProps = {
  label?: string;
  value: string;
  selected: GeocodeResult | null;
  onChangeQuery: (query: string) => void;
  onSelect: (result: GeocodeResult) => void;
  onClearSelection: () => void;
  placeholder?: string;
  error?: string | null;
};

export function LocationSearchInput({
  label = 'Birth location',
  value,
  selected,
  onChangeQuery,
  onSelect,
  onClearSelection,
  placeholder = 'City, region, or address',
  error,
}: LocationSearchInputProps) {
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setSearchError(null);
      return;
    }

    setLoading(true);
    setSearchError(null);
    try {
      const items = await searchGeocode(query);
      setSuggestions(items);
      if (items.length === 0) {
        setSearchError('No results with a valid timezone. Try a more specific location.');
      }
    } catch {
      setSearchError('Geocoding unavailable');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleChangeText = (text: string) => {
    onChangeQuery(text);
    if (selected) {
      onClearSelection();
    }
    setOpen(true);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(text);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
  };

  const handleSelect = (item: GeocodeResult) => {
    onSelect(item);
    onChangeQuery(item.label);
    setSuggestions([]);
    setOpen(false);
    setSearchError(null);
  };

  const handleClear = () => {
    onClearSelection();
    onChangeQuery('');
    setSuggestions([]);
    setOpen(false);
    setSearchError(null);
  };

  const displayError = error ?? searchError;

  if (selected) {
    return (
      <View style={styles.container}>
        {label ? <Text style={authStyles.label}>{label}</Text> : null}
        <View style={styles.confirmedRow}>
          <Text style={styles.confirmedLabel} numberOfLines={2}>
            {selected.label}
          </Text>
          <Pressable
            onPress={handleClear}
            hitSlop={8}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
            accessibilityLabel="Clear selected location"
          >
            <Text style={styles.clearButtonText}>×</Text>
          </Pressable>
        </View>
        <Text style={styles.confirmedHint}>Location confirmed</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {label ? <Text style={authStyles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={handleChangeText}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        autoCapitalize="words"
        autoCorrect={false}
        style={authStyles.input}
      />
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.accent.DEFAULT} />
          <Text style={styles.loadingText}>Searching…</Text>
        </View>
      ) : null}
      {open && suggestions.length > 0 ? (
        <FlatList
          data={suggestions}
          keyExtractor={(item, index) => `${item.lat}-${item.lon}-${index}`}
          keyboardShouldPersistTaps="handled"
          style={styles.suggestions}
          nestedScrollEnabled
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelect(item)}
              style={({ pressed }) => [styles.suggestionItem, pressed && styles.pressed]}
            >
              <Text style={styles.suggestionText}>{item.label}</Text>
            </Pressable>
          )}
        />
      ) : null}
      {displayError ? <Text style={styles.errorText}>{displayError}</Text> : null}
      {!selected && value.trim().length > 0 ? (
        <Text style={styles.hintText}>Select a location from the list above</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  confirmedRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent.DEFAULT,
    borderRadius: 12,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 10,
  },
  confirmedLabel: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
  },
  confirmedHint: {
    marginTop: 8,
    color: colors.accent.DEFAULT,
    fontSize: 12,
    fontFamily: 'Manrope-Medium',
  },
  clearButton: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    color: colors.text.muted,
    fontSize: 24,
    lineHeight: 24,
    fontFamily: 'Manrope-Regular',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  suggestions: {
    maxHeight: 180,
    marginTop: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  suggestionItem: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: {
    backgroundColor: colors.surfaceLight,
  },
  suggestionText: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
  hintText: {
    marginTop: 8,
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  errorText: {
    marginTop: 8,
    color: colors.error,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
});
