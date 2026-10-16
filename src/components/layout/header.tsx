"use client";

import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "./theme-toggle";
import type { Profile } from "@/types/database";

interface HeaderProps {
  profile: Profile | null;
  onSignOut: () => void;
  onMenuToggle?: () => void;
}

export function Header({ profile, onSignOut, onMenuToggle }: HeaderProps) {
  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "?";

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:px-6">
      <div className="flex items-center gap-2">
        {onMenuToggle && (
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuToggle} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium md:block">{profile?.full_name}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Sair">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
