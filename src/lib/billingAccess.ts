export type BillingStatus = "active" | "past_due" | "suspended";

export function canGenerateForStatus(status: BillingStatus): boolean {
  return status === "active";
}

export function getGenerationBlockedMessage(status: BillingStatus): string {
  if (status === "past_due") {
    return "Pagamento pendente. Regularize a assinatura para gerar novos sistemas.";
  }
  if (status === "suspended") {
    return "Conta suspensa por inadimplência. Entre em contato com o suporte.";
  }
  return "Geração indisponível para este status de conta.";
}
