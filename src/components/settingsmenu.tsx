'use client';

import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import OfflineMapManager from './OfflineMapManager';
import { getOfflineAreas, isOfflineForHuntingArea, type OfflineArea } from '@/lib/idb';
import { readHomeForArea, writeHomeForArea } from '@/lib/map/huntingAreaHome';
import { UI_SCALES, applyUiScale, readUiScale } from '@/lib/ui/uiScale';
import { ColorRow, GroupHeading, MenuButton, MenuPanel, Section, Segmented, SliderRow, ToggleRow } from './ui/MenuControls';

interface CategoryConfig {
  color: string;
  opacity: number;
  icon: string;
}

/**
 * Innstillinger (⚙️): oppsett og utseende. Det som slås av/på ute i felt
 * (kartlag, rekkevidder, bebyggelse) ligger i «Vis på kartet» (filtermenu.tsx).
 * Alt lagres automatisk (se page.tsx).
 */
interface SettingsMenuProps {
  // Bebyggelse-sektorer
  categoryConfigs: Record<string, CategoryConfig>;
  angleRange: number;
  onAngleRangeChange: (angleRange: number) => void;
  onCategoryConfigChange: (category: string, config: CategoryConfig) => void;
  onDeleteAllShots?: () => void;
  // Retikkel
  showMSRRetikkel?: boolean;
  msrRetikkelOpacity?: number;
  msrRetikkelStyle?: 'msr' | 'ivar' | 'circle';
  msrRetikkelVerticalPosition?: number;
  onShowMSRRetikkelChange?: (show: boolean) => void;
  onMSRRetikkelOpacityChange?: (opacity: number) => void;
  onMSRRetikkelStyleChange?: (style: 'msr' | 'ivar' | 'circle') => void;
  onMSRRetikkelVerticalPositionChange?: (position: number) => void;
  // Skudd og spor
  targetSize?: number;
  shotSize?: number;
  observationSize?: number;
  targetLineColor?: string;
  shotColor?: string;
  targetColor?: string;
  targetLineWeight?: number;
  onTargetSizeChange?: (size: number) => void;
  onShotSizeChange?: (size: number) => void;
  onObservationSizeChange?: (size: number) => void;
  onTargetLineColorChange?: (color: string) => void;
  onShotColorChange?: (color: string) => void;
  onTargetColorChange?: (color: string) => void;
  onTargetLineWeightChange?: (weight: number) => void;
  // Jaktfelt
  huntingAreas?: HuntingArea[];
  activeHuntingAreaId?: string | null;
  onDefineNewHuntingArea?: () => void;
  onActiveHuntingAreaChange?: (id: string | null) => void;
  onDeleteHuntingArea?: (id: string) => void;
  onDefineNewNoHuntZone?: () => void;
  huntingBoundaryColor?: string;
  huntingBoundaryWeight?: number;
  huntingBoundaryOpacity?: number;
  onHuntingBoundaryColorChange?: (color: string) => void;
  onHuntingBoundaryWeightChange?: (weight: number) => void;
  onHuntingBoundaryOpacityChange?: (opacity: number) => void;
  newCutsColor?: string;
  onNewCutsColorChange?: (color: string) => void;
  newCutsOpacity?: number;
  onNewCutsOpacityChange?: (opacity: number) => void;
  // Kompass og zoom
  compassSliceLength?: number; // 0-100 (% of screen height)
  onCompassSliceLengthChange?: (length: number) => void;
  showZoomButtons?: boolean;
  onShowZoomButtonsChange?: (v: boolean) => void;
  zoomButtonsX?: number;
  zoomButtonsY?: number;
  onZoomButtonsXChange?: (v: number) => void;
  onZoomButtonsYChange?: (v: number) => void;
  zoomButtonsSide?: 'left' | 'right';
  onZoomButtonsSideChange?: (v: 'left' | 'right') => void;
  // Sikt (LOS) – utseende. Rekkevidde/høyde ligger i «Vis på kartet».
  losColor?: string;
  onLosColorChange?: (v: string) => void;
  losHoleColor?: string;
  onLosHoleColorChange?: (v: string) => void;
  losOpacity?: number;
  onLosOpacityChange?: (v: number) => void;
  losHoleOpacity?: number;
  onLosHoleOpacityChange?: (v: number) => void;
  // Offline kart
  onDefineOfflineArea?: () => void;
  isDefiningOfflineArea?: boolean;
  selectedMapLayer?: {
    key: string;
    name: string;
    url: string;
  };
  definedOfflineBounds?: { north: number; south: number; east: number; west: number } | null;
  onConfirmOfflineDownload?: (name: string, zoomLevels: number[], includeElevation: boolean, onProgress: (progress: { current: number; total: number; percentage: number }) => void) => Promise<void>;
  onCancelOfflineDefine?: () => void;
  onUseHuntingAreaForOffline?: () => void;
}

export interface HuntingArea {
  id: string;
  name: string;
  coordinates: [number, number][]; // Array of [lat, lng] points defining the boundary
  color: string;
  lineWeight: number;
  created_at: string;
  team_id?: string; // For future Supabase integration
}

type SectionKey = 'area' | 'offline' | 'look' | 'sectors' | 'reticle' | 'controls' | 'data';

const CATEGORY_LABELS: Record<string, string> = {
  city: 'By',
  town: 'Tettsted',
  village: 'Landsby',
  hamlet: 'Grend',
  farm: 'Gård',
  isolated_dwelling: 'Enkeltbolig',
};

const pct = (v: number) => `${Math.round(v)} %`;

function Toast({ text, tone }: { text: string; tone: 'ok' | 'error' }) {
  if (typeof window === 'undefined') return null;
  return createPortal(
    <div
      role="status"
      className={`fixed top-24 left-1/2 -translate-x-1/2 z-[3000] px-6 py-3 rounded-full shadow-lg text-lg font-semibold text-white ${
        tone === 'ok' ? 'bg-green-700' : 'bg-gray-700'
      }`}
    >
      {text}
    </div>,
    document.body
  );
}

export default function SettingsMenu(props: SettingsMenuProps & { currentCenter?: { lat: number; lng: number } }) {
  const {
    categoryConfigs,
    onCategoryConfigChange,
    angleRange,
    onAngleRangeChange,
    currentCenter,
    huntingAreas,
    activeHuntingAreaId,
    definedOfflineBounds,
  } = props;

  const offlineSectionRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<SectionKey | null>(definedOfflineBounds ? 'offline' : null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [savedHome, setSavedHome] = useState<{ lat: number; lng: number } | null>(null);
  const [offlineAreas, setOfflineAreas] = useState<OfflineArea[]>([]);
  const [uiScale, setUiScale] = useState<number>(() => (typeof window === 'undefined' ? 1 : readUiScale()));

  const activeArea = huntingAreas?.find((a) => a.id === activeHuntingAreaId) ?? null;
  const activeAreaIsOffline =
    !!activeHuntingAreaId && offlineAreas.some((o) => isOfflineForHuntingArea(o, activeHuntingAreaId));

  const toggle = (key: SectionKey) => setOpen((cur) => (cur === key ? null : key));
  const flash = (text: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 1400);
  };

  useEffect(() => {
    if (definedOfflineBounds) setOpen('offline');
  }, [definedOfflineBounds]);

  useEffect(() => {
    const load = () => {
      void getOfflineAreas()
        .then(setOfflineAreas)
        .catch(() => setOfflineAreas([]));
    };
    load();
    window.addEventListener('aware-offline-areas-changed', load);
    return () => window.removeEventListener('aware-offline-areas-changed', load);
  }, []);

  useEffect(() => {
    setSavedHome(activeHuntingAreaId ? readHomeForArea(activeHuntingAreaId) : null);
  }, [activeHuntingAreaId]);

  // Felles opasitet for alle bebyggelse-sektorer
  const opacities = Object.values(categoryConfigs).map((c) => c.opacity);
  const sameOpacity = opacities.every((o) => o === opacities[0]);
  const setAllOpacities = (opacity: number) => {
    Object.entries(categoryConfigs).forEach(([category, config]) => {
      if (config.opacity !== opacity) onCategoryConfigChange(category, { ...config, opacity });
    });
  };

  return (
    <>
      {toast && <Toast text={toast.text} tone={toast.tone} />}
      <MenuPanel title="Innstillinger" subtitle="Endringer lagres automatisk">
        <Segmented
          label="Visningsstørrelse"
          options={UI_SCALES.map((o) => ({ value: o.value, label: o.label }))}
          value={uiScale}
          onChange={(v) => {
            applyUiScale(v);
            setUiScale(v);
          }}
        />

        <div className="mt-2 border-t border-gray-200">
          {/* 1. Jaktfelt: valg, hjem, offline, nye felt */}
          <Section
            title="Jaktfelt"
            summary={activeArea ? `${activeArea.name}${activeAreaIsOffline ? ' · offline' : ''}` : 'Ingen valgt'}
            open={open === 'area'}
            onToggle={() => toggle('area')}
          >
            {huntingAreas !== undefined && props.onActiveHuntingAreaChange && (
              <label className="block py-2">
                <span className="block text-base font-medium text-gray-900 mb-1">Aktivt jaktfelt</span>
                <select
                  value={activeHuntingAreaId || ''}
                  onChange={(e) => props.onActiveHuntingAreaChange?.(e.target.value || null)}
                  className="w-full min-h-[3rem] px-3 text-base border-2 border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Ingen</option>
                  {huntingAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                      {offlineAreas.some((o) => isOfflineForHuntingArea(o, area.id)) ? ' · offline' : ''}
                    </option>
                  ))}
                </select>
                {huntingAreas.length === 0 && (
                  <span className="block text-sm text-gray-600 mt-1">Ingen jaktfelt definert ennå.</span>
                )}
              </label>
            )}

            {activeArea && (
              <>
                <MenuButton
                  className="mt-2"
                  onClick={() => window.dispatchEvent(new Event('aware-focus-hunting-area'))}
                >
                  Vis jaktfeltet på kartet
                </MenuButton>
                <GroupHeading>Hjemposisjon</GroupHeading>
                <p className="text-sm text-gray-700 mb-2">
                  {savedHome
                    ? `Lagret: ${savedHome.lat.toFixed(5)}, ${savedHome.lng.toFixed(5)}`
                    : 'Ingen hjemposisjon lagret. Kartet åpner på feltets midtpunkt.'}
                </p>
                <MenuButton
                  tone="primary"
                  disabled={!currentCenter}
                  onClick={() => {
                    if (!currentCenter || !activeHuntingAreaId) {
                      flash('Kartposisjon ikke klar', 'error');
                      return;
                    }
                    writeHomeForArea(activeHuntingAreaId, currentCenter);
                    setSavedHome(currentCenter);
                    flash('Hjemposisjon lagret');
                  }}
                >
                  Bruk kartets midtpunkt som hjem
                </MenuButton>

                {props.onUseHuntingAreaForOffline && (
                  <>
                    <GroupHeading>Offline</GroupHeading>
                    <MenuButton
                      tone="success"
                      disabled={activeArea.coordinates.length < 3}
                      onClick={() => {
                        props.onUseHuntingAreaForOffline?.();
                        setOpen('offline');
                        requestAnimationFrame(() =>
                          offlineSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        );
                      }}
                    >
                      {activeAreaIsOffline ? 'Last ned feltet på nytt' : 'Last ned feltet for offline bruk'}
                    </MenuButton>
                  </>
                )}
              </>
            )}

            <GroupHeading>Tegn nytt</GroupHeading>
            <div className="grid gap-2">
              {props.onDefineNewHuntingArea && (
                <MenuButton onClick={props.onDefineNewHuntingArea}>Nytt jaktfelt</MenuButton>
              )}
              {props.onDefineNewNoHuntZone && activeArea && (
                <MenuButton onClick={props.onDefineNewNoHuntZone}>Ny ikke-jakt-sone i feltet</MenuButton>
              )}
              {activeArea && props.onDeleteHuntingArea && (
                <MenuButton
                  tone="danger"
                  onClick={() => {
                    if (window.confirm(`Slette jaktfeltet «${activeArea.name}»?`)) {
                      props.onDeleteHuntingArea?.(activeArea.id);
                    }
                  }}
                >
                  Slett «{activeArea.name}»
                </MenuButton>
              )}
            </div>
          </Section>

          {/* 2. Offline kart */}
          {props.onDefineOfflineArea && props.selectedMapLayer && (
            <Section
              innerRef={offlineSectionRef}
              title="Offline kart"
              summary={offlineAreas.length ? `${offlineAreas.length} område${offlineAreas.length === 1 ? '' : 'r'} lagret` : 'Ingen lagret'}
              open={open === 'offline'}
              onToggle={() => toggle('offline')}
            >
              <OfflineMapManager
                onDefineArea={props.onDefineOfflineArea}
                isDefining={props.isDefiningOfflineArea || false}
                selectedLayer={props.selectedMapLayer}
                definedBounds={definedOfflineBounds || null}
                huntingAreaName={activeArea?.name || null}
                onUseHuntingArea={props.onUseHuntingAreaForOffline}
                onConfirmDownload={props.onConfirmOfflineDownload || (async () => {})}
                onCancelDefine={props.onCancelOfflineDefine || (() => {})}
              />
            </Section>
          )}

          {/* 3. Farger og størrelser på kartet */}
          <Section
            title="Farger og størrelser"
            summary="Skudd, spor, jaktgrense, hogst, sikt"
            open={open === 'look'}
            onToggle={() => toggle('look')}
          >
            <p className="text-sm text-gray-700 pt-1">
              Punktene tegnes i riktig størrelse i meter, men blir aldri så små at de forsvinner eller så store at
              de dekker kartet.
            </p>
            <GroupHeading>Skudd og treff</GroupHeading>
            {props.shotColor !== undefined && props.onShotColorChange && (
              <ColorRow label="Standplass" value={props.shotColor} onChange={props.onShotColorChange} />
            )}
            {props.shotSize !== undefined && props.onShotSizeChange && (
              <SliderRow label="Standplass, størrelse" value={props.shotSize} min={2} max={20} onChange={props.onShotSizeChange} format={(v) => `${v} m`} />
            )}
            {props.targetColor !== undefined && props.onTargetColorChange && (
              <ColorRow label="Treffpunkt" value={props.targetColor} onChange={props.onTargetColorChange} />
            )}
            {props.targetSize !== undefined && props.onTargetSizeChange && (
              <SliderRow label="Treffpunkt, størrelse" value={props.targetSize} min={5} max={50} step={5} onChange={props.onTargetSizeChange} format={(v) => `${v} m`} />
            )}
            {props.targetLineColor !== undefined && props.onTargetLineColorChange && (
              <ColorRow label="Skuddlinje" value={props.targetLineColor} onChange={props.onTargetLineColorChange} />
            )}
            {props.targetLineWeight !== undefined && props.onTargetLineWeightChange && (
              <SliderRow label="Skuddlinje, tykkelse" value={props.targetLineWeight} min={1} max={10} onChange={props.onTargetLineWeightChange} format={(v) => `${v} px`} />
            )}
            {props.observationSize !== undefined && props.onObservationSizeChange && (
              <SliderRow label="Observasjon, størrelse" value={props.observationSize} min={1} max={10} step={0.5} onChange={props.onObservationSizeChange} format={(v) => `${v} m`} />
            )}

            <GroupHeading>Jaktgrense</GroupHeading>
            {props.huntingBoundaryColor !== undefined && props.onHuntingBoundaryColorChange && (
              <ColorRow label="Farge" value={props.huntingBoundaryColor} onChange={props.onHuntingBoundaryColorChange} />
            )}
            {props.huntingBoundaryWeight !== undefined && props.onHuntingBoundaryWeightChange && (
              <SliderRow label="Tykkelse" value={props.huntingBoundaryWeight} min={1} max={10} onChange={props.onHuntingBoundaryWeightChange} format={(v) => `${v} px`} />
            )}
            {props.huntingBoundaryOpacity !== undefined && props.onHuntingBoundaryOpacityChange && (
              <SliderRow label="Synlighet" value={props.huntingBoundaryOpacity} min={0} max={100} step={5} onChange={props.onHuntingBoundaryOpacityChange} format={pct} />
            )}

            <GroupHeading>Nye hogster</GroupHeading>
            {props.newCutsColor !== undefined && props.onNewCutsColorChange && (
              <ColorRow label="Farge" value={props.newCutsColor} onChange={props.onNewCutsColorChange} />
            )}
            {props.newCutsOpacity !== undefined && props.onNewCutsOpacityChange && (
              <SliderRow label="Synlighet" value={props.newCutsOpacity} min={0} max={100} step={5} onChange={props.onNewCutsOpacityChange} format={pct} />
            )}

            <GroupHeading>Sikt (LOS)</GroupHeading>
            {props.onLosColorChange && (
              <ColorRow label="Synlig område" value={props.losColor ?? '#00FFAA'} onChange={props.onLosColorChange} />
            )}
            {props.onLosOpacityChange && (
              <SliderRow label="Synlig område, synlighet" value={Math.round((props.losOpacity ?? 0.25) * 100)} min={0} max={100} onChange={(v) => props.onLosOpacityChange?.(v / 100)} format={pct} />
            )}
            {props.onLosHoleColorChange && (
              <ColorRow label="Skjult område" value={props.losHoleColor ?? '#ef4444'} onChange={props.onLosHoleColorChange} />
            )}
            {props.onLosHoleOpacityChange && (
              <SliderRow label="Skjult område, synlighet" value={Math.round((props.losHoleOpacity ?? 0.12) * 100)} min={0} max={100} onChange={(v) => props.onLosHoleOpacityChange?.(v / 100)} format={pct} />
            )}
          </Section>

          {/* 4. Bebyggelse-sektorer (Aware) */}
          <Section
            title="Bebyggelse-sektorer"
            summary={`±${angleRange}° · farger per type`}
            open={open === 'sectors'}
            onToggle={() => toggle('sectors')}
          >
            <SliderRow label="Sektorbredde" value={angleRange} min={1} max={45} onChange={onAngleRangeChange} format={(v) => `±${v}°`} />
            <SliderRow
              label={sameOpacity ? 'Synlighet, alle' : 'Synlighet, alle (ulike nå)'}
              value={Math.round(opacities[0] * 100)}
              min={10}
              max={70}
              step={5}
              onChange={(v) => setAllOpacities(v / 100)}
              format={pct}
            />
            <GroupHeading>Farge per type</GroupHeading>
            {Object.entries(categoryConfigs).map(([category, config]) => (
              <ColorRow
                key={category}
                label={`${config.icon} ${CATEGORY_LABELS[category] ?? category}`}
                value={config.color}
                onChange={(color) => onCategoryConfigChange(category, { ...config, color })}
              />
            ))}
          </Section>

          {/* 5. Retikkel */}
          {props.showMSRRetikkel !== undefined && props.onShowMSRRetikkelChange && (
            <Section
              title="Retikkel (MSR)"
              summary={props.showMSRRetikkel ? 'På' : 'Av'}
              open={open === 'reticle'}
              onToggle={() => toggle('reticle')}
            >
              <ToggleRow label="Vis retikkel" checked={props.showMSRRetikkel} onChange={props.onShowMSRRetikkelChange} />
              {props.showMSRRetikkel && (
                <>
                  {props.msrRetikkelStyle !== undefined && props.onMSRRetikkelStyleChange && (
                    <Segmented
                      label="Type"
                      options={[
                        { value: 'msr' as const, label: 'MSR' },
                        { value: 'ivar' as const, label: 'Ivar' },
                        { value: 'circle' as const, label: 'Sirkel' },
                      ]}
                      value={props.msrRetikkelStyle}
                      onChange={props.onMSRRetikkelStyleChange}
                    />
                  )}
                  {props.msrRetikkelOpacity !== undefined && props.onMSRRetikkelOpacityChange && (
                    <SliderRow label="Synlighet" value={props.msrRetikkelOpacity} min={0} max={100} step={5} onChange={props.onMSRRetikkelOpacityChange} format={pct} />
                  )}
                  {props.msrRetikkelStyle === 'ivar' &&
                    props.msrRetikkelVerticalPosition !== undefined &&
                    props.onMSRRetikkelVerticalPositionChange && (
                      <SliderRow
                        label="Høyde på skjermen"
                        value={props.msrRetikkelVerticalPosition}
                        min={0}
                        max={100}
                        step={5}
                        onChange={props.onMSRRetikkelVerticalPositionChange}
                        format={(v) => `${Math.round(60 + (v / 100) * 25)} % ned`}
                      />
                    )}
                </>
              )}
            </Section>
          )}

          {/* 6. Kompass og zoom */}
          <Section
            title="Kompass og zoomknapper"
            summary={props.showZoomButtons ? 'Zoomknapper på' : 'Zoomknapper av'}
            open={open === 'controls'}
            onToggle={() => toggle('controls')}
          >
            {props.compassSliceLength !== undefined && props.onCompassSliceLengthChange && (
              <SliderRow
                label="Lengde på kompasspil"
                value={props.compassSliceLength}
                min={10}
                max={50}
                step={5}
                onChange={props.onCompassSliceLengthChange}
                format={pct}
                hint="Andel av skjermhøyden"
              />
            )}
            {props.onShowZoomButtonsChange && (
              <ToggleRow label="Vis + / − for zoom" checked={!!props.showZoomButtons} onChange={props.onShowZoomButtonsChange} />
            )}
            {props.showZoomButtons && (
              <>
                {props.onZoomButtonsSideChange && props.zoomButtonsSide !== undefined && (
                  <Segmented
                    label="Side"
                    options={[
                      { value: 'left' as const, label: 'Venstre' },
                      { value: 'right' as const, label: 'Høyre' },
                    ]}
                    value={props.zoomButtonsSide}
                    onChange={props.onZoomButtonsSideChange}
                  />
                )}
                {props.onZoomButtonsYChange && props.zoomButtonsY !== undefined && (
                  <SliderRow label="Avstand fra toppen" value={props.zoomButtonsY} min={0} max={750} step={2} onChange={props.onZoomButtonsYChange} format={(v) => `${v} px`} />
                )}
                {props.onZoomButtonsXChange && props.zoomButtonsX !== undefined && (
                  <SliderRow label="Avstand fra kanten" value={props.zoomButtonsX} min={-10} max={64} onChange={props.onZoomButtonsXChange} format={(v) => `${v} px`} />
                )}
              </>
            )}
          </Section>

          {/* 7. Data (farlige handlinger nederst) */}
          {props.onDeleteAllShots && (
            <Section title="Data" summary="Slett skuddpar" open={open === 'data'} onToggle={() => toggle('data')}>
              <MenuButton tone="danger" onClick={props.onDeleteAllShots}>
                Slett alle skuddpar
              </MenuButton>
            </Section>
          )}
        </div>
      </MenuPanel>
    </>
  );
}
