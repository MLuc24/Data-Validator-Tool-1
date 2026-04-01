import { useEffect, useMemo, useState } from "react";

import { ALL } from "@/data/factRegistry";
import {
  FALLBACK_COMPANIES,
  FALLBACK_COST_CENTERS,
  FALLBACK_PLANS,
  FALLBACK_USER_FILE_PERMISSIONS,
  FALLBACK_USER_MAPPINGS,
  FALLBACK_USERS_APP,
  getFallbackCompanyCodeById,
  resolveFallbackPlanIds,
} from "@/data/masterDataFallback";
import { repairMojibakeText, repairNullableText } from "@/lib/text-repair";
import { supabase } from "@/lib/supabase";
import type {
  Company,
  CostCenter,
  Plan,
  UserDataScope,
  UserPermission,
  UsersApp,
} from "@/types/supabase";

export const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
];

const normalizeCompanyId = (companyId: string | number | null | undefined) => {
  if (typeof companyId === "number") {
    return getFallbackCompanyCodeById(companyId) ?? String(companyId);
  }

  return String(companyId ?? "").trim().toUpperCase();
};

const normalizeCostCenterId = (
  costCenter: Pick<CostCenter, "cost_center_id" | "cost_center_code">,
) =>
  String(costCenter.cost_center_id ?? costCenter.cost_center_code ?? "")
    .trim()
    .toUpperCase();

const normalizeCompany = (company: Company): Company => ({
  ...company,
  company_id: normalizeCompanyId(company.company_id),
  is_active: company.is_active ?? true,
});

const normalizeCostCenter = (costCenter: CostCenter): CostCenter => {
  const costCenterId = normalizeCostCenterId(costCenter);

  return {
    ...costCenter,
    cost_center_id: costCenterId,
    cost_center_code: costCenter.cost_center_code ?? costCenterId,
    company_id: normalizeCompanyId(costCenter.company_id),
    is_active: costCenter.is_active ?? true,
  };
};

const normalizePlan = (plan: Plan): Plan => ({
  ...plan,
  is_active: plan.is_active ?? true,
});

export const getInitials = (name: string) =>
  name
    .split(" ")
    .slice(-2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

const repairUser = (user: UsersApp): UsersApp => ({
  ...user,
  full_name: repairMojibakeText(user.full_name),
  email: repairNullableText(user.email),
});

const repairCompany = (company: Company): Company => ({
  ...company,
  company_name: repairMojibakeText(company.company_name),
});

const repairCostCenter = (costCenter: CostCenter): CostCenter => ({
  ...costCenter,
  cost_center_name: repairMojibakeText(costCenter.cost_center_name),
});

const repairPlan = (plan: Plan): Plan => ({
  ...plan,
  plan_name: repairMojibakeText(plan.plan_name),
  parent_name: repairNullableText(plan.parent_name),
});

export function useUploadAccess() {
  const [allUsers, setAllUsers] = useState<UsersApp[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [allCostCenters, setAllCostCenters] = useState<CostCenter[]>([]);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [allUserScopes, setAllUserScopes] = useState<UserDataScope[]>([]);
  const [allUserPermissions, setAllUserPermissions] = useState<UserPermission[]>(
    [],
  );
  const [isLoadingMaster, setIsLoadingMaster] = useState(true);
  const [masterDataNotice, setMasterDataNotice] = useState<string | null>(null);
  const [scopeFallbackActive, setScopeFallbackActive] = useState(false);
  const [permissionsFallbackActive, setPermissionsFallbackActive] =
    useState(false);

  const [loggedInUser, setLoggedInUser] = useState<UsersApp | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginPopoverOpen, setLoginPopoverOpen] = useState(false);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(ALL);
  const [selectedCCId, setSelectedCCId] = useState<string>(ALL);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(ALL);

  useEffect(() => {
    const load = async () => {
      setIsLoadingMaster(true);

      const [uRes, scopeRes, permissionRes, coRes, ccRes, pRes] =
        await Promise.all([
          supabase
            .from("users_app")
            .select("user_id, full_name, email, is_active, created_at, updated_at")
            .eq("is_active", true),
          supabase
            .from("user_data_scope")
            .select(
              "id, user_id, company_id, plan_id, cost_center_id, created_at, updated_at",
            ),
          supabase
            .from("user_permissions")
            .select(
              "user_id, can_create, can_read, can_update, can_approve, created_at, updated_at",
            ),
          supabase
            .from("companies")
            .select("company_id, company_name, is_active, created_at, updated_at")
            .eq("is_active", true),
          supabase
            .from("cost_centers")
            .select(
              "cost_center_id, cost_center_name, company_id, plan_id, is_active, created_at, updated_at",
            )
            .eq("is_active", true),
          supabase
            .from("plans")
            .select("plan_id, plan_name, is_active, created_at, updated_at")
            .eq("is_active", true),
        ]);

      const liveUsers = ((uRes.data as UsersApp[] | null) ?? [])
        .filter((user) => user.is_active)
        .map(repairUser);
      const liveScopes = (scopeRes.data as UserDataScope[] | null) ?? [];
      const livePermissions =
        (permissionRes.data as UserPermission[] | null) ?? [];
      const liveCompanies = ((coRes.data as Company[] | null) ?? []).map(
        (company) => normalizeCompany(repairCompany(company)),
      );
      const liveCostCenters = ((ccRes.data as CostCenter[] | null) ?? []).map(
        (costCenter) => normalizeCostCenter(repairCostCenter(costCenter)),
      );
      const livePlans = ((pRes.data as Plan[] | null) ?? []).map((plan) =>
        normalizePlan(repairPlan(plan)),
      );

      const useUsersFallback = liveUsers.length === 0;
      const useScopeFallback = liveScopes.length === 0;
      const usePermissionsFallback = livePermissions.length === 0;
      const useCompaniesFallback = liveCompanies.length === 0;
      const useCostCentersFallback = liveCostCenters.length === 0;
      const usePlansFallback = livePlans.length === 0;

      setAllUsers((useUsersFallback ? FALLBACK_USERS_APP : liveUsers).map(repairUser));
      setAllUserScopes(useScopeFallback ? [] : liveScopes);
      setAllUserPermissions(usePermissionsFallback ? [] : livePermissions);
      setScopeFallbackActive(useScopeFallback);
      setPermissionsFallbackActive(usePermissionsFallback);
      setAllCompanies(
        (useCompaniesFallback ? FALLBACK_COMPANIES : liveCompanies).map((company) =>
          normalizeCompany(repairCompany(company)),
        ),
      );
      setAllCostCenters(
        (useCostCentersFallback ? FALLBACK_COST_CENTERS : liveCostCenters).map(
          (costCenter) => normalizeCostCenter(repairCostCenter(costCenter)),
        ),
      );
      setAllPlans(
        (usePlansFallback ? FALLBACK_PLANS : livePlans).map((plan) =>
          normalizePlan(repairPlan(plan)),
        ),
      );

      const fallbackDetails: string[] = [];
      if (useUsersFallback) fallbackDetails.push("users_app");
      if (useScopeFallback) fallbackDetails.push("user_data_scope");
      if (usePermissionsFallback) fallbackDetails.push("user_permissions");
      if (useCompaniesFallback) fallbackDetails.push("companies");
      if (useCostCentersFallback) fallbackDetails.push("cost_centers");
      if (usePlansFallback) fallbackDetails.push("plans");

      setMasterDataNotice(
        fallbackDetails.length
          ? `Dang dung du lieu fallback workbook cho: ${fallbackDetails.join(", ")}.`
          : null,
      );
      setIsLoadingMaster(false);
    };

    void load();
  }, []);

  const activeUserPermission = useMemo(() => {
    if (!loggedInUser) return null;

    if (!permissionsFallbackActive) {
      const permission =
        allUserPermissions.find(
          (item) => item.user_id === loggedInUser.user_id,
        ) ?? null;

      return permission
        ? {
            canCreate: permission.can_create,
            canRead: permission.can_read,
          }
        : null;
    }

    const fallbackPermission =
      FALLBACK_USER_FILE_PERMISSIONS.find(
        (permission) => permission.user_id === loggedInUser.user_id,
      ) ?? null;

    return fallbackPermission
      ? {
          canCreate: fallbackPermission.canCreate,
          canRead: fallbackPermission.canRead,
        }
      : null;
  }, [allUserPermissions, loggedInUser, permissionsFallbackActive]);

  const canCreate = !!loggedInUser && (activeUserPermission?.canCreate ?? true);
  const canRead = !!loggedInUser && (activeUserPermission?.canRead ?? true);

  const allowedCostCenters = useMemo(() => {
    if (!loggedInUser) return [] as CostCenter[];

    if (!scopeFallbackActive) {
      const allowedIds = new Set(
        allUserScopes
          .filter((scope) => scope.user_id === loggedInUser.user_id)
          .map((scope) => String(scope.cost_center_id ?? "").trim().toUpperCase()),
      );

      return allCostCenters.filter((cc) =>
        allowedIds.has(normalizeCostCenterId(cc)),
      );
    }

    const mapping = FALLBACK_USER_MAPPINGS.find(
      (item) => item.user_id === loggedInUser.user_id,
    );
    if (!mapping) return [] as CostCenter[];

    const companyIds = new Set(
      mapping.companyCodes.map((companyId) => normalizeCompanyId(companyId)),
    );
    const planIds = new Set<number>(
      resolveFallbackPlanIds(mapping.planTokens, allPlans),
    );
    const mappedCostCenters = new Set(
      mapping.costCenterCodes.map((code) => code.trim().toUpperCase()),
    );

    return allCostCenters.filter((cc) => {
      const ccId = normalizeCostCenterId(cc);
      if (mappedCostCenters.has(ccId)) return true;

      const companyMatched =
        companyIds.size > 0 && companyIds.has(normalizeCompanyId(cc.company_id));
      const planMatched = planIds.size > 0 && planIds.has(cc.plan_id);
      return companyMatched && planMatched;
    });
  }, [allCostCenters, allPlans, allUserScopes, loggedInUser, scopeFallbackActive]);

  const userCompanies = useMemo(() => {
    const ids = new Set(
      allowedCostCenters.map((cc) => normalizeCompanyId(cc.company_id)),
    );

    return allCompanies
      .filter((company) => ids.has(normalizeCompanyId(company.company_id)))
      .sort((a, b) =>
        normalizeCompanyId(a.company_id).localeCompare(
          normalizeCompanyId(b.company_id),
        ),
      );
  }, [allowedCostCenters, allCompanies]);

  const userPlans = useMemo(() => {
    const filteredCostCenters = allowedCostCenters.filter((cc) =>
      selectedCompanyId === ALL
        ? true
        : normalizeCompanyId(cc.company_id) === selectedCompanyId,
    );
    const ids = new Set(filteredCostCenters.map((cc) => cc.plan_id));

    return allPlans
      .filter((plan) => ids.has(plan.plan_id))
      .sort((a, b) => a.plan_id - b.plan_id);
  }, [allPlans, allowedCostCenters, selectedCompanyId]);

  const userCostCenters = useMemo(() => {
    return allowedCostCenters
      .filter((cc) =>
        selectedCompanyId === ALL
          ? true
          : normalizeCompanyId(cc.company_id) === selectedCompanyId,
      )
      .sort((a, b) =>
        normalizeCostCenterId(a).localeCompare(normalizeCostCenterId(b)),
      );
  }, [allowedCostCenters, selectedCompanyId]);

  const selectedPlan = userPlans.find(
    (plan) => String(plan.plan_id) === selectedPlanId,
  );

  const resolvedCompanyId =
    selectedCompanyId !== ALL
      ? selectedCompanyId
      : userCompanies.length === 1
        ? normalizeCompanyId(userCompanies[0].company_id)
        : null;

  const resolvedCCId =
    selectedCCId !== ALL
      ? selectedCCId
      : userCostCenters.length === 1
        ? normalizeCostCenterId(userCostCenters[0])
        : null;

  const handleLoginAs = (user: UsersApp) => {
    setLoginPopoverOpen(false);
    setIsLoggingIn(true);
    setLoggedInUser(user);
    setSelectedCompanyId(ALL);
    setSelectedCCId(ALL);
    setSelectedPlanId(ALL);
    setIsLoggingIn(false);
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setSelectedCompanyId(ALL);
    setSelectedCCId(ALL);
    setSelectedPlanId(ALL);
  };

  const handleCompanyChange = (value: string) => {
    setSelectedCompanyId(value);
    setSelectedCCId(ALL);
    setSelectedPlanId(ALL);
  };

  return {
    allCompanies,
    allUsers,
    canCreate,
    canRead,
    handleCompanyChange,
    handleLoginAs,
    handleLogout,
    isLoadingMaster,
    isLoggingIn,
    loggedInUser,
    loginPopoverOpen,
    masterDataNotice,
    resolvedCCId,
    resolvedCompanyId,
    selectedCCId,
    selectedCompanyId,
    selectedPlan,
    selectedPlanId,
    setLoginPopoverOpen,
    setSelectedCCId,
    setSelectedPlanId,
    userCompanies,
    userCostCenters,
    userPlans,
  };
}
