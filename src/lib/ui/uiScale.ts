// Visningsstørrelse: skalerer all rem-basert UI (knapper, tekst, menyer), ikke kartet.
// Lagres lokalt per enhet. Settes på <html> før første tegning (se layout.tsx).

export const UI_SCALE_KEY = 'aware_ui_scale';

export const UI_SCALES = [
  { value: 1, label: 'Normal' },
  { value: 1.15, label: 'Stor' },
  { value: 1.3, label: 'Ekstra stor' },
] as const;

export function readUiScale(): number {
  try {
    const raw = Number(localStorage.getItem(UI_SCALE_KEY));
    return UI_SCALES.some((s) => s.value === raw) ? raw : 1;
  } catch {
    return 1;
  }
}

export function applyUiScale(scale: number): void {
  document.documentElement.style.setProperty('--ui-scale', String(scale));
  try {
    localStorage.setItem(UI_SCALE_KEY, String(scale));
  } catch {
    // privat modus o.l.: gjelder bare denne økten
  }
}

/** Kjøres inline i <head> så siden ikke blinker i feil størrelse. */
export const UI_SCALE_BOOT_SCRIPT = `try{var s=Number(localStorage.getItem('${UI_SCALE_KEY}'));if(s===1.15||s===1.3)document.documentElement.style.setProperty('--ui-scale',String(s));}catch(e){}`;
