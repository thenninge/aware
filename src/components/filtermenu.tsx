import React from 'react';
import { GroupHeading, MenuButton, MenuPanel, SliderRow, ToggleRow } from './ui/MenuControls';

interface CategoryFilter {
  city: boolean;
  town: boolean;
  village: boolean;
  hamlet: boolean;
  farm: boolean;
  isolated_dwelling: boolean;
}

interface CategoryConfig {
  color: string;
  opacity: number;
  icon: string;
}

/**
 * «Vis på kartet» (☑️): alt som slås av/på eller justeres ofte ute i felt.
 * Utseende (farger, størrelser) og oppsett ligger i Innstillinger.
 */
interface FilterMenuProps {
  mode?: 'aware' | 'track' | 'søk';
  // Rekkevidder
  radius: number;
  onRadiusChange: (radius: number) => void;
  losRangeMeters?: number;
  onLosRangeChange?: (v: number) => void;
  losHeightMeters?: number;
  onLosHeightChange?: (v: number) => void;
  targetRangeMeters?: number;
  onTargetRangeChange?: (v: number) => void;
  // Kartlag
  showShots?: boolean;
  onShowShotsChange?: (v: boolean) => void;
  showOnlyLastShot?: boolean;
  onShowOnlyLastShotChange?: (v: boolean) => void;
  showTracks?: boolean;
  onShowTracksChange?: (v: boolean) => void;
  showFinds?: boolean;
  onShowFindsChange?: (v: boolean) => void;
  showSearchTracks?: boolean;
  onShowSearchTracksChange?: (v: boolean) => void;
  showSearchFinds?: boolean;
  onShowSearchFindsChange?: (v: boolean) => void;
  showObservations?: boolean;
  onShowObservationsChange?: (v: boolean) => void;
  showHuntingBoundary?: boolean;
  onShowHuntingBoundaryChange?: (v: boolean) => void;
  showNoHuntZones?: boolean;
  onShowNoHuntZonesChange?: (v: boolean) => void;
  showNewCuts?: boolean;
  onShowNewCutsChange?: (v: boolean) => void;
  showElevationProfile?: boolean;
  onShowElevationProfileChange?: (v: boolean) => void;
  // Bebyggelse (Aware)
  showMarkers: boolean;
  onShowMarkersChange: (show: boolean) => void;
  categoryFilters: CategoryFilter;
  onCategoryChange: (category: keyof CategoryFilter) => void;
  categoryConfigs: Record<keyof CategoryFilter, CategoryConfig>;
  // Track (søk)
  batterySaver?: boolean;
  onBatterySaverChange?: (v: boolean) => void;
  onSync?: () => void;
}

const categoryLabels: Record<keyof CategoryFilter, string> = {
  city: 'By',
  town: 'Tettsted',
  village: 'Landsby',
  hamlet: 'Grend',
  farm: 'Gård',
  isolated_dwelling: 'Enkeltbolig',
};

const MODE_NAMES = { aware: 'Aware', track: 'Shoot', søk: 'Track' } as const;

export default function FilterMenu(props: FilterMenuProps) {
  const { mode = 'aware' } = props;
  const isSearch = mode === 'søk';

  // I Track-modus har spor og funn egne brytere.
  const tracksOn = isSearch ? props.showSearchTracks : props.showTracks;
  const setTracks = isSearch ? props.onShowSearchTracksChange : props.onShowTracksChange;
  const findsOn = isSearch ? props.showSearchFinds : props.showFinds;
  const setFinds = isSearch ? props.onShowSearchFindsChange : props.onShowFindsChange;

  return (
    <MenuPanel title="Vis på kartet" subtitle={`Gjelder ${MODE_NAMES[mode]}-modus`}>
      {/* Rekkevidde: bare det som hører til modusen */}
      {mode === 'aware' && (
        <>
          <GroupHeading>Rekkevidde</GroupHeading>
          <SliderRow
            label="Søkeradius"
            value={props.radius}
            min={1000}
            max={4000}
            step={500}
            onChange={props.onRadiusChange}
            format={(v) => `${(v / 1000).toLocaleString('nb-NO')} km`}
          />
          {props.onLosRangeChange && (
            <SliderRow
              label="Sikt: rekkevidde"
              value={props.losRangeMeters ?? 350}
              min={100}
              max={500}
              step={10}
              onChange={props.onLosRangeChange}
              format={(v) => `${v} m`}
            />
          )}
          {props.onLosHeightChange && (
            <SliderRow
              label="Sikt: høyde over bakken"
              value={props.losHeightMeters ?? 5}
              min={0}
              max={15}
              step={1}
              onChange={props.onLosHeightChange}
              format={(v) => `${v} m`}
            />
          )}
        </>
      )}
      {mode === 'track' && props.onTargetRangeChange && (
        <>
          <GroupHeading>Rekkevidde</GroupHeading>
          <SliderRow
            label="Maks skuddavstand"
            value={props.targetRangeMeters ?? 500}
            min={200}
            max={1000}
            step={50}
            onChange={props.onTargetRangeChange}
            format={(v) => `${v} m`}
          />
        </>
      )}
      {isSearch && props.onBatterySaverChange && (
        <>
          <GroupHeading>Sporing</GroupHeading>
          <ToggleRow
            label="Batterisparing"
            description="Sjeldnere og mindre nøyaktig GPS"
            checked={!!props.batterySaver}
            onChange={props.onBatterySaverChange}
          />
        </>
      )}

      <GroupHeading>Kartlag</GroupHeading>
      {props.onShowShotsChange && (
        <ToggleRow label="Skuddpar" checked={!!props.showShots} onChange={props.onShowShotsChange} />
      )}
      {props.onShowOnlyLastShotChange && props.showShots && (
        <ToggleRow
          indent
          label="Bare siste skuddpar"
          checked={!!props.showOnlyLastShot}
          onChange={props.onShowOnlyLastShotChange}
        />
      )}
      {setTracks && <ToggleRow label="Søkespor" checked={!!tracksOn} onChange={setTracks} />}
      {setFinds && <ToggleRow label="Funn" checked={!!findsOn} onChange={setFinds} />}
      {props.onShowObservationsChange && (
        <ToggleRow label="Observasjoner" checked={!!props.showObservations} onChange={props.onShowObservationsChange} />
      )}
      {props.onShowHuntingBoundaryChange && (
        <ToggleRow label="Jaktgrense" checked={!!props.showHuntingBoundary} onChange={props.onShowHuntingBoundaryChange} />
      )}
      {props.onShowNoHuntZonesChange && (
        <ToggleRow label="Ikke-jakt-soner" checked={!!props.showNoHuntZones} onChange={props.onShowNoHuntZonesChange} />
      )}
      {props.onShowNewCutsChange && (
        <ToggleRow
          label="Nye hogster"
          description="Fra satellitt, kan bomme litt"
          checked={!!props.showNewCuts}
          onChange={props.onShowNewCutsChange}
        />
      )}
      {mode === 'aware' && props.onShowElevationProfileChange && (
        <ToggleRow
          label="Høydeprofil"
          description="Ved avstandsmåling"
          checked={!!props.showElevationProfile}
          onChange={props.onShowElevationProfileChange}
        />
      )}

      {mode === 'aware' && (
        <>
          <GroupHeading>Bebyggelse</GroupHeading>
          <ToggleRow label="Vis bebyggelse" checked={props.showMarkers} onChange={props.onShowMarkersChange} />
          {props.showMarkers && (
            <div className="grid grid-cols-2 gap-2 pt-2" role="group" aria-label="Typer bebyggelse">
              {(Object.keys(categoryLabels) as (keyof CategoryFilter)[]).map((cat) => {
                const on = props.categoryFilters[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={on}
                    onClick={() => props.onCategoryChange(cat)}
                    className={`min-h-[3rem] px-3 rounded-xl flex items-center gap-2 text-base font-semibold border-2 transition-colors ${
                      on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-300'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 shrink-0 rounded-full ring-1 ring-white/60"
                      style={{ background: props.categoryConfigs[cat]?.color ?? '#999', opacity: on ? 1 : 0.4 }}
                    />
                    {categoryLabels[cat]}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {isSearch && props.onSync && (
        <div className="mt-4">
          <MenuButton tone="primary" onClick={props.onSync}>
            Synkroniser med laget
          </MenuButton>
        </div>
      )}
    </MenuPanel>
  );
}
