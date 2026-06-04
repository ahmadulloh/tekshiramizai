export interface DocumentAnalysisData {
  name_cyrillic: string;
  name_latin: string;
  birth_date: string;
  citizenship: string;
  decision_type: string;
  article: string;
  decision_date: string;
  ban_start: string;
  ban_end: string;
  department: string;
  status: string;
  record_code: string;
  has_deport: boolean;
  summary_uz: string;
}

export interface AnalysisResponse {
  success: boolean;
  data?: DocumentAnalysisData;
  modelUsed?: string;
  warnings?: string[];
  error?: string;
}

export interface HistoryRecord {
  id: string;
  timestamp: string;
  modelUsed: string;
  data: DocumentAnalysisData;
  rawImages: string[]; // thumbnails
}
