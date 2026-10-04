import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

const SIZES = [180, 192, 512];

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

// Midlertidig ikon (sikte i grønt) til det finnes et ferdig appikon
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: sizeParam } = await params;
  const size = SIZES.includes(Number(sizeParam)) ? Number(sizeParam) : 192;
  const ring = Math.round(size * 0.46);
  const stroke = Math.max(2, Math.round(size * 0.035));
  const arm = Math.round(size * 0.74);
  const dot = Math.round(size * 0.1);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1f3d2b',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: ring,
            height: ring,
            borderRadius: '50%',
            border: `${stroke}px solid #f1f5ef`,
            position: 'absolute',
          }}
        />
        <div style={{ width: arm, height: stroke, background: '#f1f5ef', position: 'absolute' }} />
        <div style={{ width: stroke, height: arm, background: '#f1f5ef', position: 'absolute' }} />
        <div style={{ width: dot, height: dot, borderRadius: '50%', background: '#ef4444', position: 'absolute' }} />
      </div>
    ),
    { width: size, height: size }
  );
}
