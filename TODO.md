# Aware - TODO

## Hovedfunksjonalitet
- [x] Next.js prosjektsetup
- [x] Leaflet.js integrasjon
- [x] Kartverkets WMTS som bakgrunnskart
- [x] GPS-posisjonering (midlertidig deaktivert for testing)
- [x] Manuell posisjonsvalg via klikk
- [x] Visning av valgt posisjon
- [x] Radius-velger (1000m-4000m, 500m steg)
- [x] Radius-sirkel visning
- [x] Overpass API integrasjon
- [x] Serverless API for caching
- [x] Git repository setup

## Kart og posisjon
- [x] Kartverkets WMTS Topographic4
- [x] Default posisjon: 60.424834440433045, 12.408766398367092
- [x] GPS-posisjonering (reaktiver senere)
- [ ] Kompassrose for GPS-modus
- [ ] Live GPS-sporing
- [x] Home-position pr user or pr team?

## Data og API
- [x] Overpass API for GIS-data
- [x] Kategorisering basert på place-tags:
  - [x] place=town (Mindre byer) - 🏙️ Lilla
  - [x] place=village (Landsby/tettsted) - 🏘️ Rød
  - [x] place=hamlet (Små bygdesamfunn) - 🏘️ Oransje
  - [x] place=farm (Store gårder) - 🏡 Hvit
  - [x] place=isolated_dwelling (Enkelt hus eller liten gård) - 🏠 Grønn
- [x] Matrikkelen fra Geonorge (for mer nøyaktige bygningstyper)

## Pie-slices og visualisering
- [X] Implementer pie-slices som viser retninger
- [X] Kategorisering med farger:
  - [x] Hvit for gårder
  - [X] Rød for landsbyer
  - [X] Grønn for boliger
  - [X] Andre kategorier
- [X] SVG overlays på Leaflet
- [X] Interaktive pie-slices (ikke klikkbare)

## UI/UX
- [x] Mobile-first responsivt design
- [x] Tailwind CSS styling
- [x] Radius-kontroll
- [X] Forbedre GUI radius-kontroll (fjern gul bakgrunn, bedre styling)
- [X] Filter-kontroller for kategorier
- [ ] Kompassrose-komponent
- [ ] Loading states
- [ ] Error handling
- [X] Fjern lagg i map-pan (debounce API-kall)
- [ ] Legge til tekst, dato, farge for skuddpar

## Teknisk
- [x] Client-side rendering (CSR) for Leaflet
- [x] Dynamisk import for SSR-avoidance
- [x] Error boundaries
- [X] Environment variables setup
- [X] Production build
- [X] Vercel deployment
- [X] Domain setup

## Testing
- [x] Local testing med default posisjon
- [ ] Test på mobil
- [ ] Test med GPS
- [ ] Performance testing

## Deployment
- [X] Vercel konfigurasjon
- [ ] Zoom buttons leaflet optimization
- [X] Production build
- [X] Domain setup
- [X] Environment variables

## Database og lagring av punkter
- [X] Sette opp SQLite database for prosjektet
- [X] Lage tabell for punkter med feltene: id, latitude, longitude, category, creator_id, created_at
- [X] Lage API-endepunkt for å lagre og hente punkter fra databasen
- [X] Integrere lagring og henting av punkter i frontend
- [X] Lagre og hente funn-data i database 
- [X] Lagre og hente spor-logg i database
- [X] Sync -button with DB? how to sync reliably?

## Uncategorized
- [X] default search track named with timestamp as default if no text input. 
- [ ] live mode, not debug couch mode for tracking
- [ ] test actual mobile workflow marking distance and direction shot target


