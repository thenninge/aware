# Aware2 - Interactive Map Application

A Next.js application that displays interactive maps using Leaflet.js, OpenStreetMap tiles, and Overpass API for building data visualization.

## Features

- **Interactive Maps**: Built with Leaflet.js and OpenStreetMap
- **Building Data**: Fetches building information via Overpass API
- **Pie Chart Visualization**: Shows building density with colored slices
- **Category Filtering**: Filter by city, town, village, hamlet, farm, isolated dwelling
- **Customizable Settings**: Adjust colors, opacity, and angle ranges
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Framework**: Next.js 15.4.6
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Maps**: Leaflet.js + React-Leaflet
- **Data**: Overpass API (OpenStreetMap)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd aware2
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Development

- **Main Map Component**: `src/components/mapcomponent.tsx`
- **Pie Chart**: `src/components/piechart.tsx`
- **Settings Menu**: `src/components/settingsmenu.tsx`
- **API Routes**: `src/app/api/overpass/route.ts`

## Deployment

### Deploy on Vercel

The easiest way to deploy this app is using the [Vercel Platform](https://vercel.com/new):

1. **Connect your GitHub repository** to Vercel
2. **Import the project** - Vercel will automatically detect Next.js
3. **Deploy** - Vercel will build and deploy your app

### Manual Deployment

1. **Build the project**:
```bash
npm run build
```

2. **Deploy to Vercel**:
```bash
npx vercel --prod
```

### Environment Variables

No environment variables are required for basic functionality. The app uses public APIs (OpenStreetMap, Overpass).

## API Endpoints

- `GET /api/overpass` - Fetches building data from Overpass API
  - Query params: `lat`, `lng`, `radius`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).
