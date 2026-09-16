import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Em breve — WatchMap",
  description:
    "O WatchMap está chegando. Prepare-se para uma nova forma de gerenciar e analisar seus vídeos.",
};

const CSS = `
  .cs-root {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.5rem;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
    background: #0a0412;
    color: #f0eaff;
  }
  .cs-bg {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,.35) 0%, transparent 70%),
      radial-gradient(ellipse 50% 40% at 80% 80%, rgba(91,33,182,.2) 0%, transparent 60%),
      radial-gradient(ellipse 40% 30% at 10% 90%, rgba(139,92,246,.15) 0%, transparent 60%),
      #0a0412;
    z-index: 0;
  }
  .cs-grid {
    position: fixed;
    inset: 0;
    z-index: 0;
    background-image:
      linear-gradient(rgba(139,92,246,.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(139,92,246,.05) 1px, transparent 1px);
    background-size: 60px 60px;
    -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%);
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%);
  }
  .cs-orb {
    position: fixed;
    border-radius: 50%;
    filter: blur(80px);
    z-index: 0;
    animation: cs-drift 20s ease-in-out infinite alternate;
  }
  .cs-orb-1 {
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(124,58,237,.45), transparent 70%);
    top: -200px; left: -100px;
    animation-duration: 18s;
  }
  .cs-orb-2 {
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(139,92,246,.35), transparent 70%);
    bottom: -100px; right: -50px;
    animation-duration: 24s;
    animation-direction: alternate-reverse;
  }
  .cs-orb-3 {
    width: 300px; height: 300px;
    background: radial-gradient(circle, rgba(196,181,253,.2), transparent 70%);
    top: 40%; left: 60%;
    animation-duration: 30s;
  }
  @keyframes cs-drift {
    0%   { transform: translate(0,0) scale(1); }
    33%  { transform: translate(40px,-30px) scale(1.05); }
    66%  { transform: translate(-20px,20px) scale(.97); }
    100% { transform: translate(30px,40px) scale(1.08); }
  }
  .cs-particles {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .cs-particle {
    position: absolute;
    border-radius: 50%;
    background: rgba(167,139,250,.4);
    animation: cs-float linear infinite;
  }
  @keyframes cs-float {
    0%   { transform: translateY(100vh) scale(0); opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: .5; }
    100% { transform: translateY(-10vh) scale(1); opacity: 0; }
  }
  .cs-rings {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: min(700px, 95vw);
    height: min(700px, 95vw);
    z-index: 1;
    pointer-events: none;
  }
  .cs-ring       { fill: none; stroke: rgba(139,92,246,.08); stroke-width: 1; }
  .cs-ring-glow  {
    fill: none;
    stroke: rgba(139,92,246,.18);
    stroke-width: 1;
    stroke-dasharray: 8 40;
    animation: cs-spin 30s linear infinite;
    transform-origin: center;
  }
  .cs-ring-glow-2 {
    animation-duration: 45s;
    animation-direction: reverse;
    stroke-dasharray: 4 60;
    stroke: rgba(196,181,253,.12);
  }
  .cs-ring-glow-3 {
    animation-duration: 20s;
    stroke-dasharray: 12 80;
    stroke: rgba(91,33,182,.2);
  }
  .cs-scan {
    fill: none;
    stroke: url(#cs-scan-grad);
    stroke-width: 1.5;
    stroke-dasharray: 200 1000;
    animation: cs-spin 8s linear infinite;
    transform-origin: center;
  }
  @keyframes cs-spin { to { transform: rotate(360deg); } }
  .cs-dot { fill: #8b5cf6; animation: cs-pulse 3s ease-in-out infinite; }
  .cs-dot-2 { animation-delay: 1s; fill: #a78bfa; }
  .cs-dot-3 { animation-delay: 2s; fill: #c4b5fd; }
  @keyframes cs-pulse {
    0%,100% { opacity: .3; r: 3; }
    50%     { opacity: 1;  r: 4.5; }
  }
  .cs-card {
    position: relative;
    z-index: 10;
    max-width: 560px;
    width: 100%;
    text-align: center;
    padding: 3rem 2.5rem 2.5rem;
    background: rgba(255,255,255,.03);
    border: 1px solid rgba(139,92,246,.2);
    border-radius: 24px;
    -webkit-backdrop-filter: blur(20px);
    backdrop-filter: blur(20px);
    box-shadow:
      0 0 0 1px rgba(139,92,246,.05) inset,
      0 32px 64px -16px rgba(0,0,0,.6),
      0 0 80px -20px rgba(124,58,237,.15);
    animation: cs-card-in .8s cubic-bezier(.16,1,.3,1) both;
  }
  .cs-card::before {
    content: '';
    position: absolute;
    top: -1px; left: 20%; right: 20%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(167,139,250,.6), transparent);
    border-radius: 100%;
  }
  @keyframes cs-card-in {
    from { opacity: 0; transform: translateY(24px) scale(.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .cs-logo {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 2rem;
    animation: cs-logo-in .8s cubic-bezier(.16,1,.3,1) .1s both;
  }
  @keyframes cs-logo-in {
    from { opacity: 0; transform: scale(.9); }
    to   { opacity: 1; transform: scale(1); }
  }
  .cs-logo-icon {
    width: 44px; height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%);
    border: 1px solid #6d28d9;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.22),
      0 2px 0 #5b21b6,
      0 4px 16px rgba(124,58,237,.4);
    flex-shrink: 0;
  }
  .cs-logo-name {
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -.02em;
    color: #f0eaff;
  }
  .cs-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 100px;
    background: rgba(124,58,237,.12);
    border: 1px solid rgba(139,92,246,.25);
    font-size: .7rem;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #a78bfa;
    margin-bottom: 1.25rem;
    animation: cs-badge-in .6s ease .2s both;
  }
  @keyframes cs-badge-in {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .cs-badge-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #8b5cf6;
    box-shadow: 0 0 6px #8b5cf6;
    animation: cs-blink 2s ease-in-out infinite;
  }
  @keyframes cs-blink {
    0%,100% { opacity: 1; }
    50%     { opacity: .3; }
  }
  .cs-heading {
    font-size: clamp(2.5rem,8vw,3.5rem);
    font-weight: 800;
    letter-spacing: -.04em;
    line-height: 1.05;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, #ffffff 0%, #ddd6fe 40%, #a78bfa 70%, #7c3aed 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: cs-fade-up .8s cubic-bezier(.16,1,.3,1) .15s both;
  }
  .cs-description {
    font-size: 1rem;
    line-height: 1.7;
    color: rgba(196,181,253,.7);
    max-width: 400px;
    margin: 0 auto 2rem;
    animation: cs-fade-up .8s cubic-bezier(.16,1,.3,1) .25s both;
  }
  @keyframes cs-fade-up {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .cs-divider {
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(139,92,246,.2), transparent);
    margin: 1.5rem 0;
  }
  .cs-features {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    flex-wrap: wrap;
    animation: cs-fade-up .8s cubic-bezier(.16,1,.3,1) .35s both;
  }
  .cs-feature {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: .78rem;
    font-weight: 500;
    color: rgba(167,139,250,.7);
  }
  .cs-footer {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    font-size: .7rem;
    color: rgba(139,92,246,.35);
    letter-spacing: .04em;
    white-space: nowrap;
    animation: cs-fade-in 1s ease .8s both;
    font-family: inherit;
  }
  @keyframes cs-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
`;

const PARTICLES = [
  { left: "15%", size: "3px", delay: "0s",  dur: "12s" },
  { left: "28%", size: "2px", delay: "2s",  dur: "16s" },
  { left: "42%", size: "4px", delay: "4s",  dur: "10s" },
  { left: "55%", size: "2px", delay: "6s",  dur: "18s" },
  { left: "68%", size: "3px", delay: "1s",  dur: "14s" },
  { left: "78%", size: "2px", delay: "3s",  dur: "20s" },
  { left: "88%", size: "3px", delay: "7s",  dur: "11s" },
  { left: "7%",  size: "2px", delay: "9s",  dur: "15s" },
];

const FEATURES = [
  { icon: "📹", label: "Biblioteca de vídeos" },
  { icon: "⚙️", label: "Player configurável" },
  { icon: "📊", label: "Analytics" },
];

export default function ComingSoonPage() {
  return (
    <>
      {/* Scoped styles — no dependency on globals.css or Tailwind */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="cs-root">
        {/* Background layers */}
        <div className="cs-bg" aria-hidden="true" />
        <div className="cs-grid" aria-hidden="true" />
        <div className="cs-orb cs-orb-1" aria-hidden="true" />
        <div className="cs-orb cs-orb-2" aria-hidden="true" />
        <div className="cs-orb cs-orb-3" aria-hidden="true" />

        {/* Floating particles */}
        <div className="cs-particles" aria-hidden="true">
          {PARTICLES.map((p, i) => (
            <div
              key={i}
              className="cs-particle"
              style={{
                left: p.left,
                width: p.size,
                height: p.size,
                animationDelay: p.delay,
                animationDuration: p.dur,
              }}
            />
          ))}
        </div>

        {/* SVG rings */}
        <div className="cs-rings" aria-hidden="true">
          <svg viewBox="0 0 700 700" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="cs-center" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="cs-scan-grad" x1="350" y1="350" x2="550" y2="350" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity="0" />
                <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
              </linearGradient>
            </defs>
            <circle cx="350" cy="350" r="200" fill="url(#cs-center)" />
            <circle cx="350" cy="350" r="80"  className="cs-ring" />
            <circle cx="350" cy="350" r="140" className="cs-ring" />
            <circle cx="350" cy="350" r="200" className="cs-ring" />
            <circle cx="350" cy="350" r="270" className="cs-ring" />
            <circle cx="350" cy="350" r="340" className="cs-ring" />
            <circle cx="350" cy="350" r="140" className="cs-ring-glow" />
            <circle cx="350" cy="350" r="270" className="cs-ring-glow cs-ring-glow-2" />
            <circle cx="350" cy="350" r="200" className="cs-ring-glow cs-ring-glow-3" />
            <circle cx="350" cy="350" r="200" className="cs-scan" />
            <circle cx="490" cy="350" r="3.5" className="cs-dot" />
            <circle cx="350" cy="210" r="3.5" className="cs-dot cs-dot-2" />
            <circle cx="620" cy="350" r="3"   className="cs-dot cs-dot-3" />
            <circle cx="350" cy="80"  r="2.5" className="cs-dot" style={{ animationDelay: "1.5s" }} />
          </svg>
        </div>

        {/* Card */}
        <main className="cs-card">
          {/* Logo */}
          <div className="cs-logo">
            <div className="cs-logo-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 4.75L19 12L6 19.25V4.75Z" fill="white" />
              </svg>
            </div>
            <span className="cs-logo-name">WatchMap</span>
          </div>

          {/* Badge */}
          <div className="cs-badge" role="status" aria-label="Em desenvolvimento">
            <span className="cs-badge-dot" aria-hidden="true" />
            Em desenvolvimento
          </div>

          {/* Heading */}
          <h1 className="cs-heading">Em breve.</h1>

          {/* Description */}
          <p className="cs-description">
            Estamos preparando algo especial. Uma nova forma de gerenciar,
            configurar e acompanhar seus vídeos — com precisão.
          </p>

          <div className="cs-divider" aria-hidden="true" />

          {/* Features */}
          <div className="cs-features" aria-label="O que vem por aí">
            {FEATURES.map((f) => (
              <div className="cs-feature" key={f.label}>
                <span aria-hidden="true">{f.icon}</span>
                {f.label}
              </div>
            ))}
          </div>
        </main>

        {/* Footer */}
        <p className="cs-footer" aria-hidden="true">
          © {new Date().getFullYear()} WatchMap · Todos os direitos reservados
        </p>
      </div>
    </>
  );
}
