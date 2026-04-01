import type { UsersApp } from "@/types/supabase";
import { repairMojibakeText } from "@/lib/text-repair";
import { FALLBACK_TIMESTAMP } from "./constants";

export interface FallbackUserMapping {
  user_id: string;
  companyCodes: string[];
  costCenterCodes: string[];
  planTokens: string[];
}

export interface FallbackUserFilePermission {
  user_id: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canApprove: boolean;
}

const RAW_FALLBACK_USERS_APP: UsersApp[] = [
  {
    user_id: "1234",
    auth_user_id: null,
    full_name: "BÃ¹i Thá»‹ Ngá»c",
    email: "1234@portup.local",
    cost_center_code: "HO_TC",
    is_active: true,
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    user_id: "3456",
    auth_user_id: null,
    full_name: "User 3456",
    email: "3456@portup.local",
    cost_center_code: null,
    is_active: true,
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    user_id: "4567",
    auth_user_id: null,
    full_name: "User 4567",
    email: "4567@portup.local",
    cost_center_code: null,
    is_active: true,
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    user_id: "5678",
    auth_user_id: null,
    full_name: "User 5678",
    email: "5678@portup.local",
    cost_center_code: null,
    is_active: true,
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    user_id: "6789",
    auth_user_id: null,
    full_name: "User 6789",
    email: "6789@portup.local",
    cost_center_code: null,
    is_active: true,
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
];

export const FALLBACK_USERS_APP: UsersApp[] = RAW_FALLBACK_USERS_APP.map(
  (user) => ({
    ...user,
    full_name: repairMojibakeText(user.full_name),
  }),
);

const RAW_FALLBACK_USER_MAPPINGS: FallbackUserMapping[] = [
  {
    user_id: "1234",
    companyCodes: ["TC"],
    costCenterCodes: ["HL_XDV", "CP_XDV", "ST_XDV", "VP_XDV"],
    planTokens: ["XDV"],
  },
  {
    user_id: "3456",
    companyCodes: ["GA", "AAG"],
    costCenterCodes: ["GA_ICT", "ST_GD", "ST_AT", "TN_AT"],
    planTokens: ["CÃ´ng nghá»‡", "DV NhÃ  hÃ ng", "Váº­n táº£i Taxi"],
  },
  {
    user_id: "4567",
    companyCodes: ["TC", "HT"],
    costCenterCodes: ["XT_O_TC", "XT_E_TC", "XT_O_HT", "XT_E_HT"],
    planTokens: ["Xe táº£i"],
  },
  {
    user_id: "5678",
    companyCodes: ["TC", "XVP", "HTX_XVP", "HTX_XTQ"],
    costCenterCodes: ["VP_DP", "TQ_DP", "VP_HTX", "TQ_HTX"],
    planTokens: ["Váº­n táº£i Taxi"],
  },
  {
    user_id: "6789",
    companyCodes: ["TC", "XVP"],
    costCenterCodes: ["CP_SR", "HL_SR", "LB_SR", "OCP_SR", "SMC_SR"],
    planTokens: ["SR"],
  },
];

export const FALLBACK_USER_MAPPINGS: FallbackUserMapping[] =
  RAW_FALLBACK_USER_MAPPINGS.map((mapping) => ({
    ...mapping,
    planTokens: mapping.planTokens.map(repairMojibakeText),
  }));

export const FALLBACK_USER_FILE_PERMISSIONS: FallbackUserFilePermission[] = [
  {
    user_id: "1234",
    canCreate: true,
    canRead: false,
    canUpdate: true,
    canApprove: false,
  },
  {
    user_id: "3456",
    canCreate: false,
    canRead: true,
    canUpdate: false,
    canApprove: true,
  },
  {
    user_id: "4567",
    canCreate: true,
    canRead: false,
    canUpdate: true,
    canApprove: false,
  },
  {
    user_id: "5678",
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canApprove: true,
  },
  {
    user_id: "6789",
    canCreate: false,
    canRead: true,
    canUpdate: false,
    canApprove: false,
  },
];
