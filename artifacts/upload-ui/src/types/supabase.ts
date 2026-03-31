export interface CostCenterDetail {
  cost_center_code: string;
  cost_center_name: string;
  company_id: number;
  company_name: string;
  plan_id: number;
  plan_name: string;
  parent_name: string | null;
  is_active: boolean;
}

export interface AppUser {
  user_id: string;
  full_name: string;
  email: string | null;
  cost_center_code: string | null;
  is_active: boolean;
}

export interface UploadBatchInsert {
  upload_date: string;
  accountant_name: string;
  company_id: number;
  cost_center_code: string;
  bp: string | null;
  file_name: string;
  file_type: string;
  total_rows: number;
  preview_rows: number;
  status: "submitted";
  uploaded_by: string | null;
  note: string | null;
}

export interface UploadRowInsert {
  batch_id: string;
  row_number: number;
  file_date: string | null;
  system_code: string | null;
  metric_group: string | null;
  category_name: string | null;
  subcategory_name: string | null;
  amount: number | null;
  attribute_name: string | null;
  content_text: string | null;
  company_name_in_file: string | null;
  data_type: string | null;
  block_name: string | null;
  department_name: string | null;
  raw_json: Record<string, unknown> | null;
}

export interface KhoiOption {
  plan_id: number;
  plan_name: string;
}

export interface CompanyOption {
  company_id: number;
  company_name: string;
}
