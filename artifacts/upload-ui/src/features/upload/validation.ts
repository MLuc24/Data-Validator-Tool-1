import { ALL, type FactConfig } from "@/data/factRegistry";
import {
  getFallbackCompanyAliases,
  getFallbackCostCenterAliases,
} from "@/data/masterDataFallback";
import { isExplicitPlaceholderToken, normalizeLookupValue } from "./file-utils";
import type { FilterScope, RowData } from "./types";

export const validateDataAgainstFilters = (
  data: RowData[],
  companyId: string,
  ccId: string,
  planId: string,
  factConfig: FactConfig | null,
  scope: FilterScope,
): string[] => {
  if (!data.length || !scope.loggedInUser || !factConfig) return [];

  const permittedCompanies =
    companyId === ALL
      ? scope.userCompanies
      : scope.userCompanies.filter((c) => String(c.company_id) === companyId);

  const permittedPlans =
    planId === ALL
      ? scope.userPlans
      : scope.userPlans.filter((p) => String(p.plan_id) === planId);

  const permittedCCs =
    ccId === ALL
      ? scope.userCostCenters
      : scope.userCostCenters.filter(
          (cc) => (cc.cost_center_id ?? cc.cost_center_code) === ccId,
        );

  const companyValidValues = new Set(
    permittedCompanies.flatMap((c) => [
      normalizeLookupValue(c.company_name),
      normalizeLookupValue(String(c.company_id)),
      ...getFallbackCompanyAliases(c.company_id).map(normalizeLookupValue),
    ]),
  );

  const planValidValues = new Set(
    permittedPlans.map((p) => normalizeLookupValue(p.plan_name)),
  );

  const ccValidValues = new Set(
    permittedCCs.flatMap((cc) => [
      normalizeLookupValue(cc.cost_center_name),
      normalizeLookupValue(String(cc.cost_center_id ?? cc.cost_center_code ?? "")),
      ...getFallbackCostCenterAliases(
        String(cc.cost_center_id ?? cc.cost_center_code ?? ""),
      ).map(normalizeLookupValue),
    ]),
  );

  const companyErrRows: number[] = [];
  const planErrRows: number[] = [];
  const ccErrRows: number[] = [];
  const companyColumns = factConfig.filterColumns.company;
  const planColumns = factConfig.filterColumns.plan;
  const ccColumns = factConfig.filterColumns.costCenter;

  const extractValue = (
    row: RowData,
    keys: string[],
    options?: { ignorePlaceholderBacktick?: boolean },
  ) => {
    for (const key of keys) {
      const value = normalizeLookupValue(String(row[key] ?? ""));
      if (
        options?.ignorePlaceholderBacktick &&
        isExplicitPlaceholderToken(value)
      ) {
        return "";
      }
      if (value) return value;
    }
    return "";
  };

  data.forEach((row, i) => {
    const rowNum = i + 2;
    const cty = extractValue(row, companyColumns, {
      ignorePlaceholderBacktick: true,
    });
    const khoi = extractValue(row, planColumns);
    const bp = extractValue(row, ccColumns);

    if (companyColumns.length && cty && !companyValidValues.has(cty)) {
      companyErrRows.push(rowNum);
    }

    if (planColumns.length && khoi && !planValidValues.has(khoi)) {
      planErrRows.push(rowNum);
    }

    if (ccColumns.length && bp && !ccValidValues.has(bp)) {
      ccErrRows.push(rowNum);
    }
  });

  const errs: string[] = [];
  if (companyErrRows.length) {
    errs.push(
      `Cot "Cong ty": ${companyErrRows.length} dong khong hop le. Cho phep: ${permittedCompanies
        .map((c) => c.company_name)
        .join(", ")}`,
    );
  }
  if (planErrRows.length) {
    errs.push(
      `Cot "Khoi": ${planErrRows.length} dong khong hop le. Cho phep: ${permittedPlans
        .map((p) => p.plan_name)
        .join(", ")}`,
    );
  }
  if (ccErrRows.length) {
    errs.push(
      `Cot "Bo phan": ${ccErrRows.length} dong khong hop le. Cho phep: ${permittedCCs
        .map((cc) => cc.cost_center_name)
        .join(", ")}`,
    );
  }

  return errs;
};
