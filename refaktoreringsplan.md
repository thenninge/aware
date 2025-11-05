## Refaktoreringsplan for MapComponent

Mål: gjøre `src/components/mapcomponent.tsx` vesentlig mindre, mer testbar og enklere å vedlikeholde – uten å bryte eksisterende funksjonalitet.

Prinsipper
- Små, inkrementelle steg (maks ~300–500 LOC endring pr. PR/commit).
- Ingen funksjonsendringer per steg; kun flytting/uttrekk og bedre struktur.
- Behold eksisterende navn/props der mulig for minimal diff; innfør adaptere der nødvendig.
- Egen mappe for lag (layers), overlays og dialoger for bedre oversikt.

Fase 1 — Del opp kartlag (Layers)
- Opprett komponenter i `src/components/layers/`:
  - `ShotPairsLayer.tsx` (skuddpar: punkter + stiplet linje)
  - `TracksLayer.tsx` (aktive punkter/linje og lagrede spor)
  - `FindsLayer.tsx` (funn-markører)
  - `ObservationsLayer.tsx` (observasjonssirkler)
  - `MeasurementLayer.tsx` (avstandsmåling)
- Hver komponent får tydelige props (data, synlighetsflagg, farger/størrelser, klikk‑/slettehandlere).
- `MapComponent` rendrer disse lagene betinget ut fra `mode` og filtertilstand.

Fase 2 — Overlays (skjermfikserte elementer)
- Flytt senterprikk og kompass‑kakestykke til `src/components/overlays/CenterOverlay.tsx` og `CompassOverlay.tsx`.
- Props: `isLiveMode`, `compassMode`, `isCompassLocked`, `heading`, `zIndex`.
- Behold gjeldende z‑index prioritet der menyene ligger øverst.

Fase 3 — Dialoger/Modals
- Flytt dialoger til `src/components/dialogs/`:
  - `TargetRangeModal.tsx`, `TargetDirectionModal.tsx`
  - `ObservationRangeModal.tsx`, `ObservationDirectionUI.tsx`
  - `ObservationNameDialog.tsx`, `ShotPairNameDialog.tsx`
  - `FindDialog.tsx`, `TrackSaveDialog.tsx`
- Eksporter som kontrollerte komponenter (åpen/lukket, verdier, onChange/onSubmit/onCancel).

Fase 4 — Data‑hooks og synk
- Opprett hooks i `src/hooks/`:
  - `useShotPairs` (fetchPosts, slett skuddpar, avled fullShotPairs/lastFullPair)
  - `useTracks`, `useFinds`, `useObservations` (localStorage <-> state, best‑effort sync)
  - `useSync` (push/pull mot `/api/sync`, resultat/feil, progress)
- Målet er å flytte “forretningslogikk” ut av `MapComponent`.

Fase 5 — Utils og typer
- `src/lib/geo.ts`: `destinationPoint`, grad/radian helpers, normalisering av vinkler.
- `src/lib/time.ts`: DTG‑formattering, tidsstempler.
- `src/lib/dataDelete.ts`: `deleteFind`, `deleteObservation`, `deleteTrack`, `deleteShotPair` (lokal + best‑effort API).
- `src/types/map.ts`: `Position`, `SavedTrack`, `SavedFind`, `SavedObservation`, `ShotPair` (+ farge/visningskonfig).

Fase 6 — Tynn ut `MapComponent`
- Behold orkestrering: props, mode, filter‑state, og enkel wiring mellom hooks, lag, overlays og dialoger.
- Fjern inline JSX for lag/dialoger – erstatt med importerte komponenter.

Fase 7 — Verifikasjon og ytelse
- Manuell sjekkliste pr. steg:
  - Modusvisning (Aware/Shoot/Track/“søk”) uendret
  - Filtre: skuddpar, kun siste skuddpar, funn, søkespor, observasjoner, jaktgrenser
  - Dialogflyt: Target, Observasjon (avstand/retning/navn), Track save, Find
  - Kompass: live/locked, kakestykke/overlay, z‑index over/under riktig UI
  - Synk: push/pull, feilmeldinger, datalasting etter sync
- Ytelsestiltak (etter strukturdeling):
  - `React.memo` på lagene (props‑sammenlikning)
  - Memoiserte avledede lister (fullShotPairs, lastFullPair) i hooks
  - Unngå unødvendige re‑renders via stable callbacks (`useCallback`)

Akseptansekriterier
- Ingen visuell/atferdsmessig regresjon per steg.
- Lint/type passerer lokalt. Vercel bygg grønt.
- `MapComponent` < ~800 LOC etter fase 3; < ~400 LOC etter fase 6.

Plan for utrulling
1) Fase 1 (Layers) → små PRer: ShotPairsLayer først, så TracksLayer, deretter Finds/Observations/Measurement.
2) Fase 2 (Overlays) → 1 PR.
3) Fase 3 (Dialoger) → 2–3 PRer (Target/Observation/Øvrige).
4) Fase 4–5 (Hooks/Utils/Types) → 2 PRer.
5) Fase 6 (Tynning) → 1 PR.

Risiko og mitigering
- Store filer med tett kobling → angrip i små biter; skriv adapter‑props for midlertidig kompatibilitet.
- Z‑index/regresjoner → beholde klasser og verdier; visuell test i alle moduser.
- Synk/lagring → behold eksisterende lagring, flytt forsiktig; ikke endre datastruktur i samme PR.

Oppfølgingsoppgaver (todo)
- Extract lag‑komponenter
- Extract overlays
- Extract dialoger
- Hooks for data og sync
- Utils/typer flyttes ut
- Tynne ut `MapComponent`


