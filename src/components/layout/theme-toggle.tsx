"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// O tema vive na classe "dark" do <html>, aplicada antes da hidratação pelo script do layout.
// Ler essa classe por useSyncExternalStore evita copiar o tema para um estado dentro de um efeito.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const isDarkOnClient = () => document.documentElement.classList.contains("dark");
const isDarkOnServer = () => false;

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDarkOnClient, isDarkOnServer);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("pdvtec-theme", next ? "dark" : "light");
    } catch {
      // Armazenamento indisponível (modo privado); a preferência vale só nesta sessão
    }
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}>
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
