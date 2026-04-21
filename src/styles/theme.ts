export const theme = {
  colors: {
    background: '#EEF6FF',
    backgroundElevated: '#F5FAFF',
    surface: '#FFFFFF',
    surfaceMuted: '#EAF4FF',
    stroke: '#C8DFF5',
    strokeStrong: '#A8C8E8',
    text: '#0A2540',
    textSecondary: '#3A6080',
    textTertiary: '#6A90B0',
    primary: '#1A7FD4',
    primarySoft: '#D6EEFF',
    secondary: '#00B4D8',
    warning: '#FF9F0A',
    danger: '#FF453A',
    info: '#48CAE4',
    navy: '#023E8A'
  },
  radius: {
    xs: 10,
    sm: 14,
    md: 18,
    lg: 24,
    xl: 30,
    pill: 999
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 30
  }
} as const;

export const typography = {
  hero: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800' as const
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800' as const
  },
  section: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800' as const
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500' as const
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700' as const
  }
} as const;
