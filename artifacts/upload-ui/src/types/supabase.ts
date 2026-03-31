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
  upload_date: string;
  accountant_name: string;
  company_id: string;
  cost_center_code: string;
  bp: string | null;
  file_name: string;
  file_type: string;
  total_rows: number;
  preview_rows: number;
  status: "submitted";
  uploaded_by: number | null;
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
