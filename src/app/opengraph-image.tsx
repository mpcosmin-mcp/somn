import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'somn — sleep tracker for IT people';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          background: '#09090b',
          color: '#fafafa',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Top: brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 96, fontWeight: 800, letterSpacing: '-0.04em' }}>somn</span>
          <span style={{ fontSize: 18, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 600, marginLeft: 16, marginTop: 32 }}>
            sleep · IT · team
          </span>
        </div>

        {/* Middle: tagline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Sleep, REM, RHR & HRV
          </span>
          <span style={{ fontSize: 32, color: '#a1a1aa', lineHeight: 1.3 }}>
            Tracker de somn pentru echipă — Sleep Score, REM, RHR, HRV.
            <br />Gamificat, minimal, cu clasament.
          </span>
        </div>

        {/* Bottom: stack */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 22, color: '#52525b', fontFamily: 'monospace' }}>
            ~$ next.js · vercel
          </span>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: '#a3e635',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 56, color: '#09090b' }}>🌙</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
