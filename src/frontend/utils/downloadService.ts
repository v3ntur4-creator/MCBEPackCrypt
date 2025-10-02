// 浏览器下载服务
// 用于在frontend-only模式下下载加密解密结果

/**
 * 下载文件到浏览器
 */
export function downloadFile(blob: Blob, filename: string): void {
  try {
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    // 添加到DOM并触发下载
    document.body.appendChild(link);
    link.click();
    
    // 清理
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download failed:', error);
    throw new Error('File download failed');
  }
}

/**
 * 从ArrayBuffer创建并下载文件
 */
export function downloadArrayBuffer(buffer: ArrayBuffer, filename: string, mimeType: string = 'application/octet-stream'): void {
  const blob = new Blob([buffer], { type: mimeType });
  downloadFile(blob, filename);
}

/**
 * 从Uint8Array创建并下载文件
 */
export function downloadUint8Array(data: Uint8Array, filename: string, mimeType: string = 'application/octet-stream'): void {
  // 创建一个新的ArrayBuffer来确保类型兼容性
  const arrayBuffer = new ArrayBuffer(data.byteLength);
  const view = new Uint8Array(arrayBuffer);
  view.set(data);
  const blob = new Blob([arrayBuffer], { type: mimeType });
  downloadFile(blob, filename);
}

/**
 * 下载文本文件
 */
export function downloadText(text: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([text], { type: mimeType });
  downloadFile(blob, filename);
}

/**
 * 下载JSON文件
 */
export function downloadJSON(data: any, filename: string): void {
  const jsonString = JSON.stringify(data, null, 2);
  downloadText(jsonString, filename, 'application/json');
}

/**
 * 生成安全的文件名
 */
export function sanitizeFilename(filename: string): string {
  // Remove or replace unsafe characters
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')  // Replace Windows disallowed characters
    .replace(/\s+/g, '_')           // Replace spaces
    .replace(/_{2,}/g, '_')         // Merge multiple underscores
    .replace(/^_+|_+$/g, '')       // Remove leading and trailing underscores
    .substring(0, 255);             // Limit length
}

/**
 * 根据文件扩展名获取MIME类型
 */
export function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  
  const mimeTypes: Record<string, string> = {
    'zip': 'application/zip',
    'mcpack': 'application/zip',
    'mcaddon': 'application/zip',
    'mcworld': 'application/zip',
    'mctemplate': 'application/zip',
    'json': 'application/json',
    'txt': 'text/plain',
    'log': 'text/plain',
    'md': 'text/markdown',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'xml': 'application/xml',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'ts': 'application/typescript'
  };
  
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 检查浏览器是否支持下载功能
 */
export function isDownloadSupported(): boolean {
  try {
    // Check if Blob and URL.createObjectURL are supported
    return typeof Blob !== 'undefined' && 
           typeof URL !== 'undefined' && 
           typeof URL.createObjectURL === 'function' &&
           typeof document !== 'undefined' &&
           typeof document.createElement === 'function';
  } catch {
    return false;
  }
}

/**
 * 下载进度回调类型
 */
export interface DownloadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * 带进度的下载服务类
 */
export class ProgressiveDownloadService {
  private static instance: ProgressiveDownloadService;
  
  private constructor() {}
  
  static getInstance(): ProgressiveDownloadService {
    if (!ProgressiveDownloadService.instance) {
      ProgressiveDownloadService.instance = new ProgressiveDownloadService();
    }
    return ProgressiveDownloadService.instance;
  }
  
  /**
   * 准备下载（显示进度）
   */
  async prepareDownload(
    dataProvider: () => Promise<ArrayBuffer>,
    filename: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    try {
      // Start preparing data
      onProgress?.({ loaded: 0, total: 100, percentage: 0 });
      
      // Get data
      const buffer = await dataProvider();
      
      // Update progress
      onProgress?.({ loaded: 50, total: 100, percentage: 50 });
      
      // Create Blob
      const mimeType = getMimeType(filename);
      const blob = new Blob([buffer], { type: mimeType });
      
      // Update progress
      onProgress?.({ loaded: 80, total: 100, percentage: 80 });
      
      // Download file
      downloadFile(blob, sanitizeFilename(filename));
      
      // Complete
      onProgress?.({ loaded: 100, total: 100, percentage: 100 });
      
    } catch (error) {
      console.error('Progressive download failed:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const progressiveDownloadService = ProgressiveDownloadService.getInstance();