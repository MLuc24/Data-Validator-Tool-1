import type { Plan } from "@/types/supabase";
import { repairMojibakeText } from "@/lib/text-repair";
import { FALLBACK_PLANS } from "./plans";

const FALLBACK_COMPANY_CODE_TO_ID: Record<string, number> = {
  TC: 1,
  XVP: 2,
  AAG: 3,
  GA: 4,
  HT: 22,
  HTX_XVP: 23,
  HTX_XTQ: 24,
};

const FALLBACK_COMPANY_NAME_ALIASES_BY_ID: Record<number, string[]> = {
  1: [
    "Cong ty Co phan Thinh Cuong",
    repairMojibakeText("Công ty Cổ phần Thịnh Cường"),
  ],
};

const FALLBACK_COST_CENTER_NAME_ALIASES_BY_CODE: Record<string, string[]> = {
  HL_XDV: [
    "Vinfast Ha Long (61)",
    repairMojibakeText("Vinfast Hạ Long (61)"),
  ],
  TN_AT: ["Depot Thai Nguyen", repairMojibakeText("Depot Thái Nguyên")],
};

const FALLBACK_COMPANY_ID_TO_CODE = Object.fromEntries(
  Object.entries(FALLBACK_COMPANY_CODE_TO_ID).map(([code, id]) => [id, code]),
) as Record<number, string>;

const normalizeToken = (value: string) => value.trim().toUpperCase();

export const getFallbackCompanyIdByCode = (code: string): number | null => {
  const resolved = FALLBACK_COMPANY_CODE_TO_ID[normalizeToken(code)];
  return typeof resolved === "number" ? resolved : null;
};

export const getFallbackCompanyCodeById = (
  companyId: number | string,
): string | null => {
  if (typeof companyId === "string") {
    const normalized = normalizeToken(companyId);
    return normalized || null;
  }

  return FALLBACK_COMPANY_ID_TO_CODE[companyId] ?? null;
};

export const getFallbackCompanyAliases = (
  companyId: number | string,
): string[] => {
  if (typeof companyId === "string") {
    const legacyId = getFallbackCompanyIdByCode(companyId);
    return legacyId ? FALLBACK_COMPANY_NAME_ALIASES_BY_ID[legacyId] ?? [] : [];
  }

  return FALLBACK_COMPANY_NAME_ALIASES_BY_ID[companyId] ?? [];
};

export const getFallbackCostCenterAliases = (
  costCenterCode: string,
): string[] => {
  return (
    FALLBACK_COST_CENTER_NAME_ALIASES_BY_CODE[normalizeToken(costCenterCode)] ??
    []
  );
};

export const resolveFallbackPlanIds = (
  planTokens: string[],
  plans: Plan[] = FALLBACK_PLANS,
): number[] => {
  const normalized = planTokens
    .map(normalizeToken)
    .filter((token) => token.length > 0);

  if (normalized.length === 0) return [];

  const ids = new Set<number>();
  plans.forEach((plan) => {
    const planName = normalizeToken(plan.plan_name);
    if (
      normalized.some(
        (token) =>
          token === String(plan.plan_id) ||
          token === planName ||
          planName.includes(token),
      )
    ) {
      ids.add(plan.plan_id);
    }
  });
  return [...ids];
};
