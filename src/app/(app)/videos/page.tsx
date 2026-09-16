import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { LogoutButton } from "@/components/auth/logout-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Video } from "lucide-react";

export default async function VideosPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border px-6 bg-card">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
            WM
          </div>
          <span>WatchMap</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {session?.user.email}
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Vídeos
          </h1>
          <p className="text-sm text-muted-foreground">
            Você está autenticado no WatchMap.
          </p>
        </div>

        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Video className="size-5 text-primary" />
              <CardTitle className="text-lg font-semibold">
                Área Autenticada
              </CardTitle>
            </div>
            <CardDescription>
              Bem-vindo, {session?.user.name || session?.user.email}.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Esta é uma rota protegida de validação de autenticação da Spec 002.
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
