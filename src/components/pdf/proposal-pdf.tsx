"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { Proposal, Client } from "@/types/database";
import { formatCurrency, formatDate, getBillingTypeLabel } from "@/lib/utils";
import { formatCnpj } from "@/lib/validations/cnpj";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#0F172A",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
    borderBottom: "2px solid #0284C7",
    paddingBottom: 15,
  },
  brand: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#0284C7",
  },
  subtitle: {
    fontSize: 8,
    color: "#64748B",
    letterSpacing: 2,
    marginTop: 2,
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 20,
    color: "#0F172A",
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    color: "#0284C7",
    borderBottom: "1px solid #E2E8F0",
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: 150,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#64748B",
  },
  value: {
    flex: 1,
    fontSize: 10,
  },
  scopeText: {
    fontSize: 10,
    lineHeight: 1.6,
    color: "#334155",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: "1px solid #E2E8F0",
    paddingTop: 10,
    fontSize: 8,
    color: "#94A3B8",
    textAlign: "center",
  },
  valueHighlight: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#0284C7",
  },
  valuesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    padding: 12,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
  },
  valueBox: {
    alignItems: "center",
  },
  valueLabel: {
    fontSize: 8,
    color: "#64748B",
    marginBottom: 2,
  },
});

interface ProposalPDFProps {
  proposal: Proposal;
  client: Client;
}

export function ProposalPDF({ proposal, client }: ProposalPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>PDVTEC</Text>
            <Text style={styles.subtitle}>AUTOMAÇÃO COMERCIAL</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 9, color: "#64748B" }}>Proposta Comercial</Text>
            <Text style={{ fontSize: 9, color: "#64748B" }}>
              Válida até: {formatDate(proposal.valid_until)}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{proposal.title}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados do Cliente</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Razão Social:</Text>
            <Text style={styles.value}>{client.corporate_name}</Text>
          </View>
          {client.trade_name && (
            <View style={styles.row}>
              <Text style={styles.label}>Nome Fantasia:</Text>
              <Text style={styles.value}>{client.trade_name}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>CNPJ:</Text>
            <Text style={styles.value}>{formatCnpj(client.cnpj)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Contato:</Text>
            <Text style={styles.value}>{client.contact_name} — {client.contact_email}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Condições Comerciais</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Tipo:</Text>
            <Text style={styles.value}>{getBillingTypeLabel(proposal.billing_type)}</Text>
          </View>
          <View style={styles.valuesRow}>
            <View style={styles.valueBox}>
              <Text style={styles.valueLabel}>IMPLANTAÇÃO</Text>
              <Text style={styles.valueHighlight}>{formatCurrency(Number(proposal.setup_value))}</Text>
            </View>
            <View style={styles.valueBox}>
              <Text style={styles.valueLabel}>RECORRENTE / MÊS</Text>
              <Text style={styles.valueHighlight}>{formatCurrency(Number(proposal.recurring_value))}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Escopo do Projeto</Text>
          <Text style={styles.scopeText}>{proposal.scope_description}</Text>
        </View>

        {proposal.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observações</Text>
            <Text style={styles.scopeText}>{proposal.notes}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          PDVTEC Automação Comercial — Este documento é uma proposta comercial e não constitui contrato.
        </Text>
      </Page>
    </Document>
  );
}
