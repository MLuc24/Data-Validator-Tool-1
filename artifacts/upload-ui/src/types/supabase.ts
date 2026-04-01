export interface UsersApp {
  user_id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  auth_user_id?: string | null;
  cost_center_code?: string | null;
}

export type AppUser = UsersApp;

export interface CostCenter {
  cost_center_id?: string;
  cost_center_name: string;
  company_id: string | number;
  plan_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  cost_center_code?: string;
}

export interface Company {
  company_id: string | number;
  company_name: string;
  created_at: string;
  updated_at: string;
  is_active?: boolean;
}

export interface Plan {
  plan_id: number;
  plan_name: string;
  created_at: string;
  updated_at: string;
  is_active?: boolean;
  parent_name?: string | null;
}

export interface UserDataScope {
  id: number;
  user_id: string;
  company_id: string;
  plan_id: number;
  cost_center_id: string;
  created_at: string;
  updated_at: string;
}

export interface UserPermission {
  user_id: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_approve: boolean;
  created_at: string;
  updated_at: string;
}

export type UploadBatchStatus =
  | "draft"
  | "processing"
  | "completed"
  | "failed"
  | "validated"
  | "submitted";

export interface UploadBatchInsert {
  upload_file_id?: number | null;
  fact_id?: number | null;
  uploaded_by_user_id?: string | null;
  uploaded_by_auth?: string | null;
  file_name: string;
  original_file_name: string;
  note?: string | null;
  total_rows: number;
  success_rows?: number;
  failed_rows?: number;
  status: UploadBatchStatus;
  submitted_at?: string;
  approval_status?: string;
  preview_rows?: number;
  validation_status?: string;
  validation_message?: string | null;
  missing_source_header_count?: number;
  preview_payload?: unknown;
  selected_company_id?: string | null;
  selected_plan_id?: number | null;
  selected_cost_center_id?: string | null;
}

export interface UploadFileInsert {
  fact_id: number;
  file_code: string;
  file_name: string;
  description?: string | null;
  selected_company_id?: string | null;
  selected_plan_id?: number | null;
  selected_cost_center_id?: string | null;
  is_submit_enabled?: boolean;
  missing_source_header_count?: number;
  current_upload_batch_id?: number | null;
  approved_upload_batch_id?: number | null;
  created_by_user_id?: string | null;
  is_locked?: boolean;
}

export interface UploadBatchFactInsert {
  upload_batch_id: number;
  fact_id: number;
  imported_rows: number;
  success_rows?: number;
  failed_rows?: number;
  status: UploadBatchStatus;
}

export interface UploadRowInsert {
  batch_id: string;
  row_number: number;
  file_date?: string | null;
  system_code?: string | null;
  metric_group?: string | null;
  category_name?: string | null;
  subcategory_name?: string | null;
  amount?: number | null;
  attribute_name?: string | null;
  content_text?: string | null;
  company_name_in_file?: string | null;
  data_type?: string | null;
  block_name?: string | null;
  department_name?: string | null;
  raw_json?: Record<string, unknown> | null;
}
