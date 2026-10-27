"use client";

import { toast as sonner } from "sonner";
import { ToastfyCard, getToastfyLabel, type ToastfyType } from "@/components/ui/toastfy";

interface NotifyOptions {
  /** Texto secundário; quando informado, a mensagem principal vira o título do cartão */
  description?: React.ReactNode;
  duration?: number;
  id?: string | number;
}

const DEFAULT_DURATION: Record<ToastfyType, number> = {
  success: 4000,
  info: 5000,
  warning: 6000,
  error: 7000,
};

function show(type: ToastfyType, text: React.ReactNode, options: NotifyOptions = {}) {
  const duration = options.duration ?? DEFAULT_DURATION[type];
  // Estrutura do toastfy: sempre título + mensagem
  const title = options.description ? text : getToastfyLabel(type);
  const message = options.description ?? text;

  return sonner.custom(
    (id) => (
      <ToastfyCard
        type={type}
        title={title}
        message={message}
        duration={duration}
        onClose={() => sonner.dismiss(id)}
      />
    ),
    { duration, id: options.id }
  );
}

/** Notificações do sistema (mesma API usada anteriormente com o sonner) */
export const toast = {
  success: (text: React.ReactNode, options?: NotifyOptions) => show("success", text, options),
  error: (text: React.ReactNode, options?: NotifyOptions) => show("error", text, options),
  warning: (text: React.ReactNode, options?: NotifyOptions) => show("warning", text, options),
  info: (text: React.ReactNode, options?: NotifyOptions) => show("info", text, options),
  dismiss: (id?: string | number) => sonner.dismiss(id),
};
