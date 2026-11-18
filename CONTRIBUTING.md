# Bidra til Aware

Kort guide for deg som skal lage noe nytt i Aware (for eksempel din egen front-end),
mot samme jaktlag og samme database.

## Grunnregler

- **`main` er det som kjører i produksjon** (Vercel deployer automatisk derfra).
  Ikke push direkte til `main`. Lag en egen branch og en pull request.
- **Én database for alle.** Front-ender snakker med databasen gjennom API-rutene
  i `src/app/api/`. Ingen skal ha egne databasenøkler i koden.
- **Endringer i databasestrukturen** (tabeller og kolonner) avtales med eieren først,
  siden alle front-ender bruker de samme tabellene.
- **Sletting er et merke, ikke en fjernet rad.** Tabellene `posts`, `tracks`, `finds` og
  `observations` har `deleted_at`. Rader der den er satt, er slettet og skal ikke vises.
  `updated_at` settes automatisk og brukes til å hente bare endringer.
- **Aldri committ nøkler.** `.env*` er ignorert av git. Hold det sånn.

## Komme i gang

1. Godta invitasjonen til repoet (kommer på e-post fra GitHub).
2. Klon repoet og lag din egen branch:

   ```bash
   git clone https://github.com/thenninge/aware.git
   cd aware
   git checkout -b ditt-navn/ny-frontend
   ```

3. Installer og kjør lokalt:

   ```bash
   npm install
   npm run dev
   ```

   Åpne http://localhost:3000. Uten nøkler virker kartet, men ikke innlogging og lagdata.
   Trenger du det lokalt, be eieren om en egen `.env.local` (du får en egen nøkkel som kan trekkes tilbake).

4. Push branchen din når du vil teste på nett:

   ```bash
   git push -u origin ditt-navn/ny-frontend
   ```

   Vercel lager da en egen test-adresse (preview) for branchen, med ekte innlogging og data.

5. Når noe er klart for alle: lag en **pull request** til `main` på GitHub.
   Eieren ser over og merger.

## Struktur

| Mappe | Innhold |
|---|---|
| `src/app/api/` | API-rutene. All tilgang til databasen går her. |
| `src/app/` | Sider. En ny front-end kan ligge i en egen rute, f.eks. `src/app/v2/`. |
| `src/components/` | Kart og menyer i dagens front-end. |
| `src/lib/` | Felles logikk (kart, database-hjelpere, synk). |
| `docs/` | Notater om UX og design. |
