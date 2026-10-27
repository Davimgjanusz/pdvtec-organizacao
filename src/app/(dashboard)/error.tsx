"use client"; // Error boundaries precisam ser Client Components

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    toast.error("Não foi possível exibir esta tela.", {
      id: "erro-tela",
      description: "Use o botão Tentar novamente ou recarregue a página.",
    });
  }, [error]);

  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Algo deu errado nesta tela</h2>
          <p className="text-sm text-muted-foreground">
            Ocorreu um erro inesperado ao carregar o conteúdo. Seus dados não foram alterados.
          </p>
          {error.digest && <p className="font-mono text-xs text-muted-foreground">Código: {error.digest}</p>}
        </div>
        <Button onClick={() => retry()}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      </CardContent>
    </Card>
  );
}
