import type { Plan } from "@/types/supabase";
import { repairMojibakeText } from "@/lib/text-repair";
import { FALLBACK_TIMESTAMP } from "./constants";

const RAW_FALLBACK_PLANS: Plan[] = [
  {
    plan_id: 1,
    plan_name: "Khá»‘i KD CÃ´ng nghá»‡",
    parent_name: "Khá»‘i Kinh doanh",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    plan_id: 2,
    plan_name: "Khá»‘i KD DV NhÃ  hÃ ng KS",
    parent_name: "Khá»‘i Kinh doanh",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    plan_id: 3,
    plan_name: "Khá»‘i KD Dá»± Ã¡n",
    parent_name: "Khá»‘i Kinh doanh",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    plan_id: 4,
    plan_name: "Khá»‘i KD Tráº¡m sáº¡c Vgreen",
    parent_name: "Khá»‘i Kinh doanh",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    plan_id: 5,
    plan_name: "Khá»‘i KD Vinfast - XDV",
    parent_name: "Khá»‘i Kinh doanh",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    plan_id: 6,
    plan_name: "Khá»‘i KD Váº­n táº£i Taxi",
    parent_name: "Khá»‘i Kinh doanh",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    plan_id: 7,
    plan_name: "Khá»‘i KD Xe táº£i",
    parent_name: "Khá»‘i Kinh doanh",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    plan_id: 8,
    plan_name: "Khá»‘i KD xe Ä‘iá»‡n Vinfast - SR",
    parent_name: "Khá»‘i Kinh doanh",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    plan_id: 9,
    plan_name: "Khá»‘i há»— trá»£ táº­p Ä‘oÃ n",
    parent_name: "Khá»‘i Kinh doanh",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
];

export const FALLBACK_PLANS: Plan[] = RAW_FALLBACK_PLANS.map((plan) => ({
  ...plan,
  plan_name: repairMojibakeText(plan.plan_name),
  parent_name: plan.parent_name ? repairMojibakeText(plan.parent_name) : null,
}));
