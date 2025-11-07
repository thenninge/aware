'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import AwareMap from '@/components/awaremap';
import SettingsMenu, { HuntingArea } from '@/components/settingsmenu';
import FilterMenu from '@/components/filtermenu';
import AdminMenu from '@/components/adminmenu';
import { useAuth } from '@/contexts/AuthContext';

interface Position {
  lat: number;
  lng: number;
  heading?: number; // Compass heading in degrees (0-360)
}

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

type Post = {
  id: number;
  // legg til flere felter hvis nødvendig
};

export default function Home() {
  const { authState } = useAuth();
  const [mode, setMode] = useState<'aware' | 'track' | 'søk'>('aware');
  const [radius, setRadius] = useState(3000); // Default 3000m
  const [, setCurrentPosition] = useState<Position | null>(null);
  const [currentCenter, setCurrentCenter] = useState<Position | null>(null);
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilter>({
    city: true,
    town: true,
    village: true,
    hamlet: true,
    farm: true,
    isolated_dwelling: true
  });
    const [shouldScan, setShouldScan] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true); // Default show markers
  const [isLiveMode, setIsLiveMode] = useState(false); // Default live mode off
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [isAdminExpanded, setIsAdminExpanded] = useState(false);
  const [orientationMode, setOrientationMode] = useState<'north' | 'heading'>('north');
  const [showOnlyLastShot, setShowOnlyLastShot] = useState(true);
  const [showAllTracksAndFinds, setShowAllTracksAndFinds] = useState(false);
  const [showSearchTracks, setShowSearchTracks] = useState(true);
  const [showSearchFinds, setShowSearchFinds] = useState(true);
  const [showObservations, setShowObservations] = useState(true);
  const [showFinds, setShowFinds] = useState(true);
  const [showShots, setShowShots] = useState(true); // For Aware-mode
  const [showTracks, setShowTracks] = useState(true); // For Aware-mode
  const [showHuntingBoundaryByMode, setShowHuntingBoundaryByMode] = useState<Record<'aware' | 'track' | 'søk', boolean>>({ aware: true, track: true, søk: true });
  const showHuntingBoundary = showHuntingBoundaryByMode[mode]; // mode-specific
  const [isTracking, setIsTracking] = useState(false);
  const [trackingPoints, setTrackingPoints] = useState<Position[]>([]);
  const [batterySaver, setBatterySaver] = useState(false);
  // LOS settings
  const [losObserverHeightM, setLosObserverHeightM] = useState(5);
  const [losRadiusM, setLosRadiusM] = useState(350);
  
  // Hunting area state
  const [huntingAreas, setHuntingAreas] = useState<HuntingArea[]>([]);
  const [activeHuntingAreaId, setActiveHuntingAreaId] = useState<string | null>(null);
  const [isDefiningHuntingArea, setIsDefiningHuntingArea] = useState(false);
  const [huntingBoundaryColor, setHuntingBoundaryColor] = useState('#00ff00'); // green
  const [huntingBoundaryWeight, setHuntingBoundaryWeight] = useState(3); // pixels
  const [huntingBoundaryOpacity, setHuntingBoundaryOpacity] = useState(80); // 0-100
  
  // State for Shoot & Track settings
  const [targetSize, setTargetSize] = useState(15); // meters
  const [shotSize, setShotSize] = useState(5); // meters
  const [observationSize, setObservationSize] = useState(2.5); // meters
  const [targetLineColor, setTargetLineColor] = useState('#ff00ff'); // magenta
  const [shotColor, setShotColor] = useState('#2563eb'); // blue
  const [targetColor, setTargetColor] = useState('#dc2626'); // red
  const [targetLineWeight, setTargetLineWeight] = useState(4); // pixels
  const [targetRangeSetting, setTargetRangeSetting] = useState(500); // meters (200-1000)
  
  // State for valgt treffpunkt i søk-modus
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);
  
  // State for MSR-retikkel
  const [angleRange, setAngleRange] = useState(5);
  const [showMSRRetikkel, setShowMSRRetikkel] = useState(false);
  const [msrRetikkelOpacity, setMSRRetikkelOpacity] = useState(80);
  const [msrRetikkelStyle, setMSRRetikkelStyle] = useState<'msr' | 'ivar'>('ivar');
  const [msrRetikkelVerticalPosition, setMSRRetikkelVerticalPosition] = useState(50);
  // Zoom buttons
  const [showZoomButtons, setShowZoomButtons] = useState(true);
  const [zoomButtonsX, setZoomButtonsX] = useState(8);
  const [zoomButtonsY, setZoomButtonsY] = useState(64);
  const [zoomButtonsSide, setZoomButtonsSide] = useState<'left' | 'right'>('left');
  
  // State for Compass
  const [compassSliceLength, setCompassSliceLength] = useState(30); // % of screen height
  const [compassMode, setCompassMode] = useState<'off' | 'on'>('off');
  const [isCompassLocked, setIsCompassLocked] = useState(false);
  const [categoryConfigs, setCategoryConfigs] = useState<Record<keyof CategoryFilter, CategoryConfig>>({
    city: {
      color: '#1e40af', // Dark blue
      opacity: 0.3,
      icon: '🏙️'
    },
    town: {
      color: '#7c3aed', // Dark purple
      opacity: 0.3,
      icon: '🏙️'
    },
    village: {
      color: '#dc2626', // Dark red
      opacity: 0.3,
      icon: '🏘️'
    },
    hamlet: {
      color: '#ea580c', // Dark orange
      opacity: 0.3,
      icon: '🏘️'
    },
    farm: {
      color: '#16a34a', // Dark green
      opacity: 0.3,
      icon: '🏡'
    },
    isolated_dwelling: {
      color: '#0891b2', // Dark cyan
      opacity: 0.3,
      icon: '🏠'
    }
  });

  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Load saved defaults on mount
  useEffect(() => {
    const savedDefaults = localStorage.getItem('aware_settings_defaults');
    if (savedDefaults) {
      try {
        const defaults = JSON.parse(savedDefaults);
        if (defaults.angleRange !== undefined) setAngleRange(defaults.angleRange);
        if (defaults.showMSRRetikkel !== undefined) setShowMSRRetikkel(defaults.showMSRRetikkel);
        if (defaults.msrRetikkelOpacity !== undefined) setMSRRetikkelOpacity(defaults.msrRetikkelOpacity);
        if (defaults.msrRetikkelStyle !== undefined) setMSRRetikkelStyle(defaults.msrRetikkelStyle);
        if (defaults.msrRetikkelVerticalPosition !== undefined) setMSRRetikkelVerticalPosition(defaults.msrRetikkelVerticalPosition);
        if (defaults.categoryConfigs !== undefined) setCategoryConfigs(defaults.categoryConfigs);
        if (defaults.categoryFilters !== undefined) setCategoryFilters(defaults.categoryFilters);
        if (defaults.showMarkers !== undefined) setShowMarkers(defaults.showMarkers);
        if (defaults.showShots !== undefined) setShowShots(defaults.showShots);
        if (defaults.showTracks !== undefined) setShowTracks(defaults.showTracks);
        if (defaults.showObservations !== undefined) setShowObservations(defaults.showObservations);
        if (defaults.targetSize !== undefined) setTargetSize(defaults.targetSize);
        if (defaults.shotSize !== undefined) setShotSize(defaults.shotSize);
        if (defaults.observationSize !== undefined) setObservationSize(defaults.observationSize);
        if (defaults.targetLineColor !== undefined) setTargetLineColor(defaults.targetLineColor);
        if (defaults.shotColor !== undefined) setShotColor(defaults.shotColor);
        if (defaults.targetColor !== undefined) setTargetColor(defaults.targetColor);
        if (defaults.targetLineWeight !== undefined) setTargetLineWeight(defaults.targetLineWeight);
        if (defaults.showHuntingBoundary !== undefined) setShowHuntingBoundaryByMode({ aware: defaults.showHuntingBoundary, track: defaults.showHuntingBoundary, søk: defaults.showHuntingBoundary });
        if (defaults.huntingBoundaryColor !== undefined) setHuntingBoundaryColor(defaults.huntingBoundaryColor);
        if (defaults.huntingBoundaryWeight !== undefined) setHuntingBoundaryWeight(defaults.huntingBoundaryWeight);
        if (defaults.huntingBoundaryOpacity !== undefined) setHuntingBoundaryOpacity(defaults.huntingBoundaryOpacity);
        if (defaults.showZoomButtons !== undefined) setShowZoomButtons(defaults.showZoomButtons);
        if (defaults.zoomButtonsX !== undefined) setZoomButtonsX(defaults.zoomButtonsX);
        if (defaults.zoomButtonsY !== undefined) setZoomButtonsY(defaults.zoomButtonsY);
        if (defaults.zoomButtonsSide !== undefined) setZoomButtonsSide(defaults.zoomButtonsSide);
        if (defaults.losObserverHeightM !== undefined) setLosObserverHeightM(defaults.losObserverHeightM);
        if (defaults.losRadiusM !== undefined) setLosRadiusM(defaults.losRadiusM);
      } catch (e) {
        console.error('Error loading defaults:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (mode === 'track') {
      setShowMarkers(false);
      // Stopp sporing hvis vi bytter til track-modus
      if (isTracking) {
        setIsTracking(false);
        setTrackingPoints([]);
      }
    } else if (mode === 'aware') {
      setShowMarkers(true);
      // Stopp sporing hvis vi bytter til aware-modus
      if (isTracking) {
        setIsTracking(false);
        setTrackingPoints([]);
      }
    } else if (mode === 'søk') {
      setShowMarkers(false);
      // Ikke overstyr brukerens valg av "vis kun siste skuddpar"
    }
  }, [mode]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      const target = event.target as Node;
      
      // Don't close if clicking on the toggle buttons
      if (settingsButtonRef.current?.contains(target) || filterButtonRef.current?.contains(target)) {
        return;
      }
      
      if (isSettingsExpanded && settingsMenuRef.current && !settingsMenuRef.current.contains(target)) {
        setIsSettingsExpanded(false);
      }
      if (isFilterExpanded && filterMenuRef.current && !filterMenuRef.current.contains(target)) {
        setIsFilterExpanded(false);
      }
    };

    if (isSettingsExpanded || isFilterExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSettingsExpanded, isFilterExpanded]);



  const handlePositionChange = (position: Position) => {
    setCurrentPosition(position);
    setCurrentCenter(position);
  };

  const handleCategoryChange = (category: keyof CategoryFilter) => {
    setCategoryFilters(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleScanArea = () => {
    setShouldScan(true);
    // Reset after a short delay to allow the map component to process
    setTimeout(() => setShouldScan(false), 100);
  };

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
  };

  const handleCategoryConfigChange = (category: string, config: CategoryConfig) => {
    setCategoryConfigs(prev => ({
      ...prev,
      [category]: config
    }));
  };

    const handleAngleRangeChange = (newAngleRange: number) => {
    setAngleRange(newAngleRange);
  };

  const handleShowMarkersChange = (show: boolean) => {
    setShowMarkers(show);
  };

  const handleLiveModeChange = (isLive: boolean) => {
    setIsLiveMode(isLive);
  };
  
  const handleShowHuntingBoundaryChange = (value: boolean) => {
    setShowHuntingBoundaryByMode(prev => ({ ...prev, [mode]: value }));
  };
  
  const handleDefineNewHuntingArea = () => {
    setIsDefiningHuntingArea(true);
    setIsSettingsExpanded(false); // Lukk settings-menyen
  };
  
  const handleHuntingAreaDefined = async (area: HuntingArea) => {
    setHuntingAreas(prev => [...prev, area]);
    setActiveHuntingAreaId(area.id);
    setIsDefiningHuntingArea(false);
    
    // Save to Supabase if team is active
    if (authState.activeTeam?.id) {
      try {
        const response = await fetch('/api/hunting-areas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: authState.activeTeam.id,
            id: area.id,
            name: area.name,
            coordinates: area.coordinates,
            color: area.color,
            lineWeight: area.lineWeight,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Failed to save hunting area to Supabase:', errorData);
          alert(`Feil ved lagring av jaktfelt: ${errorData.error || 'Ukjent feil'}`);
        } else {
          console.log('Hunting area saved to Supabase successfully');
          const savedArea = await response.json();
          console.log('Saved area:', savedArea);
        }
      } catch (error) {
        console.error('Error saving hunting area:', error);
        alert(`Feil ved lagring av jaktfelt: ${(error as Error).message}`);
      }
    }
  };
  
  const handleCancelHuntingAreaDefinition = () => {
    setIsDefiningHuntingArea(false);
  };
  
  const handleDeleteHuntingArea = async (huntingAreaId: string) => {
    if (!authState.activeTeam?.id) return;
    
    try {
      const response = await fetch(`/api/hunting-areas?id=${huntingAreaId}&teamId=${authState.activeTeam.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Remove from local state
        setHuntingAreas(prev => prev.filter(area => area.id !== huntingAreaId));
        
        // Clear active ID if it was the deleted one
        if (activeHuntingAreaId === huntingAreaId) {
          setActiveHuntingAreaId(null);
        }
        
        console.log('Hunting area deleted successfully');
      } else {
        console.error('Failed to delete hunting area');
        alert('Feil ved sletting av jaktfelt');
      }
    } catch (error) {
      console.error('Error deleting hunting area:', error);
      alert('Feil ved sletting av jaktfelt');
    }
  };
  
  // Load hunting areas from Supabase
  const loadHuntingAreas = async () => {
    if (authState.activeTeam?.id) {
      try {
        const response = await fetch(`/api/hunting-areas?teamId=${authState.activeTeam.id}`);
        if (response.ok) {
          const areas = await response.json();
          setHuntingAreas(areas);
          
          // Restore active hunting area ID from localStorage
          const savedActiveId = localStorage.getItem('active_hunting_area_id');
          if (savedActiveId && areas.some((a: HuntingArea) => a.id === savedActiveId)) {
            setActiveHuntingAreaId(savedActiveId);
          } else if (areas.length > 0) {
            setActiveHuntingAreaId(areas[0].id);
          }
          
          console.log(`Loaded ${areas.length} hunting areas from Supabase`);
        } else {
          console.error('Failed to load hunting areas from Supabase');
          setHuntingAreas([]);
        }
      } catch (error) {
        console.error('Error loading hunting areas:', error);
        setHuntingAreas([]);
      }
    } else {
      // No active team, clear hunting areas
      setHuntingAreas([]);
      setActiveHuntingAreaId(null);
    }
  };
  
  // Load hunting areas when team changes
  useEffect(() => {
    loadHuntingAreas();
  }, [authState.activeTeam?.id]);
  
  // Save active hunting area ID to localStorage when it changes
  useEffect(() => {
    if (activeHuntingAreaId) {
      localStorage.setItem('active_hunting_area_id', activeHuntingAreaId);
    } else {
      localStorage.removeItem('active_hunting_area_id');
    }
  }, [activeHuntingAreaId]);

  const handleDeleteAllShots = async () => {
    if (!window.confirm('Er du sikker på at du vil slette alle skuddpar?')) return;
    // Slett fra Supabase
    const res = await fetch('/api/delete-shots', { method: 'POST' });
    if (!res.ok) {
      alert('Feil ved sletting!');
      return;
    }
    // Oppdater lokal visning hvis ønskelig
    window.location.reload();
  };

  // Sync callback registered by MapComponent
  const syncCallbackRef = useRef<(() => void) | null>(null);
  // Calibration dialog opener registered by MapComponent
  const calibrationOpenRef = useRef<(() => void) | null>(null);
  
  const handleSyncFromFilter = () => {
    if (syncCallbackRef.current) {
      syncCallbackRef.current();
    }
  };

  // Funksjoner for å navigere mellom treffpunkter i søk-modus
  const handlePreviousTarget = () => {
    setSelectedTargetIndex(prev => {
      console.log('handlePreviousTarget called with prev:', prev);
      // Hvis vi er på første (index 0), gå til siste
      // Vi antar at det finnes minst 1 treffpunkt siden denne funksjonen kalles
      if (prev === 0) {
        console.log('Going from first to last, setting to 999');
        // Gå til siste (vi kan ikke vite nøyaktig antall her, så vi setter en høy verdi)
        // MapComponent vil håndtere dette riktig
        return 999; // Dette vil bli justert til faktisk siste index i MapComponent
      }
      // Ellers gå til forrige
      console.log('Going to previous, new index:', prev - 1);
      return prev - 1;
    });
  };

  const handleNextTarget = () => {
    setSelectedTargetIndex(prev => {
      // Gå til neste, MapComponent vil håndtere wraparound
      // Vi setter en høy verdi som MapComponent vil justere til riktig wraparound
      return prev + 1;
    });
  };

  const handleGoToLastTarget = () => {
    // Gå til nyeste treffpunkt (index 0)
    setSelectedTargetIndex(0);
  };
  
  // useEffect for å håndtere wraparound når selectedTargetIndex blir for høy eller negativ
  useEffect(() => {
    // Dette vil bli implementert senere når vi har tilgang til antall treffpunkter
    // For nå bruker vi MapComponent sin adjustedSelectedTargetIndex
  }, [selectedTargetIndex]);

 

        return (
          <div className="w-full h-screen">

        {/* Admin hamburger-knapp oppe til høyre */}
        <div className="fixed top-4 right-4 z-[2001]">
          <button
            onClick={() => setIsAdminExpanded(!isAdminExpanded)}
            className="w-10 h-10 bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-colors"
            title="Admin Panel"
          >
            <span className="text-lg">☰</span>
          </button>
        </div>
        
        {/* Lock-knapp - under admin-knappen, kun synlig når kompass er på */}
        {compassMode === 'on' && (
          <div className="fixed top-16 right-4 z-[2001] flex flex-col items-end gap-2">
            <button
              onClick={() => setIsCompassLocked(!isCompassLocked)}
              className={`w-10 h-10 rounded-lg shadow-lg flex items-center justify-center transition-colors ${
                isCompassLocked
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
              title={isCompassLocked ? 'Låst: Kart roterer' : 'Ulåst: Pil roterer'}
            >
              <span className="text-lg">⬆️</span>
            </button>
            <button
              onClick={() => calibrationOpenRef.current && calibrationOpenRef.current()}
              className="w-10 h-10 rounded-lg shadow-lg flex items-center justify-center transition-colors bg-white/90 border border-gray-300 hover:bg-gray-100 text-gray-800"
              title="Kalibrer kompass"
            >
              <span className="text-lg">🗜️</span>
            </button>
          </div>
        )}
        
        {/* Mode-toggle og menyknapper alltid synlig, fixed og midtjustert, også på mobil */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[2001] flex justify-center items-center w-full max-w-xs px-2 py-2 gap-2">
        {/* Settings-knapp */}
        <button
          onClick={() => {
            setIsSettingsExpanded(!isSettingsExpanded);
            if (!isSettingsExpanded) {
              setIsFilterExpanded(false); // Lukk filter-menyen hvis den er åpen
            }
          }}
          ref={settingsButtonRef}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors border ${
            isSettingsExpanded 
              ? 'bg-blue-100 border-blue-300 hover:bg-blue-200' 
              : 'bg-white hover:bg-gray-200'
          }`}
          title={isSettingsExpanded ? 'Lukk innstillinger' : 'Åpne innstillinger'}
        >
          <span className="text-xl">⚙️</span>
        </button>
        <button
          className={`font-semibold px-2 py-3 rounded-full transition-colors text-xs ${mode === 'aware' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          onClick={() => setMode('aware')}
        >
          Aware
        </button>
        <button
          className={`font-semibold px-2 py-3 rounded-full transition-colors text-xs ${mode === 'track' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          onClick={() => setMode('track')}
        >
          Shoot
        </button>
        <button
          className={`font-semibold px-2 py-3 rounded-full transition-colors text-xs ${mode === 'søk' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          onClick={() => setMode('søk')}
        >
          Track
        </button>
        {/* Filter-knapp */}
        <button
          onClick={() => {
            setIsFilterExpanded(!isFilterExpanded);
            if (!isFilterExpanded) {
              setIsSettingsExpanded(false); // Lukk settings-menyen hvis den er åpen
            }
          }}
          ref={filterButtonRef}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors border ${
            isFilterExpanded 
              ? 'bg-blue-100 border-blue-300 hover:bg-blue-200' 
              : 'bg-white hover:bg-gray-100 border-gray-200'
          }`}
          title={isFilterExpanded ? 'Lukk filter' : 'Åpne filter'}
        >
          <span className="text-xl">☑️</span>
        </button>
      </div>
      

      {/* Settings Menu */}
      {isSettingsExpanded && (
        <div ref={settingsMenuRef} className="fixed top-14 left-1/2 -translate-x-1/2 z-[2002]">
          <SettingsMenu
            categoryConfigs={categoryConfigs}
            onCategoryConfigChange={handleCategoryConfigChange}
            angleRange={angleRange}
            onAngleRangeChange={handleAngleRangeChange}
            onDeleteAllShots={handleDeleteAllShots}
            currentCenter={currentCenter || undefined}
            showMSRRetikkel={showMSRRetikkel}
            msrRetikkelOpacity={msrRetikkelOpacity}
            msrRetikkelStyle={msrRetikkelStyle}
            msrRetikkelVerticalPosition={msrRetikkelVerticalPosition}
            onShowMSRRetikkelChange={setShowMSRRetikkel}
            onMSRRetikkelOpacityChange={setMSRRetikkelOpacity}
            onMSRRetikkelStyleChange={setMSRRetikkelStyle}
            onMSRRetikkelVerticalPositionChange={setMSRRetikkelVerticalPosition}
            categoryFilters={categoryFilters}
            onCategoryChange={handleCategoryChange}
            showMarkers={showMarkers}
            onShowMarkersChange={handleShowMarkersChange}
            showShots={showShots}
            showTracks={showTracks}
            showObservations={showObservations}
            targetSize={targetSize}
            shotSize={shotSize}
            observationSize={observationSize}
            targetLineColor={targetLineColor}
            shotColor={shotColor}
            targetColor={targetColor}
            targetLineWeight={targetLineWeight}
            onTargetSizeChange={setTargetSize}
            onShotSizeChange={setShotSize}
            onObservationSizeChange={setObservationSize}
            onTargetLineColorChange={setTargetLineColor}
            onShotColorChange={setShotColor}
            onTargetColorChange={setTargetColor}
            onTargetLineWeightChange={setTargetLineWeight}
            huntingAreas={huntingAreas}
            activeHuntingAreaId={activeHuntingAreaId}
            onDefineNewHuntingArea={handleDefineNewHuntingArea}
            onActiveHuntingAreaChange={setActiveHuntingAreaId}
            onDeleteHuntingArea={handleDeleteHuntingArea}
            huntingBoundaryColor={huntingBoundaryColor}
            huntingBoundaryWeight={huntingBoundaryWeight}
            huntingBoundaryOpacity={huntingBoundaryOpacity}
            onHuntingBoundaryColorChange={setHuntingBoundaryColor}
            onHuntingBoundaryWeightChange={setHuntingBoundaryWeight}
            onHuntingBoundaryOpacityChange={setHuntingBoundaryOpacity}
            compassSliceLength={compassSliceLength}
            onCompassSliceLengthChange={setCompassSliceLength}
            showZoomButtons={showZoomButtons}
            onShowZoomButtonsChange={setShowZoomButtons}
            zoomButtonsX={zoomButtonsX}
            zoomButtonsY={zoomButtonsY}
            onZoomButtonsXChange={setZoomButtonsX}
            onZoomButtonsYChange={setZoomButtonsY}
            zoomButtonsSide={zoomButtonsSide}
            onZoomButtonsSideChange={setZoomButtonsSide}
          losObserverHeightM={losObserverHeightM}
          losRadiusM={losRadiusM}
          onLosObserverHeightChange={setLosObserverHeightM}
          onLosRadiusChange={setLosRadiusM}
          />
        </div>
      )}
      {isFilterExpanded && (
        <div ref={filterMenuRef} className="fixed top-14 left-1/2 -translate-x-1/2 z-[2002]">
                  <FilterMenu
          categoryFilters={categoryFilters}
          onCategoryChange={handleCategoryChange}
          radius={radius}
          onRadiusChange={handleRadiusChange}
          losRangeMeters={losRadiusM}
          onLosRangeChange={setLosRadiusM}
          showMarkers={showMarkers}
          onShowMarkersChange={handleShowMarkersChange}
          orientationMode={orientationMode}
          onOrientationModeChange={setOrientationMode}
          categoryConfigs={categoryConfigs}
          showOnlyLastShot={showOnlyLastShot}
          onShowOnlyLastShotChange={setShowOnlyLastShot}
          mode={mode}
          showAllTracksAndFinds={showAllTracksAndFinds}
          onShowAllTracksAndFindsChange={setShowAllTracksAndFinds}
          showSearchTracks={showSearchTracks}
          onShowSearchTracksChange={setShowSearchTracks}
          showSearchFinds={showSearchFinds}
          onShowSearchFindsChange={setShowSearchFinds}
          showObservations={showObservations}
          onShowObservationsChange={setShowObservations}
          showFinds={showFinds}
          onShowFindsChange={setShowFinds}
          showShots={showShots}
          onShowShotsChange={setShowShots}
          showTracks={showTracks}
          onShowTracksChange={setShowTracks}
          showHuntingBoundary={showHuntingBoundary}
          onShowHuntingBoundaryChange={handleShowHuntingBoundaryChange}
          onSync={handleSyncFromFilter}
          batterySaver={batterySaver}
          onBatterySaverChange={setBatterySaver}
          targetRangeMeters={targetRangeSetting}
          onTargetRangeChange={setTargetRangeSetting}
        />
        </div>
      )}
      {/* Kartet */}
      <AwareMap 
        radius={radius} 
        onPositionChange={handlePositionChange}
        categoryFilters={categoryFilters}
        categoryConfigs={categoryConfigs}
        shouldScan={shouldScan}
        onCategoryChange={handleCategoryChange}
        onScanArea={handleScanArea}
        onRadiusChange={handleRadiusChange}
        onCategoryConfigChange={handleCategoryConfigChange}
        angleRange={angleRange}
        onAngleRangeChange={handleAngleRangeChange}
        showMarkers={showMarkers}
        onShowMarkersChange={handleShowMarkersChange}
        isLiveMode={isLiveMode}
        onLiveModeChange={handleLiveModeChange}
        mode={mode}
        showOnlyLastShot={showOnlyLastShot}
        isTracking={isTracking}
        onTrackingChange={setIsTracking}
        trackingPoints={trackingPoints}
        onTrackingPointsChange={setTrackingPoints}
        showMSRRetikkel={showMSRRetikkel}
        msrRetikkelOpacity={msrRetikkelOpacity}
        msrRetikkelStyle={msrRetikkelStyle}
        msrRetikkelVerticalPosition={msrRetikkelVerticalPosition}
        selectedTargetIndex={selectedTargetIndex}
        onPreviousTarget={handlePreviousTarget}
        onNextTarget={handleNextTarget}
        onSelectedTargetIndexChange={setSelectedTargetIndex}
        showAllTracksAndFinds={showAllTracksAndFinds}
        showSearchTracks={showSearchTracks}
        showSearchFinds={showSearchFinds}
        showFinds={showFinds}
        showObservations={showObservations}
        showShots={showShots}
        showTracks={showTracks}
        targetSize={targetSize}
        shotSize={shotSize}
        observationSize={observationSize}
        targetLineColor={targetLineColor}
        shotColor={shotColor}
        targetColor={targetColor}
        targetLineWeight={targetLineWeight}
        targetRangeSetting={targetRangeSetting}
        showZoomButtons={showZoomButtons}
        zoomButtonsX={zoomButtonsX}
        zoomButtonsY={zoomButtonsY}
        zoomButtonsSide={zoomButtonsSide}
        losObserverHeightM={losObserverHeightM}
        losRadiusM={losRadiusM}
        showHuntingBoundary={showHuntingBoundary}
        huntingAreas={huntingAreas}
        activeHuntingAreaId={activeHuntingAreaId}
        huntingBoundaryColor={huntingBoundaryColor}
        huntingBoundaryWeight={huntingBoundaryWeight}
        huntingBoundaryOpacity={huntingBoundaryOpacity}
        isDefiningHuntingArea={isDefiningHuntingArea}
        onHuntingAreaDefined={handleHuntingAreaDefined}
        onCancelHuntingAreaDefinition={handleCancelHuntingAreaDefinition}
        onRefreshHuntingAreas={loadHuntingAreas}
        onRegisterSync={(fn) => { syncCallbackRef.current = fn; }}
        onRegisterCalibration={(fn) => { calibrationOpenRef.current = fn; }}
        activeTeam={authState.activeTeam?.id || null}
        compassSliceLength={compassSliceLength}
        compassMode={compassMode}
        isCompassLocked={isCompassLocked}
        onCompassModeChange={setCompassMode}
        onCompassLockedChange={setIsCompassLocked}
        batterySaver={batterySaver}
      />

      {/* Admin Menu */}
      <AdminMenu 
        isExpanded={isAdminExpanded}
        onClose={() => setIsAdminExpanded(false)}
      />
    </div>
  );
}
