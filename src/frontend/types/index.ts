// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

// 文件上传相关类型
export interface FileUploadResponse {
  filename: string;
  size: number;
  url: string;
}

// 加密/解密相关类型
export interface EncryptRequest {
  file: File;
}

export interface DecryptRequest {
  encryptedFile: File;
  keyFile: File;
}

export interface ProcessResult {
  success: boolean;
  downloadUrl?: string;
  keyUrl?: string;
  message: string;
}