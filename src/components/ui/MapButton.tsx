'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type MapButtonTone = 'neutral' | 'primary' | 'success' | 'danger' | 'warning' | 'busy';

const TONES: Record<MapButtonTone, string> = {
  neutral: 'bg-gray-900/85 text-white hover:bg-gray-800',
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  success: 'bg-green-600 text-white hover:bg-green-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  warning: 'bg-amber-500 text-gray-950 hover:bg-amber-600',
  busy: 'bg-gray-500 text-white cursor-wait',
};

interface MapButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  /** Kort etikett under ikonet. Hold den på ett ord. */
  label?: string;
  tone?: MapButtonTone;
}

/**
 * Rund-firkantet kartknapp med ikon og etikett.
 * Alle mål er i rem, så de følger «Visningsstørrelse» (--ui-scale på <html>).
 * 3.5rem = 56 px ved normal størrelse.
 */
export default function MapButton({
  icon,
  label,
  tone = 'neutral',
  className = '',
  style,
  title,
  ...rest
}: MapButtonProps) {
  return (
    <button
      type="button"
      aria-label={title ?? label}
      title={title ?? label}
      className={`w-14 h-14 shrink-0 rounded-2xl shadow-lg ring-2 ring-white/70 flex flex-col items-center justify-center gap-0.5 transition-colors select-none disabled:opacity-60 ${TONES[tone]} ${className}`}
      style={{ pointerEvents: 'auto', ...style }}
      {...rest}
    >
      <span className="flex items-center justify-center">{icon}</span>
      {label && <span className="text-xs font-bold leading-none tracking-tight">{label}</span>}
    </button>
  );
}
