'use client';

import type { ReactNode } from 'react';

/**
 * Felles byggeklosser for menyene «Vis på kartet» og «Innstillinger».
 * Alle trykkflater er minst 3rem (48 px ved normal størrelse) og følger --ui-scale.
 */

export function MenuPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-xl w-[min(24rem,calc(100vw-1rem))] max-h-[calc(100dvh-env(safe-area-inset-top,0px)-6rem)] overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm px-4 pt-3 pb-2 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 leading-tight">{title}</h3>
        {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </div>
  );
}

/** Overskrift for en gruppe i et panel. */
export function GroupHeading({ children }: { children: ReactNode }) {
  return <div className="mt-4 mb-1 text-sm font-bold uppercase tracking-wide text-gray-600">{children}</div>;
}

/** Hel rad som slår noe av/på. Hele raden er trykkflate. */
export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  indent,
  swatch,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  indent?: boolean;
  swatch?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-full min-h-[3rem] flex items-center gap-3 py-2 text-left border-b border-gray-100 last:border-b-0 disabled:opacity-50 ${indent ? 'pl-6' : ''}`}
    >
      {swatch && <span className="w-3.5 h-3.5 shrink-0 rounded-full ring-1 ring-black/20" style={{ background: swatch }} />}
      <span className="flex-1 min-w-0">
        <span className="block text-base font-medium text-gray-900">{label}</span>
        {description && <span className="block text-sm text-gray-600">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
        />
      </span>
    </button>
  );
}

/** Glidebryter med stor verdi til høyre for etiketten. */
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <label className="block py-2">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-base font-medium text-gray-900">{label}</span>
        <span className="text-lg font-bold tabular-nums text-gray-900">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="aware-range w-full mt-1"
        style={{ ['--pct' as string]: `${pct}%` }}
      />
      {hint && <span className="block text-sm text-gray-600">{hint}</span>}
    </label>
  );
}

/** Fargevelger som rad: etikett til venstre, stor fargeprøve til høyre. */
export function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="min-h-[3rem] flex items-center justify-between gap-3 py-1 cursor-pointer">
      <span className="text-base font-medium text-gray-900">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-14 h-10 shrink-0 rounded-lg border border-gray-300 cursor-pointer bg-white p-0.5"
      />
    </label>
  );
}

/** Segmentert valg (radioknapper). */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="py-2">
      {label && <div className="text-base font-medium text-gray-900 mb-1">{label}</div>}
      <div
        className="grid gap-1 rounded-xl bg-gray-100 p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={`min-h-[2.75rem] rounded-lg text-base font-semibold leading-tight transition-colors ${
              value === opt.value ? 'bg-blue-600 text-white shadow' : 'text-gray-800 hover:bg-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Trekkspill-seksjon. Styres utenfra slik at bare én er åpen om gangen. */
export function Section({
  title,
  summary,
  open,
  onToggle,
  children,
  innerRef,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div ref={innerRef} className="border-b border-gray-200 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="w-full min-h-[3.5rem] flex items-center gap-3 py-2 text-left"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-lg font-semibold text-gray-900">{title}</span>
          {summary && !open && <span className="block text-sm text-gray-600 truncate">{summary}</span>}
        </span>
        <svg
          aria-hidden="true"
          width="1.5rem"
          height="1.5rem"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

const BUTTON_TONES = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300',
  success: 'bg-green-600 hover:bg-green-700 text-white',
  danger: 'bg-white hover:bg-red-50 text-red-700 border-2 border-red-600',
} as const;

export function MenuButton({
  tone = 'secondary',
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof BUTTON_TONES }) {
  return (
    <button
      type="button"
      className={`w-full min-h-[3rem] px-4 rounded-xl text-base font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_TONES[tone]} ${className}`}
      {...rest}
    />
  );
}
