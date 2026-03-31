export interface AppUser {
  id: number;
  full_name: string;
  email: string | null;
  is_active: boolean;
}

export interface UserMapping {
  id: number;
  user_id: number;
  company_id: string;
  plan_id: number;
  cost_center_id: string;
}

export interface CostCenter {
  cost_center_id: string;
  cost_center_name: string;
  company_id: string;
  plan_id: number;
}

export interface Company {
  company_id: string;
  company_name: string;
}

export interface Plan {
  plan_id: number;
  plan_name: string;
}

export interface UploadBatchInsert {
  uploaded_by: number;
  file_name: string;
  original_file_name?: string | null;
  note?: string | null;
  total_rows: number;
  success_rows: number;
  failed_rows: number;
  status: string;
}

export interface UploadRowInsert {
  batch_id: number;
  row_no: number;
  ngay: string | null;
  ma_he_thong: number | null;
  nhom_chi_tieu: string | null;
  khoan_muc: string | null;
  tieu_muc: string | null;
  thuoc_tinh: string | null;
  noi_dung: string | null;
  cong_ty: string | null;
  loai_du_lieu: string | null;
  khoi: string | null;
  bo_phan: string | null;
  so_tien: number | null;
  company_id: string | null;
  plan_id: number | null;
  cost_center_id: string | null;
  created_by: number;
  is_valid: boolean;
  error_message: string | null;
}
