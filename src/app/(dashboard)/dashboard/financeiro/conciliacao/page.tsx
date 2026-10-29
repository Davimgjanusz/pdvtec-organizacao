import type { Metadata } from "next";
import { ReconciliationManager } from "@/components/financeiro/reconciliation-manager";

export const metadata: Metadata = {
  title: "Conciliação Financeira",
};

export default function ConciliacaoPage() {
  return <ReconciliationManager />;
}
