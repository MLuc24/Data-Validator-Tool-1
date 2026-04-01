import type { Company } from "@/types/supabase";
import { repairMojibakeText } from "@/lib/text-repair";
import { FALLBACK_TIMESTAMP } from "./constants";

const RAW_FALLBACK_COMPANIES: Company[] = [
  {
    company_id: 1,
    company_name: "CÃ´ng ty Cá»• pháº§n Thá»‹nh CÆ°á»ng",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    company_id: 2,
    company_name: "CÃ´ng ty CP CÃ´ng nghá»‡ vÃ  dá»‹ch vá»¥ Xanh VÄ©nh PhÃºc",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    company_id: 3,
    company_name: "CÃ´ng ty cá»• pháº§n An Anâ€™s Garden",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    company_id: 4,
    company_name: "CÃ´ng ty Cá»• pháº§n Global AI",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    company_id: 5,
    company_name: "XÃ³a",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    company_id: 6,
    company_name: "Chi nhÃ¡nh Vinfast - CÃ´ng ty Thá»‹nh CÆ°á»ng",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    company_id: 7,
    company_name: "CÃ´ng ty Cá»• pháº§n CÃ´ng Nghá»‡ Vinfast Quáº£ng Ninh",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    company_id: 20,
    company_name: "Thá»‹nh CÆ°á»ng Group",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    company_id: 21,
    company_name: "Há»£p tÃ¡c xÃ£",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    company_id: 22,
    company_name:
      "CÃ´ng ty TNHH xuáº¥t nháº­p kháº©u vÃ  khai thÃ¡c HÆ°ng Thá»‹nh",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    company_id: 23,
    company_name: "Há»£p tÃ¡c xÃ£ váº­n táº£i Xanh VÄ©nh PhÃºc",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
  {
    company_id: 24,
    company_name: "Há»£p tÃ¡c xÃ£ váº­n táº£i Xanh TuyÃªn Quang",
    created_at: FALLBACK_TIMESTAMP,
    updated_at: FALLBACK_TIMESTAMP,
  },
];

export const FALLBACK_COMPANIES: Company[] = RAW_FALLBACK_COMPANIES.map(
  (company) => ({
    ...company,
    company_name: repairMojibakeText(company.company_name),
  }),
);
