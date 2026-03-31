export interface CostCenter {
  ma: string;
  ten: string;
}

export interface Company {
  maCty: string;
  tenCty: string;
  costCenters: CostCenter[];
}

export interface Khoi {
  id: string;
  ten: string;
  companies: Company[];
}

// Dữ liệu mẫu dựa trên bảng thực tế
// Khi có Supabase sẽ fetch từ DB thay thế
export const KHOI_DATA: Khoi[] = [
  {
    id: "1",
    ten: "Khối KD Công nghệ",
    companies: [
      {
        maCty: "GA",
        tenCty: "Công ty Cổ Phần Global AI",
        costCenters: [{ ma: "GA_ICT", ten: "ICT - GA" }],
      },
    ],
  },
  {
    id: "2",
    ten: "Khối DV Nhà hàng KS",
    companies: [
      {
        maCty: "AAG",
        tenCty: "Công ty CP Phần AN AN'S GARDEN",
        costCenters: [{ ma: "ST_GD", ten: "Garden Sơn Tây" }],
      },
    ],
  },
  {
    id: "3",
    ten: "Khối KD Dự án",
    companies: [
      {
        maCty: "TC",
        tenCty: "Công ty Cổ Phần Thịnh Cường",
        costCenters: [
          { ma: "CB_DA", ten: "Dự án Cao Bằng" },
          { ma: "LS_DA", ten: "Dự án Lang Sơn" },
          { ma: "QS_DA", ten: "Dự án Quang Sơn" },
          { ma: "YB_DA", ten: "Dự án Tân Thịnh" },
          { ma: "TT_DA", ten: "Dự án Yên Bình" },
        ],
      },
    ],
  },
  {
    id: "4",
    ten: "Khối KD Trạm sạc Vgreen",
    companies: [
      {
        maCty: "TC",
        tenCty: "Công ty Cổ Phần Thịnh Cường",
        costCenters: [{ ma: "VG_TS", ten: "Trạm sạc - VG" }],
      },
    ],
  },
  {
    id: "5",
    ten: "Khối KD Vinfast - XDV",
    companies: [
      {
        maCty: "TC",
        tenCty: "Công ty Cổ Phần Thịnh Cường",
        costCenters: [
          { ma: "CP_XDV", ten: "Vinfast Cẩm Phá_XDV" },
          { ma: "HK_XDV", ten: "Vinfast Hà Khánh_XDV" },
          { ma: "HL_XDV", ten: "Vinfast Hạ Long_XDV" },
          { ma: "HCM_XDV", ten: "Vinfast Hồ Chí Minh_XDV" },
          { ma: "LB_XDV", ten: "Vinfast Long Biên_XDV" },
          { ma: "OCP_XDV", ten: "Vinfast Ocean Park_XDV" },
          { ma: "SMC_XDV", ten: "Vinfast Smart City_XDV" },
          { ma: "ST_XDV", ten: "Vinfast Sơn Tây_XDV" },
          { ma: "TQ_XDV", ten: "Vinfast Tuyên Quang_XDV" },
          { ma: "UB_XDV", ten: "Vinfast Uông Bí_XDV" },
          { ma: "VT_XDV", ten: "Vinfast Việt Trì_XDV" },
          { ma: "VP_XDV", ten: "Vinfast Vĩnh Phúc_XDV" },
          { ma: "XM_XDV", ten: "Vinfast Xuân Mai_XDV" },
          { ma: "DT_XDV", ten: "Vinfast Đài Tư_XDV" },
        ],
      },
    ],
  },
  {
    id: "6",
    ten: "Khối KD Vận tải Taxi",
    companies: [
      {
        maCty: "XVP",
        tenCty: "Công ty CP Công nghệ và Dịch vụ Xanh Vĩnh Phúc",
        costCenters: [{ ma: "PT_DP", ten: "Depot Phú Thọ" }],
      },
      {
        maCty: "AAG",
        tenCty: "Công ty CP Phần AN AN'S GARDEN",
        costCenters: [
          { ma: "ST_AT", ten: "Depot Sơn Tây" },
          { ma: "TN_AT", ten: "Depot Thái Nguyên" },
          { ma: "HN_AT", ten: "Depot Hà Nội" },
        ],
      },
    ],
  },
];

// Tài khoản demo (sẽ thay bằng Supabase auth)
export const DEMO_USERS = [
  "Nguyễn Thị Hương",
  "Trần Văn Minh",
  "Lê Thị Thu",
  "Phạm Văn Đức",
  "Hoàng Thị Lan",
  "Vũ Văn Hùng",
  "Đặng Thị Mai",
  "Bùi Văn Tùng",
];
