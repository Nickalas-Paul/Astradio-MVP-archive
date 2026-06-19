import { StyleSheet } from 'react-native';
import { colors } from './colors';

export const AUTH_HORIZONTAL_PADDING = 24;

export const authStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: AUTH_HORIZONTAL_PADDING,
  },
  heading: {
    color: colors.text.primary,
    fontSize: 24,
    fontFamily: 'Cormorant-SemiBold',
    marginBottom: 24,
  },
  input: {
    minHeight: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
  },
  inputSpacing: {
    marginBottom: 12,
  },
  label: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
    marginBottom: 8,
  },
  primaryButton: {
    minHeight: 48,
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  outlineButton: {
    minHeight: 48,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent.DEFAULT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: {
    color: colors.accent.DEFAULT,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    marginBottom: 12,
  },
  linkText: {
    color: colors.accent.DEFAULT,
    fontFamily: 'Manrope-Medium',
  },
  mutedLinkText: {
    color: colors.text.muted,
    fontFamily: 'Manrope-Regular',
  },
  footerText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    marginTop: 16,
  },
});
