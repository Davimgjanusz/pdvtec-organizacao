import type { Metadata } from "next";
import { Toaster } from "sonner";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { ErrorToaster } from "@/components/layout/error-toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PDVTEC - Automação Comercial",
    template: "%s | PDVTEC",
  },
  description: "Sistema interno PDVTEC de gestão comercial",
  applicationName: "PDVTEC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('pdvtec-theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground">
        <ConfirmProvider>{children}</ConfirmProvider>
        <ErrorToaster />
        {/* Notificações no padrão react-toastfy: canto superior direito, empilhadas */}
        <Toaster
          position="top-right"
          offset={{ top: 72, right: 20 }}
          mobileOffset={{ top: 64, right: 16, left: 16 }}
          gap={10}
          visibleToasts={4}
          expand
          containerAriaLabel="Notificações"
          style={{ "--width": "360px" } as React.CSSProperties}
          toastOptions={{ unstyled: true, closeButtonAriaLabel: "Fechar notificação" }}
        />
      </body>
    </html>
  );
}
