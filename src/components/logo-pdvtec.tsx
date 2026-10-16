"use client";

interface LogoPDVTECProps {
  className?: string;
  collapsed?: boolean;
}

export function LogoPDVTEC({ className = "", collapsed = false }: LogoPDVTECProps) {
  if (collapsed) {
    return (
      <div className={`flex items-center ${className}`} aria-label="PDVTEC">
        <img
          src="/favicon.svg"
          alt="PDVTEC"
          width={32}
          height={32}
          className="w-8 h-8"
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className}`} aria-label="PDVTEC Automação Comercial">
      <img
        src="/logo-pdvtec.svg"
        alt="PDVTEC Automação Comercial"
        width={170}
        height={102}
        className="h-auto w-[170px] text-foreground"
      />
    </div>
  );
}
