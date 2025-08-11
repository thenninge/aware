# Aware App - TODO List

## 🎯 Hovedfunksjonalitet
- [ ] Kart-app som viser brukerens posisjon (GPS) eller manuell navigering
- [ ] Finne bygninger, gårder, landsbyer rundt valgt posisjon
- [ ] Vise retning og avstand til omkringliggende steder
- [ ] Pie-slices som viser retninger og befolkningskategorier

## 📱 Mobil-først Design
- [ ] Responsive design for mobil
- [ ] Touch-friendly interface
- [ ] Optimalisert for mobile nettlesere

## 🗺️ Kart & Posisjon
- [ ] Kartverket WMTS som bakgrunnskart (norsk topografi) ✅
- [ ] GPS-posisjonering på mobil ✅
- [ ] Manuell kartnavigering (scroll/pan) ✅
- [ ] Kompassrose når i live GPS-mode
- [ ] Vise brukerens nåværende posisjon ✅

## 📏 Radius & Avstand
- [ ] Radius-velger: 1000m - 4000m ✅
- [ ] Steg på 500m ✅
- [ ] Vise reell radius på kartet ✅
- [ ] Pie-slices basert på faktisk radius

## 🎨 Pie-slices & Kategorier
- [ ] Hardkodede farger per kategori:
  - [ ] Gård: Hvit overlay
  - [ ] Landsby: Rød overlay
  - [ ] Andre kategorier: TBD
- [ ] Vise retning til hver kategori
- [ ] Non-interaktive slices (ikke klikkbare)
- [ ] SVG overlays på Leaflet (anbefalt implementasjon)

## 🔧 Teknisk Setup
- [ ] Next.js prosjekt ✅
- [ ] Vercel deployment
- [ ] Leaflet.js for kart-integrasjon (MVP) ✅
- [ ] MapLibre GL som fremtidig oppgradering (vektortiles/3D)
- [ ] Kartverket WMTS tiles ✅
- [ ] Overpass API integrasjon
- [ ] Serverless API routes
- [ ] Responsive CSS framework (Tailwind) ✅

## 📊 Data & API
- [ ] Overpass API (OSM) for bygninger/landsbyer i radius ✅
- [ ] Spørringer: landuse=farmyard, place=village, building=* ✅
- [ ] Matrikkelen fra Geonorge for nøyaktige bygningstyper
- [ ] Serverless API på Vercel for data-caching ✅
- [ ] Radius-spørringer mot valgt posisjon ✅
- [ ] Kartverkets WMTS (topografisk kart, terreng, sjøkart) ✅

## 🎨 UI/UX
- [ ] Radius-velger komponent
- [ ] Filter-komponent
- [ ] Kart-kontroller
- [ ] Posisjon-indikator
- [ ] Kompassrose (GPS-mode)

## 🚀 Deployment
- [ ] Git repository setup ✅ (https://github.com/thenninge/aware.git)
- [ ] Vercel konfigurasjon
- [ ] Environment variables
- [ ] Production build
- [ ] Domain setup

## 📝 Notater
- Hobbyprosjekt, lav trafikk
- Gratis/billig hosting på Vercel
- Åpne APIer og datasett
- Mobil-først tilnærming
- Start med Leaflet (MVP), oppgrader til MapLibre hvis nødvendig
- SVG overlays for pie-slices (lettest å prototypere)
