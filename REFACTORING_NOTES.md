# Refaktorerings-notater: Aware App

## Dato: November 2025

## Oversikt
Dette dokumentet beskriver områder som bør refaktoreres for bedre struktur, vedlikeholdbarhet og testbarhet.

---

## 1. Map Component - Props Overload

### Problem
`MapComponent` har **86+ props** som sendes ned gjennom flere lag:
```
page.tsx → awaremap.tsx → mapcomponent.tsx
```

### Konsekvenser
- Vanskelig å vedlikeholde
- Lett å glemme å sende props videre
- TypeScript errors når nye props legges til
- Uoversiktlig interface

### Forslag til løsning
**Grupper props i kontekst-objekter:**

```typescript
// Før:
<MapComponent 
  radius={radius}
  angleRange={angleRange}
  showMSRRetikkel={showMSRRetikkel}
  msrRetikkelOpacity={msrRetikkelOpacity}
  msrRetikkelStyle={msrRetikkelStyle}
  msrRetikkelVerticalPosition={msrRetikkelVerticalPosition}
  targetSize={targetSize}
  shotSize={shotSize}
  observationSize={observationSize}
  targetLineColor={targetLineColor}
  shotColor={shotColor}
  targetColor={targetColor}
  targetLineWeight={targetLineWeight}
  compassSliceLength={compassSliceLength}
  // ... +70 props mer
/>

// Etter:
<MapComponent 
  radius={radius}
  reticleSettings={reticleSettings}
  shootTrackSettings={shootTrackSettings}
  compassSettings={compassSettings}
  huntingAreaSettings={huntingAreaSettings}
  // ... mye enklere!
/>
```

**Eller bruk React Context:**
```typescript
<SettingsContext.Provider value={allSettings}>
  <MapComponent />
</SettingsContext.Provider>
```

---

## 2. Kompass, GPS og Retikkel - Duplisert Pixel→Meter Logikk

### Problem
**Samme kode i 3 forskjellige steder:**
- `CompassSlice` (mapcomponent.tsx)
- `MSRRetikkel` (msr-retikkel.tsx)
- Potensielt andre steder

**Duplisert logikk:**
```typescript
// I CompassSlice:
const metersPerPixel = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom);
const meters = sliceLengthPixels * metersPerPixel;

// I MSRRetikkel:
const metersPerPixel = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom);
const xDistanceMeters = Math.round(L_SIZE_PIXELS * metersPerPixel);
```

### Konsekvenser
- Vanskelig å endre beregningen (må oppdateres 3 steder)
- Risiko for inkonsistens
- Ikke testbart isolert

### Forslag til løsning
**Lag en custom hook:**

```typescript
// hooks/useMapPixelConverter.ts
export function useMapPixelConverter() {
  const map = useMap();
  const [metersPerPixel, setMetersPerPixel] = useState(1);

  useEffect(() => {
    if (!map) return;

    const update = () => {
      const zoom = map.getZoom();
      const center = map.getCenter();
      const mpp = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom);
      setMetersPerPixel(mpp);
    };

    update();
    map.on('zoomend', update);
    map.on('moveend', update);

    return () => {
      map.off('zoomend', update);
      map.off('moveend', update);
    };
  }, [map]);

  return {
    pixelsToMeters: (pixels: number) => pixels * metersPerPixel,
    metersToPixels: (meters: number) => meters / metersPerPixel,
    metersPerPixel,
  };
}

// Bruk:
const { pixelsToMeters } = useMapPixelConverter();
const radiusMeters = pixelsToMeters(sliceLengthPixels);
```

**Eller en utility function:**
```typescript
// utils/mapCoordinates.ts
export function getMetersPerPixel(zoom: number, latitude: number): number {
  return 156543.03392 * Math.cos(latitude * Math.PI / 180) / Math.pow(2, zoom);
}

export function pixelsToMeters(pixels: number, zoom: number, latitude: number): number {
  return pixels * getMetersPerPixel(zoom, latitude);
}

export function metersToLatLng(
  centerLat: number,
  centerLng: number,
  distanceMeters: number,
  bearingDegrees: number
): [number, number] {
  const rad = (bearingDegrees * Math.PI) / 180;
  const lat = centerLat + (distanceMeters * Math.cos(rad)) / 111000;
  const lng = centerLng + (distanceMeters * Math.sin(rad)) / (111000 * Math.cos(centerLat * Math.PI / 180));
  return [lat, lng];
}
```

---

## 3. Compass Implementation - Spredt State

### Problem
**Kompass-state er spredt over:**
- `useCompass` hook (sensor handling)
- `MapComponent` (compassMode state)
- `CompassSlice` (rendering)
- `MapRotator` (map rotation)
- Settings menu (lengde slider)
- page.tsx (compassSliceLength state)

### Konsekvenser
- Vanskelig å se helheten
- State er i forskjellige komponenter
- Logikk spredt mange steder

### Forslag til løsning
**Lag en dedikert `CompassManager` komponent:**

```typescript
// components/CompassManager.tsx
export function CompassManager() {
  const [mode, setMode] = useState<'off' | 'arrow' | 'map'>('off');
  const [sliceLength, setSliceLength] = useState(30);
  const compass = useCompass({ isEnabled: mode !== 'off' });

  return (
    <>
      <CompassSlice mode={mode} heading={compass.currentHeading} length={sliceLength} />
      <MapRotator isEnabled={mode === 'map'} heading={compass.currentHeading} />
      <CompassButton mode={mode} onModeChange={setMode} />
    </>
  );
}
```

**Eller bruk en custom hook med all logikk:**
```typescript
// hooks/useCompassState.ts
export function useCompassState() {
  const [mode, setMode] = useState<'off' | 'arrow' | 'map'>('off');
  const [sliceLength, setSliceLength] = useState(30);
  const compass = useCompass({ isEnabled: mode !== 'off' });

  const cycleMode = useCallback(async () => {
    if (mode === 'off') {
      await compass.startCompass();
      setMode('arrow');
    } else if (mode === 'arrow') {
      setMode('map');
    } else {
      compass.stopCompass();
      setMode('off');
    }
  }, [mode, compass]);

  return {
    mode,
    heading: compass.currentHeading,
    sliceLength,
    setSliceLength,
    cycleMode,
    isActive: compass.isActive,
  };
}
```

---

## 4. Settings Management - LocalStorage Håndtering

### Problem
**Settings lastes og lagres på 10+ steder:**
- Hver setting har sin egen `useEffect`
- Duplisert `localStorage.getItem` / `setItem` kode
- Ingen sentralisert settings-håndtering
- "Save as default" må manuelt liste opp alle settings

### Forslag til løsning
**Lag en Settings Service:**

```typescript
// services/settingsService.ts
interface AppSettings {
  compass: {
    sliceLength: number;
  };
  reticle: {
    show: boolean;
    opacity: number;
    style: 'msr' | 'ivar';
    verticalPosition: number;
  };
  shootTrack: {
    targetSize: number;
    shotSize: number;
    observationSize: number;
    targetLineColor: string;
    shotColor: string;
    targetColor: string;
    targetLineWeight: number;
  };
  // etc...
}

const DEFAULT_SETTINGS: AppSettings = {
  compass: { sliceLength: 30 },
  reticle: { show: false, opacity: 80, style: 'ivar', verticalPosition: 50 },
  shootTrack: { targetSize: 15, shotSize: 5, /* ... */ },
};

export class SettingsService {
  private static KEY = 'aware_app_settings';

  static load(): AppSettings {
    const stored = localStorage.getItem(this.KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  }

  static save(settings: AppSettings): void {
    localStorage.setItem(this.KEY, JSON.stringify(settings));
  }

  static reset(): void {
    localStorage.removeItem(this.KEY);
  }
}

// Bruk med Context:
const SettingsContext = createContext<AppSettings>(DEFAULT_SETTINGS);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState<AppSettings>(SettingsService.load);

  const updateSettings = (updates: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    SettingsService.save(newSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}
```

---

## 5. Mode-basert UI - Switch-statement Hell

### Problem
**Mange steder med mode-basert conditional rendering:**
```typescript
{mode === 'aware' && <AwareButtons />}
{mode === 'track' && <TrackButtons />}
{mode === 'søk' && <SearchButtons />}

// 20+ lignende blokker i samme fil
```

### Forslag til løsning
**Component composition pattern:**

```typescript
// components/ModeButtons.tsx
const MODE_COMPONENTS = {
  aware: AwareModeButtons,
  track: TrackModeButtons,
  søk: SearchModeButtons,
} as const;

export function ModeButtons({ mode }: { mode: Mode }) {
  const Component = MODE_COMPONENTS[mode];
  return <Component />;
}

// Eller med strategy pattern:
interface ModeStrategy {
  renderButtons(): JSX.Element;
  renderQuickFilters(): JSX.Element;
  renderMapOverlay(): JSX.Element;
}

class AwareModeStrategy implements ModeStrategy {
  renderButtons() { return <AwareModeButtons />; }
  renderQuickFilters() { return <AwareModeQuickFilters />; }
  renderMapOverlay() { return <AwareModeOverlay />; }
}

// etc...
```

---

## 6. Event Handlers - Callback Props Overload

### Problem
**50+ event handler props:**
```typescript
onRadiusChange
onAngleRangeChange
onShowMarkersChange
onShowMSRRetikkelChange
onMSRRetikkelOpacityChange
onMSRRetikkelStyleChange
onMSRRetikkelVerticalPositionChange
onTargetSizeChange
onShotSizeChange
// ... +40 flere
```

### Forslag til løsning
**Reducer pattern eller event bus:**

```typescript
// Med useReducer:
type SettingsAction =
  | { type: 'SET_RADIUS'; value: number }
  | { type: 'SET_ANGLE_RANGE'; value: number }
  | { type: 'SET_RETICLE_OPACITY'; value: number }
  | { type: 'SET_RETICLE_STYLE'; value: 'msr' | 'ivar' }
  // ...

const [settings, dispatch] = useReducer(settingsReducer, initialSettings);

// Bruk:
dispatch({ type: 'SET_RADIUS', value: 3000 });

// Eller med event emitter:
settingsEmitter.emit('change', { radius: 3000 });
```

---

## 7. Data Fetching - Spredt Supabase Logikk

### Problem
**Supabase queries spredt over:**
- `MapComponent` (posts, tracks, finds, observations)
- `page.tsx` (hunting areas)
- Inline i komponenter
- Duplisert error handling

### Forslag til løsning
**Data access layer:**

```typescript
// services/dataService.ts
export class DataService {
  constructor(private supabase: SupabaseClient) {}

  async getPosts(teamId: string) {
    const { data, error } = await this.supabase
      .from('posts')
      .select('*')
      .eq('team_id', teamId);
    
    if (error) throw new DataServiceError('Failed to fetch posts', error);
    return data;
  }

  async getTracks(teamId: string) { /* ... */ }
  async getHuntingAreas(teamId: string) { /* ... */ }
  // etc...
}

// Med React Query for caching:
export function usePosts(teamId: string) {
  return useQuery(['posts', teamId], () => dataService.getPosts(teamId));
}
```

---

## Prioritering

### Høy prioritet (gjør nå)
1. **Settings Context** - Reduser props hell
2. **Pixel→Meter utility** - Fjern duplikasjon

### Medium prioritet (snart)
3. **Compass Manager** - Samle kompass-logikk
4. **Mode Strategy** - Rydd opp i mode-logic

### Lav prioritet (senere)
5. **Data Access Layer** - Når flere features kommer
6. **Event Bus** - Hvis callback-hell blir verre

---

## Testing-vennlighet

### Nåværende problemer
- Vanskelig å teste isolert
- Mye avhengighet på Leaflet map
- Ingen mocking av localStorage
- Komponent-logikk blandet med rendering

### Forslag
```typescript
// Separer business logic:
export function calculateCompassSlicePoints(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  headingDegrees: number,
  angleRange: number
): [number, number][] {
  // Ren funksjon - lett å teste!
}

// Test:
test('calculateCompassSlicePoints creates correct arc', () => {
  const points = calculateCompassSlicePoints(60, 10, 100, 0, 1);
  expect(points).toHaveLength(3); // center + arc + center
  expect(points[0]).toEqual([60, 10]); // starts at center
});
```

---

## Konklusjon

**Hovedproblemet:** Komponenter gjør for mye, og state/logikk er spredt.

**Løsning:** 
1. Separer business logic fra rendering
2. Bruk contexts for å dele state
3. Lag reusable utilities
4. Component composition over conditional rendering

**Neste steg:**
- Start med Settings Context (biggest win)
- Refactor pixel→meter logikk til utility
- Gradvis splitt store komponenter

---

## Eksempel på "Etter Refaktorering"

```typescript
// page.tsx - MYE enklere!
export default function Home() {
  const { settings, updateSettings } = useSettings();
  const { mode, setMode } = useMode();
  
  return (
    <SettingsProvider value={settings}>
      <ModeProvider value={mode}>
        <AwareMap />
        <ModeButtons mode={mode} onModeChange={setMode} />
        <SettingsMenu />
      </ModeProvider>
    </SettingsProvider>
  );
}

// mapcomponent.tsx - Fokusert på rendering!
export default function MapComponent() {
  const settings = useSettings();
  const { mode } = useMode();
  const compass = useCompassState();
  
  return (
    <MapContainer>
      <ModeStrategy mode={mode} />
      <CompassManager state={compass} />
      <MSRRetikkel config={settings.reticle} />
    </MapContainer>
  );
}
```

**Resultatet:** Kode som er lett å forstå, teste og vedlikeholde! 🎉

