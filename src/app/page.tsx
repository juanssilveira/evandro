import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background">
      <div className="space-y-4 max-w-sm mx-auto">
        <div className="flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-b from-violet-500 to-[#7C3AED] text-white font-bold shadow-[0_1px_2px_rgba(0,0,0,0.1),0_2px_0_#6D28D9] border border-[#6D28D9]">
            <Play className="size-6 fill-white ml-0.5" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            WatchMap
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Plataforma técnica de reprodução e análise operacional de vídeo.
          </p>
        </div>
        <div className="pt-2">
          <Button render={<Link href="/videos" />} nativeButton={false}>
            Acessar biblioteca
          </Button>
        </div>
      </div>
    </main>
  );
}
