# 📱 Plan: Aware App til Apple App Store

## 🎯 Overordnet Strategi

Ta den eksisterende Next.js web-appen og pakke den som en native iOS app ved hjelp av **Capacitor** (Ionic-rammeverk).

**Hvorfor Capacitor?**
- ✅ Beholder all eksisterende React/Next.js kode
- ✅ Gir tilgang til native iOS APIs (GPS, camera, offline storage)
- ✅ Støtter både iOS og Android
- ✅ God ytelse og native look-and-feel
- ✅ Aktivt utviklet og god dokumentasjon

---

## 📋 Fase 1: Forberedelser & Oppsett (1-2 uker)

### 1.1 Utvikler-kontoer og verktøy
- [ ] **Apple Developer Account** ($99/år)
  - Gå til [developer.apple.com](https://developer.apple.com)
  - Opprett/logg inn med Apple ID
  - Betal årlig avgift
  - Vent på godkjenning (1-2 dager)

- [ ] **Mac-maskin** (påkrevd for iOS-utvikling)
  - Xcode krever macOS
  - Minimum macOS 13.0+ anbefalt

- [ ] **Installer Xcode**
  - Last ned fra Mac App Store (gratis, men ~15GB)
  - Åpne Xcode første gang for å installere kommandolinje-verktøy
  - `xcode-select --install`

- [ ] **Installer Cocoapods**
  ```bash
  sudo gem install cocoapods
  ```

### 1.2 Evaluér app-beredskaphet
- [ ] Gjennomgå Apple's [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [ ] Sjekk at appen ikke bruker forbudte APIer eller innhold
- [ ] Verifiser at all funksjonalitet fungerer uten internett (offline-modus)

---

## 📋 Fase 2: Konverter til Capacitor (2-3 uker)

### 2.1 Installer Capacitor i eksisterende prosjekt
```bash
cd /Users/tomas/Documents/SWProjects/aware

# Installer Capacitor
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios

# Initialiser Capacitor
npx cap init
# App name: "Cold Bore Aware"
# App ID: "com.thenninge.aware" (bruk din domene/bedriftsnavn)
# Web Dir: "out" (Next.js static export)
```

### 2.2 Konfigurer Next.js for static export
Oppdater `next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // Static HTML export
  images: {
    unoptimized: true  // Capacitor trenger unoptimized images
  },
  trailingSlash: true,
}

module.exports = nextConfig
```

### 2.3 Bygg og legg til iOS platform
```bash
# Bygg Next.js static export
npm run build

# Legg til iOS platform
npx cap add ios

# Åpne iOS prosjekt i Xcode
npx cap open ios
```

### 2.4 Installer native plugins
```bash
# GPS/Geolocation
npm install @capacitor/geolocation

# Kamera (hvis trengs)
npm install @capacitor/camera

# Filesystem (for offline storage)
npm install @capacitor/filesystem

# Status Bar
npm install @capacitor/status-bar

# Splash Screen
npm install @capacitor/splash-screen

# App (for app info)
npm install @capacitor/app
```

### 2.5 Oppdater kode for Capacitor APIs
**Eksempel: GPS i stedet for browser geolocation**

Opprett `src/lib/capacitorGps.ts`:
```typescript
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export async function getCurrentPosition() {
  if (Capacitor.isNativePlatform()) {
    // Native iOS/Android
    const position = await Geolocation.getCurrentPosition();
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
    };
  } else {
    // Web fallback
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
        }),
        reject
      );
    });
  }
}
```

### 2.6 Konfigurasjon: `capacitor.config.ts`
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thenninge.aware',
  appName: 'Cold Bore Aware',
  webDir: 'out',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'automatic',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1e40af",
      showSpinner: false,
    },
  },
};

export default config;
```

---

## 📋 Fase 3: iOS-spesifikk konfigurasjon (1 uke)

### 3.1 Info.plist permissions
I Xcode, rediger `Info.plist` for å legge til permissions:

```xml
<!-- GPS permissions -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Aware trenger tilgang til din posisjon for å vise kart og bebyggelse</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Aware trenger tilgang til din posisjon for å spore din jakt</string>

<!-- Kamera (hvis brukt) -->
<key>NSCameraUsageDescription</key>
<string>Aware trenger tilgang til kamera for å ta bilder</string>

<!-- Photo Library (hvis brukt) -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Aware trenger tilgang til bildebiblioteket</string>
```

### 3.2 App Icons og Launch Screen
- [ ] Lag app ikon (1024x1024 PNG, ingen transparency)
  - Bruk [appicon.co](https://appicon.co) for å generere alle størrelser
  - Legg ikonene i `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

- [ ] Lag Launch Screen (Splash Screen)
  - Design i Figma/Photoshop
  - Eksporter som 1x, 2x, 3x størrelser
  - Legg i `ios/App/App/Assets.xcassets/Splash.imageset/`

### 3.3 App Capabilities i Xcode
I Xcode → Target → Signing & Capabilities:
- [ ] Background Modes → Location updates (hvis tracking)
- [ ] Maps (hvis bruker Apple Maps)

---

## 📋 Fase 4: Testing (1-2 uker)

### 4.1 Simulator testing
```bash
# Bygg og sync til iOS
npm run build
npx cap sync ios
npx cap open ios

# I Xcode: Velg simulator (iPhone 14 Pro) og trykk Play
```

**Test alle funksjoner:**
- [ ] GPS/posisjonering
- [ ] Kart (Leaflet/Google Maps)
- [ ] Offline-kart nedlasting
- [ ] Scanning av bebyggelse
- [ ] Team sync (Supabase)
- [ ] Shooting/tracking
- [ ] Settings persistence

### 4.2 Physical device testing
- [ ] Koble til iPhone via USB
- [ ] I Xcode → Window → Devices and Simulators
- [ ] Velg din iPhone
- [ ] Trykk Play i Xcode
- [ ] Test alle funksjoner på ekte enhet

### 4.3 TestFlight Beta Testing
- [ ] Opprett app i App Store Connect
- [ ] Upload build via Xcode Archive
- [ ] Inviter beta-testere via TestFlight
- [ ] Samle feedback
- [ ] Fiks bugs

---

## 📋 Fase 5: App Store Submission (1 uke)

### 5.1 App metadata
I [App Store Connect](https://appstoreconnect.apple.com):

**App Information:**
- [ ] **App navn**: "Cold Bore Aware"
- [ ] **Subtitle**: "Jaktplanlegging med LOS-analyse" (30 tegn)
- [ ] **Kategori**: Navigation / Sports
- [ ] **Aldersgrense**: 17+ (våpen-relatert)

**App Description:**
```
Cold Bore Aware er den ultimate appen for jegere som planlegger skyteoppsett.

✨ FUNKSJONER:
• Line of Sight (LOS) analyse med høydeprofil
• Bebyggelsessøk med Aware "kakestykker"
• Offline kart for bruk uten nett
• GPS tracking av jakttur
• Team sync - del data med jaktlag
• Skuddlogg og statistikk

🎯 PERFEKT FOR:
• Toppjakt-planlegging
• Sikker skyteplassering
• Unngå bebyggelse
• Jaktlagsamarbeid

📍 OFFLINE MODE:
Last ned kartområder for bruk uten mobildekning.

Cold Bore Aware krever GPS-tilgang for å fungere optimalt.
```

### 5.2 Screenshots og Preview
**Krav:**
- 6.7" display (iPhone 14 Pro Max): 1290 x 2796
- 5.5" display (iPhone 8 Plus): 1242 x 2208

**Ta screenshots av:**
1. Hovedkart med aware kakestykker
2. LOS-analyse med høydeprofil
3. Offline kart nedlasting
4. Team sync
5. Skuddlogg

**App Preview Video (valgfritt, men anbefalt):**
- 15-30 sekunder
- Vis hoveddunksjoner
- Bruk [Apple's spec](https://developer.apple.com/app-store/app-previews/)

### 5.3 Privacy Policy & Support URL
**Privacy Policy** (påkrevd):
- Lag en enkel side på GitHub Pages eller Vercel
- URL: `https://cbaware.vercel.app/privacy`
- Innhold:
  - Hvilke data samles (GPS, Supabase user data)
  - Hvordan brukes de
  - Tredjeparter (Google Maps, Supabase)
  - Brukernes rettigheter

**Support URL**:
- URL: `https://cbaware.vercel.app/support`
- Kontaktinfo, FAQ, email support

### 5.4 Build og Archive
```bash
# 1. Bump version i package.json
# 2. Bygg Next.js
npm run build

# 3. Sync til iOS
npx cap sync ios

# 4. Åpne Xcode
npx cap open ios

# 5. I Xcode:
#    - Velg "Any iOS Device" som target
#    - Product → Archive
#    - Vent på arkivering (5-10 min)
#    - Klikk "Distribute App"
#    - Velg "App Store Connect"
#    - Upload
```

### 5.5 Submit for Review
I App Store Connect:
- [ ] Velg build
- [ ] Fytt inn all metadata
- [ ] Legg til screenshots
- [ ] Svar på spørsmål om:
  - Encryption (velg "No" hvis du ikke bruker custom kryptering)
  - Advertising Identifier (velg "No" hvis du ikke bruker ads)
  - Content Rights (har du rettigheter til alt innhold?)
- [ ] **Submit for Review**

**Review tid:** 1-3 dager (gjennomsnitt 24 timer)

---

## 📋 Fase 6: Post-Launch (Kontinuerlig)

### 6.1 Monitoring
- [ ] Overvåk crash reports i Xcode Organizer
- [ ] Les brukeranmeldelser
- [ ] Svar på support-henvendelser

### 6.2 Updates
```bash
# For hver oppdatering:
1. Oppdater versjon i package.json og ios/App/App.xcodeproj
2. npm run build
3. npx cap sync ios
4. Archive og upload i Xcode
5. Submit ny versjon i App Store Connect
```

### 6.3 Metrics
- [ ] Antall nedlastinger
- [ ] Aktive brukere
- [ ] Crash rate
- [ ] Gjennomsnittlig rating

---

## 💰 Kostnader

| Element | Kostnad | Frekvens |
|---------|---------|----------|
| Apple Developer Account | $99 | Årlig |
| Mac-maskin (hvis du ikke har) | $1000-2000 | Engangs |
| App Store Commission | 0% (under $1M/år) | Per salg |
| TestFlight | Gratis | - |
| Xcode | Gratis | - |

**Total startkostnad:** $99 - $2099 (avhengig av om du har Mac)

---

## ⚠️ Potensielle Utfordringer

### 1. **Våpen-relatert innhold**
- Apple har strenge regler for våpen-apps
- Sørg for at appen ikke "glorifiserer vold"
- Fokuser på sikkerhet og jaktplanlegging
- Aldersgrense 17+

### 2. **Kartleverandører**
- Google Maps krever API key og har kostnader
- Leaflet + OpenStreetMap er gratis
- Apple Maps er tilgjengelig på iOS (gratis, men krev native API)

### 3. **Offline funksjonalitet**
- Må fungere uten internett
- Store kartdata kan ta mye plass
- Apple vil teste offline-funksjoner

### 4. **GPS accuracy**
- iOS har god GPS-støtte
- Men bruker må gi permissions
- Test nøye i områder med dårlig GPS-signal

---

## 📚 Ressurser

### Dokumentasjon
- [Capacitor iOS docs](https://capacitorjs.com/docs/ios)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

### Tutorials
- [Capacitor + Next.js guide](https://capacitorjs.com/docs/getting-started/with-ionic-framework)
- [iOS Development for React Developers](https://www.youtube.com/watch?v=7Ys6VJHxsEk)

### Communities
- [Capacitor Discord](https://discord.gg/UPYYRhtyzp)
- [r/iOSProgramming](https://reddit.com/r/iOSProgramming)
- [Stack Overflow - Capacitor tag](https://stackoverflow.com/questions/tagged/capacitor)

---

## 🎯 Estimert Tidslinje

| Fase | Varighet | Start | Slutt |
|------|----------|-------|-------|
| 1. Forberedelser | 1-2 uker | Uke 1 | Uke 2 |
| 2. Capacitor konvertering | 2-3 uker | Uke 2 | Uke 5 |
| 3. iOS konfigurasjon | 1 uke | Uke 5 | Uke 6 |
| 4. Testing | 1-2 uker | Uke 6 | Uke 8 |
| 5. App Store submission | 1 uke | Uke 8 | Uke 9 |
| 6. Review + godkjenning | 1-3 dager | Uke 9 | Uke 9 |

**Total tid: 8-10 uker** (ca 2-2.5 måneder)

---

## 🚀 Første Steg (Nå)

1. **Opprett Apple Developer Account** → [developer.apple.com](https://developer.apple.com)
2. **Installer Xcode** fra Mac App Store
3. **Eksperimenter med Capacitor** i et testprosjekt
4. **Design app ikon** (1024x1024)
5. **Skriv Privacy Policy** og legg på Vercel

---

## ✅ Suksesskriterier

- [ ] Appen fungerer 100% offline
- [ ] GPS-tracking er nøyaktig
- [ ] Ingen crashes i TestFlight
- [ ] Alle permissions er riktig begrunnet
- [ ] App følger Apple's design guidelines
- [ ] Privacy Policy og support URL er på plass
- [ ] Godkjent av Apple Review

---

*Sist oppdatert: 3. august 2026*
