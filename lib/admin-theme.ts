export const ADMIN_COLORS = {
  bg: '#0d1424',
  card: '#0f1825',
  border: '#1a2238',
  borderLight: '#243044',
  text: '#ffffff',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  gold: '#D4A017',
  goldMuted: '#b8860b',
  danger: '#ef4444',
  dangerBg: 'rgba(239,68,68,0.1)',
  success: '#22c55e',
  successBg: 'rgba(34,197,94,0.1)',
  warning: '#f59e0b',
  warningBg: 'rgba(245,158,11,0.1)',
  info: '#3b82f6',
  infoBg: 'rgba(59,130,246,0.1)',
} as const

export const HEALTH_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  healthy:  { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   label: 'Healthy'  },
  degraded: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Degraded' },
  down:     { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Down'     },
  unknown:  { color: '#64748b', bg: 'rgba(100,116,139,0.1)', label: 'Unknown'  },
}

export const RUN_STATUS_COLORS: Record<string, { color: string; label: string }> = {
  completed: { color: '#22c55e', label: 'Completed' },
  failed:    { color: '#ef4444', label: 'Failed'    },
  running:   { color: '#3b82f6', label: 'Running'   },
  timeout:   { color: '#f59e0b', label: 'Timeout'   },
}
