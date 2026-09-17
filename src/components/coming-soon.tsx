import { Logo } from "@/components/brand/logo";

const FEATURES = [
  "Hosting Próprio",
  "Player 100% Configurável",
  "Analytics Avançado",
];

export function ComingSoon() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16">
      {/* Logo */}
      <div className="mb-10">
        <Logo size="lg" />
      </div>

      {/* Main content */}
      <div className="text-center max-w-md space-y-4">
        {/* Badge */}
        {/* <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-3 py-1">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
          <span className="text-[11px] font-semibold tracking-wide text-primary uppercase">
            Em breve
          </span>
        </div> */}

        {/* Heading */}
        <h1 className="text-4xl font-bold tracking-tight text-foreground max-w-md">
          Estamos preparando tudo!
        </h1>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
          Uma plataforma técnica para gerenciar, configurar e acompanhar
          seus vídeos com precisão.
        </p>
      </div>

      {/* Divider */}
      <div className="mt-10 mb-8 w-px h-8 bg-border" aria-hidden="true" />

      {/* Features */}
      <div className="flex items-center gap-6 flex-wrap justify-center">
        {FEATURES.map((f, i) => (
          <span
            key={f}
            className="flex items-center gap-2 text-xs text-muted-foreground font-medium"
          >
            {i > 0 && (
              <span className="text-border select-none" aria-hidden="true">·</span>
            )}
            {f}
          </span>
        ))}
      </div>

      {/* Footer */}
      <p className="absolute bottom-8 text-[11px] text-muted-foreground/50">
        © {new Date().getFullYear()} WatchMap
      </p>
    </div>
  );
}
