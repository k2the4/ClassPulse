export type Role = 'admin' | 'proctor' | 'subject_teacher';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type Profile = { id: string; full_name: string; email: string; role: Role; approval_status: ApprovalStatus };
export type UploadKind = 'attendance' | 'midsem' | 'internal';
export type RowError = { row: number; field: string; message: string };
export type ParsedRow = Record<string, string | number>;
export type Weightages = { assignment_weight: number; presentation_weight: number; attendance_weight: number; midsem_1_weight: number; midsem_2_weight: number };
