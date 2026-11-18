# UX-forslag: lesbarhet og brillevennlighet

Gjennomgang av Aware sett fra brukere som synes knapper og tekst er for små,
men som vil beholde alle funksjoner og se mest mulig kart.
Målt i appen på iPhone 13 (390 × 844 pt), november 2026.

## 1. Dagens situasjon (målt)

| Element | Størrelse | Tekst | Problem |
|---|---|---|---|
| ⚙️ innstillinger / ☑️ filter (topp) | 32 × 32 | emoji | Under anbefalt minimum (44–48). Emoji uten forklaring. |
| Aware / Shoot / Track (topp) | ca. 50 × 40 | 12 px | Liten tekst. Navnene stemmer ikke med koden (`track` vises som «Shoot», `søk` som «Track»). |
| ☰ admin (topp høyre) | 40 × 40 | – | Litt lite. Tre forskjellige menyknapper i toppen (⚙️, ☑️, ☰). |
| Høyrekolonne: 👁️ ❗ 🔍 lag 🧭 📍 🔓 | 48 × 48 | emoji | Opptil 7 knapper stablet. Bare symboler, ingen tekst. Rødt ❗ på grått har dårlig kontrast. Kolonnen tar ca. 60 % av skjermhøyden på høyre side. |
| Bunn i Track: Obs / Mark! / Start | ca. 60 × 48 | **10 px** | Minste tekst i appen, på de viktigste knappene ute i felt. |
| Bunn i Shoot: Target | 140 × 48 | **10 px** | Stor knapp, men nesten uleselig tekst. |
| Bunn i Aware: ✕ (fjern måling) | 72 × 48 | 12 px | Grått på grått når den er deaktivert, ser ødelagt ut. |
| Leaflet +/− (oppe til venstre) | 30 × 30 | – | Små. Dekker kartet selv om knipe-zoom finnes. |
| Innstillinger | 10 trekkspill-seksjoner | blanding | Lang liste i et flytende kort. 49 steder med `text-xs`/10 px inni. Blanding av norsk og engelsk («Home position settings», «Quick filters»). |
| Hele kodebasen | 88 knapper i `mapcomponent.tsx` | 160× `text-xs`, 15× `text-[10px]` | Hver knapp er stylet for hånd, så størrelser og farger spriker. |

Det som allerede fungerer: knappene i høyrekolonnen og bunnen er 48 px høye.
Filterpanelet har store avkrysningsfelt og god tekst. Det er hovedsakelig
**tekststørrelse, kontrast, symboler uten tekst og antall flytende knapper**
som er problemet, ikke trykkflatene alene.

## 2. Prinsipper

1. **Minst 48 × 48 px** trykkflate på alt som kan trykkes. Primærknapper i felt bør være 56 px.
2. **Ingen tekst under 14 px**, og knappetekst minst 16 px halvfet. Bruk `rem`, ikke `px`, så telefonens tekststørrelse virker.
3. **Tekst + ikon** på alle handlinger som ikke er helt opplagte (LOS, Fare, Søk, Lås).
4. **Høy kontrast mot satellittbilde:** mørk, nesten ugjennomsiktig bakgrunn med hvitt ikon og en lys kant. Ikke emoji på grått.
5. **Færre flytende knapper samtidig:** vis bare det som hører til modusen du står i. Alt annet ligger ett trykk unna.
6. **Én meny**, ikke tre.
7. **Norsk overalt**, samme ord i knapp, meny og kode.

## 3. Forslag

### A. Raske gevinster (lav risiko, mest CSS)

1. **Felles knappekomponenter** i `src/components/ui/`:
   `MapButton` (rund, 48/56 px, ikon + valgfri tekst under) og `ActionButton` (pille, 56 px høy, 16–18 px tekst).
   Bytt ut de håndstylede knappene gradvis. Da kan resten av forslagene gjøres ett sted.
2. **Tekststørrelser:** `text-[10px]` blir `text-base font-bold` på Obs/Mark!/Start/Target.
   Mode-knappene i toppen blir 16 px. Avstandsvisningen («0m») blir `text-xl`.
3. **Ikoner:** bytt emoji (👁️ ❗ 🔍 📍 🔓 🗜️ 📐) til SVG-ikoner, for eksempel `lucide-react`.
   De er skarpe, like store, og fargen kan styres. Bruk 24–28 px ikon, hvitt på `bg-gray-900/85`, `ring-2 ring-white/70`.
4. **Korte etiketter under ikonene** i høyrekolonnen (12–13 px halvfet): «Sikt», «Fare», «Søk», «Kart», «Kompass», «GPS», «Lås».
5. **Skjul ✕ når det ikke er noe å fjerne**, i stedet for å vise en grå, deaktivert knapp.
6. **Leaflet +/−:** gjør dem 48 px, eller skru dem av som standard. Innstillingen finnes allerede.
7. **Språk og navn:** ett språk (norsk). Rydd i modusnavnene, se B.3.
8. **Safe area:** bruk `env(safe-area-inset-top/bottom)` på topp- og bunnlinjen, så knappene ikke havner under notch eller hjemlinje når appen kjøres som PWA.

### B. «Store knapper»-innstilling (viktigst for brillebrukere)

Brukerne er forskjellige: noen vil ha maks kart, andre trenger store knapper.
Innfør en **visningsstørrelse** under Innstillinger → Visning:

- **Normal** (dagens størrelser, men med prinsippene over)
- **Stor** (knapper × 1,25, tekst × 1,2)
- **Ekstra stor** (knapper × 1,5, tekst × 1,4, etiketter alltid synlige)

Teknisk: én CSS-variabel `--ui-scale` på `<html>`, lagret i `localStorage`
(som de andre innstillingene). `MapButton`/`ActionButton` bruker `calc(48px * var(--ui-scale))`.
Kartet påvirkes ikke, bare knapper og paneler. Valget bør vises første gang appen åpnes.

### C. Ny layout som gir mer kart og større knapper

Dagens oppsett har knapper i fire kanter: toppen (6 knapper), venstre (zoom),
høyre (opptil 7) og bunnen (3–4). Forslaget samler dem i **to soner**, som gjør
midten og toppen av kartet fri:

```
┌───────────────────────────────┐
│ [Kongshov skog ▾]      [≡]    │  ← tynn topplinje: aktivt jaktfelt + én meny
│                               │
│                        (Kart) │  ← 3 faste kartknapper til høyre:
│                       (Komp.) │     kartlag, kompass/nord, GPS/følg
│            ●                  │
│                        (GPS)  │
│                               │
│ ┌───────────────────────────┐ │
│ │  [Sikt] [Fare] [Søk] [📏] │ │  ← verktøyrad for aktiv modus (56 px, tekst)
│ └───────────────────────────┘ │
│ ┌─────────┬─────────┬───────┐ │
│ │  Aware  │ Skudd   │ Spor  │ │  ← modusfaner nederst (64 px, ikon + tekst)
│ └─────────┴─────────┴───────┘ │
└───────────────────────────────┘
```

1. **Modusvalg flyttes til en fanelinje nederst** (64 px, ikon + 14–16 px tekst).
   Den er lett å nå med tommelen og kjent fra andre apper. Toppen blir nesten tom.
2. **Verktøyrad per modus** rett over fanene, med store pilleknapper med tekst:
   - Aware: Sikt (LOS) · Fare · Søk · Mål avstand · Retikkel
   - Skudd: **Marker treff** (én stor primærknapp)
   - Spor: Obs · Markér · **Start/Stopp spor**

   LOS/Fare/Søk/MSR flyttes fra høyrekolonnen hit, slik at høyrekolonnen bare har 3 faste kartknapper.
3. **Én meny (≡)** erstatter ⚙️, ☑️ og ☰. Den åpnes som et **helskjermsark** fra bunnen
   (ikke et flytende kort), med store rader (56 px) gruppert i:
   - **Kart:** kartlag, offline kart, jaktfelt, hogst, flyfoto
   - **Vis på kartet:** dagens «Quick filters» (skuddpar, spor, funn, observasjoner, grenser, høydeprofil)
   - **Verktøy:** LOS, retikkel, kompass, avstander
   - **Utseende:** visningsstørrelse (B), farger og tykkelser
   - **Lag og konto:** dagens admin-meny

   Dagens «Filter settings» i Innstillinger og ☑️-panelet dupliserer hverandre og slås sammen.
4. **Lås-knappen** (🔓) og kompassvalg samles i kompassknappen: trykk for nord opp / følg retning, langt trykk for lås.
5. **«Rent kart»-modus:** et trykk på en liten «skjul»-hake (eller to-finger-trykk) skjuler alt unntatt fanelinjen.
   Det gir maks kart når man bare vil se, uten å fjerne noen funksjoner.
6. **Jaktfeltvelger i toppen:** det aktive feltet vises som en knapp med navn.
   I dag ligger feltvalget dypt i Innstillinger → Jaktfelt.

Resultat: færre knapper på skjermen samtidig (typisk 3 + 3–5 i stedet for 12–14),
men hver knapp er større og har tekst. Ingen funksjoner forsvinner.

### D. Paneler, dialoger og skjemaer

- Glidebrytere: større håndtak (28–32 px) og verdien skrevet stort over.
  Legg til − / + -knapper ved siden av for presise verdier (LOS-høyde, avstand).
- Dialoger (skuddpar, observasjon, funn): bunnark med fullbredde-knapper på 56 px.
  Primærhandling alltid på samme side (høyre), avbryt til venstre.
- Popup på kartet (hogst, punkter): minst 16 px tekst og en tydelig lukkeknapp på 44 px.
- Unngå grå tekst (`text-gray-400/500`) på hvit bakgrunn til viktig informasjon. Bruk `text-gray-700` eller mørkere.

## 4. Foreslått rekkefølge

| Fase | Innhold | Risiko |
|---|---|---|
| 1 | A1–A8: komponenter, tekststørrelser, ikoner, etiketter, språk | Lav |
| 2 | B: visningsstørrelse (Normal / Stor / Ekstra stor) | Lav |
| 3 | C1–C2: fanelinje nederst + verktøyrad per modus | Middels (flytter knapper) |
| 4 | C3: én meny som helskjermsark, slå sammen filter/innstillinger/admin | Middels |
| 5 | C4–C6 og D | Lav–middels |

Test hver fase med skjermbilder på minste vanlige skjerm (iPhone SE, 375 × 667)
og på en stor Android, både i nettleser og som installert PWA.
Få 2–3 av brukerne med briller til å prøve fase 1–2 før fase 3 starter.

## 5. Ferdige prompter til Cursor

**Fase 1**
> Les `docs/UX-forslag.md`. Gjør fase 1 (seksjon A). Lag `src/components/ui/MapButton.tsx` og
> `ActionButton.tsx` etter prinsippene i seksjon 2. Ta i bruk `lucide-react`-ikoner i stedet for emoji.
> Bytt ut knappene i toppen av `src/app/page.tsx` og i bunnen/høyrekolonnen i
> `src/components/mapcomponent.tsx`. Ingen tekst under 14 px, ingen trykkflate under 48 px.
> Ikke endre oppførsel, bare utseende. Vis skjermbilder i iPhone SE-størrelse før og etter.

**Fase 2**
> Les `docs/UX-forslag.md` seksjon B. Legg til innstillingen «Visningsstørrelse» (Normal/Stor/Ekstra stor)
> med CSS-variabelen `--ui-scale` på `<html>`, lagret i localStorage. MapButton/ActionButton og
> menypanelene skal skalere med den. Kartet skal ikke påvirkes.

**Fase 3**
> Les `docs/UX-forslag.md` seksjon C1–C2. Flytt modusvalget (Aware/Skudd/Spor) til en fanelinje
> nederst, og lag en verktøyrad per modus rett over. Flytt LOS, Fare, Søk og MSR fra høyrekolonnen
> til verktøyraden i Aware. Høyrekolonnen skal bare ha kartlag, kompass og GPS.
> Behold alle funksjoner. Respekter safe-area-insets.

## 6. Gjennomført: menyer og kartsymboler (nov. 2026)

**To menyer med hver sin rolle**

- **☑️ Vis på kartet** – det man slår av/på ute i felt, tilpasset modus:
  rekkevidder (søkeradius, sikt, maks skuddavstand), kartlag (skuddpar, spor, funn,
  observasjoner, jaktgrense, ikke-jakt-soner, nye hogster, høydeprofil) og bebyggelse.
- **⚙️ Innstillinger** – oppsett og utseende, ett trekkspill åpent om gangen:
  Visningsstørrelse · Jaktfelt (valg, hjemposisjon, offline, nye felt) · Offline kart ·
  Farger og størrelser · Bebyggelse-sektorer · Retikkel · Kompass og zoomknapper · Data.
- Fjernet dobbeltføring: sikt-rekkevidde/-høyde, bebyggelsesfilter, «vis hogster» og
  «vis ikke-jakt-soner» lå begge steder.
- «Lagre som standard» er borte: alt lagres automatisk.
- Felles kontroller i `src/components/ui/MenuControls.tsx` (brytere, store glidebrytere, fargerader).

**Kartsymboler** (`src/lib/map/symbolSize.ts`)

| Type | Eksempler | Størrelse |
|---|---|---|
| Område | rekkevidde, sikt, jaktfelt, ikke-jakt-sone | ekte meter, zoomer med kartet |
| Punkt | standplass, treffpunkt, observasjon, funn | ekte meter, men 12–36 px på skjermen |
| Markør | GPS, kartmidte, sporpunkter, tegnepunkter | fast antall piksler |
