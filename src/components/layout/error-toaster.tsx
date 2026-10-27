"use client";

import { useEffect } from "react";
import { toast } from "@/lib/notify";

const NETWORK_TOAST_ID = "rede";
const UNEXPECTED_TOAST_ID = "erro-inesperado";

function isNetworkError(reason: unknown) {
  const text = reason instanceof Error ? `${reason.name} ${reason.message}` : String(reason);
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(text);
}

/** Mensagem amigável: erros com texto em português (das nossas actions) são exibidos como vieram */
function describe(reason: unknown) {
  if (isNetworkError(reason)) return "Não foi possível falar com o servidor. Verifique sua conexão com a internet.";
  if (reason instanceof Error && /[ãáâéêíóôõúç]/i.test(reason.message)) return reason.message;
  return "Ocorreu um erro inesperado. Tente novamente; se persistir, recarregue a página.";
}

/**
 * Rede de segurança: toda falha não tratada (Server Action que lança exceção, queda de rede,
 * erro de JavaScript) e a perda de conexão viram uma notificação para o usuário.
 */
export function ErrorToaster() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      // Redirecionamentos e "not found" do Next também usam rejeições; não são erros
      const digest = (event.reason as { digest?: string } | null)?.digest;
      if (typeof digest === "string" && /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR)/.test(digest)) return;

      console.error(event.reason);
      toast.error(describe(event.reason), {
        id: isNetworkError(event.reason) ? NETWORK_TOAST_ID : UNEXPECTED_TOAST_ID,
      });
    };

    const onError = (event: ErrorEvent) => {
      // Erros de carregamento de recursos (imagens, scripts de terceiros) não chegam aqui como ErrorEvent com error
      if (!event.error) return;
      toast.error(describe(event.error), { id: UNEXPECTED_TOAST_ID });
    };

    const onOffline = () =>
      toast.warning("Você está sem conexão com a internet.", {
        id: NETWORK_TOAST_ID,
        description: "As alterações não serão salvas até a conexão voltar.",
        duration: Infinity,
      });

    const onOnline = () => {
      toast.dismiss(NETWORK_TOAST_ID);
      toast.success("Conexão restabelecida.");
    };

    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    if (!navigator.onLine) onOffline();

    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
