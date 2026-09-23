import { Platform } from 'react-native';

/*
|--------------------------------------------------------------------------
| SANITARY INSPECTION APP — "CIVIC TEAL"
|--------------------------------------------------------------------------
|
| Visual direction:
| - Public-health / environmental sanitation
| - Professional government field-tool feel
| - Warm instead of sterile
| - High readability outdoors
| - Status colors have meaning
|
|--------------------------------------------------------------------------
*/

// ============================================================================
// COLORS
// ============================================================================

export const COLORS = {
  // --------------------------------------------------------------------------
  // Brand — Civic Teal
  // --------------------------------------------------------------------------

  primary: '#075E5A',
  primaryDark: '#064743',
  primaryDeep: '#043B38',
  primaryLight: '#DCEFED',
  primarySoft: '#EEF7F5',

  // --------------------------------------------------------------------------
  // Backgrounds / Surfaces
  // --------------------------------------------------------------------------

  background: '#F4F3EE',
  backgroundAlt: '#ECEDE7',

  surface: '#FFFFFF',
  surfaceElevated: '#FAFAF7',
  surfaceMuted: '#ECECE6',
  surfacePressed: '#E4E7E2',

  // --------------------------------------------------------------------------
  // Typography
  // --------------------------------------------------------------------------

  text: '#17211F',
  textSecondary: '#5F6B68',
  textMuted: '#89918F',
  textDisabled: '#A9B0AE',

  textOnPrimary: '#FFFFFF',
  textOnDark: '#FFFFFF',

  // --------------------------------------------------------------------------
  // Borders / Dividers
  // --------------------------------------------------------------------------

  border: '#D8DDD9',
  borderStrong: '#BEC7C3',
  divider: '#E7E9E6',

  // --------------------------------------------------------------------------
  // Inspection Status
  // --------------------------------------------------------------------------

  compliant: '#2F7D57',
  compliantDark: '#245F44',
  compliantSoft: '#E5F3EA',

  violation: '#B8423A',
  violationDark: '#91342E',
  violationSoft: '#FBE9E7',

  warning: '#B7791F',
  warningDark: '#8F5D17',
  warningSoft: '#FFF3D6',

  info: '#3D6F82',
  infoDark: '#305968',
  infoSoft: '#E6F0F4',

  // --------------------------------------------------------------------------
  // Neutral / N/A
  // --------------------------------------------------------------------------

  neutral: '#687471',
  neutralDark: '#4D5956',
  neutralSoft: '#ECEFED',

  // --------------------------------------------------------------------------
  // Offline / Sync
  // --------------------------------------------------------------------------

  offline: '#786451',
  offlineDark: '#5D4D3E',
  offlineSoft: '#F1ECE5',

  syncing: '#3D6F82',
  synced: '#2F7D57',
  syncPending: '#B7791F',
  syncFailed: '#B8423A',

  // --------------------------------------------------------------------------
  // Risk Levels
  // --------------------------------------------------------------------------

  riskLow: '#2F7D57',
  riskLowSoft: '#E5F3EA',

  riskMedium: '#B7791F',
  riskMediumSoft: '#FFF3D6',

  riskHigh: '#B8423A',
  riskHighSoft: '#FBE9E7',

  // --------------------------------------------------------------------------
  // Utility
  // --------------------------------------------------------------------------

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  overlay: 'rgba(23, 33, 31, 0.45)',
};


// ============================================================================
// SPACING
// ============================================================================

export const SPACING = {
  none: 0,

  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  section: 48,
};


// ============================================================================
// BORDER RADIUS
// ============================================================================

export const RADIUS = {
  none: 0,

  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,

  pill: 999,
};


// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  md: 15,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 32,
  hero: 38,
};


export const FONT_WEIGHT = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
  extraBold: '800' as const,
};


export const TYPOGRAPHY = {
  hero: {
    fontSize: FONT_SIZE.hero,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: 44,
    letterSpacing: -1,
  },

  display: {
    fontSize: FONT_SIZE.display,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: 38,
    letterSpacing: -0.6,
  },

  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: 30,
    letterSpacing: -0.3,
  },

  heading: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: 26,
  },

  subheading: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semiBold,
    lineHeight: 24,
  },

  body: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.regular,
    lineHeight: 24,
  },

  bodyMedium: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semiBold,
    lineHeight: 24,
  },

  bodySmall: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.regular,
    lineHeight: 21,
  },

  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: 18,
    letterSpacing: 0.7,
  },

  button: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semiBold,
    lineHeight: 22,
  },

  caption: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.regular,
    lineHeight: 18,
  },

  tiny: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    lineHeight: 15,
  },

  metric: {
    fontSize: 30,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
};


// ============================================================================
// ICON SIZES
// ============================================================================

export const ICON_SIZE = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 26,
  xl: 32,
  huge: 40,
};


// ============================================================================
// COMPONENT SIZES
// ============================================================================

export const SIZE = {
  // Touch targets should remain easy to use during field work.

  touchTarget: 48,

  buttonHeight: 52,
  buttonSmallHeight: 42,

  inputHeight: 52,

  iconButton: 44,

  avatarSmall: 36,
  avatarMedium: 48,
  avatarLarge: 72,

  headerHeight: 64,

  bottomTabHeight: 64,
};


// ============================================================================
// SHADOWS
// ============================================================================

export const SHADOWS = {
  subtle: Platform.select({
    ios: {
      shadowColor: '#17211F',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.04,
      shadowRadius: 4,
    },

    android: {
      elevation: 1,
    },

    default: {},
  }),

  card: Platform.select({
    ios: {
      shadowColor: '#17211F',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },

    android: {
      elevation: 2,
    },

    default: {},
  }),

  elevated: Platform.select({
    ios: {
      shadowColor: '#17211F',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.1,
      shadowRadius: 12,
    },

    android: {
      elevation: 4,
    },

    default: {},
  }),
};


// ============================================================================
// BUTTON THEMES
// ============================================================================

export const BUTTONS = {
  primary: {
    backgroundColor: COLORS.primary,
    textColor: COLORS.white,
    borderColor: COLORS.primary,
  },

  secondary: {
    backgroundColor: COLORS.primarySoft,
    textColor: COLORS.primary,
    borderColor: COLORS.primaryLight,
  },

  outline: {
    backgroundColor: COLORS.transparent,
    textColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  danger: {
    backgroundColor: COLORS.violation,
    textColor: COLORS.white,
    borderColor: COLORS.violation,
  },

  ghost: {
    backgroundColor: COLORS.transparent,
    textColor: COLORS.primary,
    borderColor: COLORS.transparent,
  },

  disabled: {
    backgroundColor: COLORS.surfaceMuted,
    textColor: COLORS.textDisabled,
    borderColor: COLORS.border,
  },
};


// ============================================================================
// INPUT THEME
// ============================================================================

export const INPUTS = {
  default: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    textColor: COLORS.text,
    placeholderColor: COLORS.textMuted,
  },

  focused: {
    borderColor: COLORS.primary,
  },

  error: {
    borderColor: COLORS.violation,
    backgroundColor: COLORS.violationSoft,
  },

  disabled: {
    backgroundColor: COLORS.surfaceMuted,
    borderColor: COLORS.border,
    textColor: COLORS.textDisabled,
  },
};


// ============================================================================
// STATUS BADGES
// ============================================================================

export const STATUS = {
  compliant: {
    background: COLORS.compliantSoft,
    foreground: COLORS.compliant,
    border: '#C7E5D2',
  },

  violation: {
    background: COLORS.violationSoft,
    foreground: COLORS.violation,
    border: '#F0C8C4',
  },

  warning: {
    background: COLORS.warningSoft,
    foreground: COLORS.warning,
    border: '#EBD8A7',
  },

  info: {
    background: COLORS.infoSoft,
    foreground: COLORS.info,
    border: '#C9DEE7',
  },

  neutral: {
    background: COLORS.neutralSoft,
    foreground: COLORS.neutral,
    border: COLORS.border,
  },
};


// ============================================================================
// INSPECTION OPTIONS
// ============================================================================

export const INSPECTION_STATUS = {
  compliant: {
    label: 'Compliant',
    color: COLORS.compliant,
    background: COLORS.compliantSoft,
  },

  nonCompliant: {
    label: 'Non-Compliant',
    color: COLORS.violation,
    background: COLORS.violationSoft,
  },

  notApplicable: {
    label: 'N/A',
    color: COLORS.neutral,
    background: COLORS.neutralSoft,
  },
};


// ============================================================================
// RISK LEVELS
// ============================================================================

export const RISK = {
  low: {
    label: 'LOW RISK',
    color: COLORS.riskLow,
    background: COLORS.riskLowSoft,
  },

  medium: {
    label: 'MODERATE RISK',
    color: COLORS.riskMedium,
    background: COLORS.riskMediumSoft,
  },

  high: {
    label: 'HIGH RISK',
    color: COLORS.riskHigh,
    background: COLORS.riskHighSoft,
  },
};


// ============================================================================
// SYNC STATES
// ============================================================================

export const SYNC = {
  synced: {
    label: 'Synced',
    color: COLORS.synced,
    background: COLORS.compliantSoft,
  },

  pending: {
    label: 'Pending Sync',
    color: COLORS.syncPending,
    background: COLORS.warningSoft,
  },

  syncing: {
    label: 'Syncing',
    color: COLORS.syncing,
    background: COLORS.infoSoft,
  },

  offline: {
    label: 'Offline',
    color: COLORS.offline,
    background: COLORS.offlineSoft,
  },

  failed: {
    label: 'Sync Failed',
    color: COLORS.syncFailed,
    background: COLORS.violationSoft,
  },
};


// ============================================================================
// LAYOUT
// ============================================================================

export const LAYOUT = {
  screenPadding: SPACING.lg,

  sectionGap: SPACING.xxl,

  cardPadding: SPACING.lg,

  contentMaxWidth: 700,

  dividerHeight: 1,
};


// ============================================================================
// CARD STYLES
// ============================================================================

export const CARDS = {
  standard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },

  flat: {
    backgroundColor: COLORS.surface,
    borderBottomColor: COLORS.divider,
    borderBottomWidth: 1,
    paddingVertical: SPACING.lg,
  },

  highlighted: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primaryLight,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
};


// ============================================================================
// COMPLETE THEME
// ============================================================================

export const THEME = {
  colors: COLORS,

  spacing: SPACING,

  radius: RADIUS,

  fontSize: FONT_SIZE,

  fontWeight: FONT_WEIGHT,

  typography: TYPOGRAPHY,

  icons: ICON_SIZE,

  size: SIZE,

  shadows: SHADOWS,

  buttons: BUTTONS,

  inputs: INPUTS,

  status: STATUS,

  inspectionStatus: INSPECTION_STATUS,

  risk: RISK,

  sync: SYNC,

  layout: LAYOUT,

  cards: CARDS,
};

export default THEME;
