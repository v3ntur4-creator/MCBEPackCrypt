// 加密服务适配器
// 根据部署模式选择使用后端API或客户端加密

import { deploymentModeDetector } from '../utils/deploymentMode';
import { FrontendCryptoService } from '../utils/cryptoService';
import { downloadArrayBuffer, sanitizeFilename } from '../utils/downloadService';

export interface CryptoProgress {
  current: number;
  total: number;
  status: string;
}

export interface CryptoResult {
  data: {
    downloadUrl?: string;
    files: {
      encrypted?: string;
      key?: string;
      decrypted?: string;
    };
    expiresIn?: string;
  };
}

export interface ProgressCallback {
  (progress: CryptoProgress): void;
}

/**
 * 加密服务适配器类
 */
class CryptoServiceAdapter {
  private static instance: CryptoServiceAdapter;
  
  private constructor() {}
  
  static getInstance(): CryptoServiceAdapter {
    if (!CryptoServiceAdapter.instance) {
      CryptoServiceAdapter.instance = new CryptoServiceAdapter();
    }
    return CryptoServiceAdapter.instance;
  }

  /**
   * 加密文件
   */
  async encryptFile(
    file: File,
    onProgress?: ProgressCallback
  ): Promise<CryptoResult> {
    const isFrontendOnly = await deploymentModeDetector.isFrontendOnlyMode();
    
    if (isFrontendOnly) {
      return this.encryptFileClientSide(file, onProgress);
    } else {
      return this.encryptFileServerSide(file, onProgress);
    }
  }

  /**
   * 解密文件
   */
  async decryptFile(
    encryptedFile: File,
    keyFile: File,
    preserveContentsJson: boolean = false,
    onProgress?: ProgressCallback
  ): Promise<CryptoResult> {
    const isFrontendOnly = await deploymentModeDetector.isFrontendOnlyMode();
    
    if (isFrontendOnly) {
      return this.decryptFileClientSide(encryptedFile, keyFile, preserveContentsJson, onProgress);
    } else {
      return this.decryptFileServerSide(encryptedFile, keyFile, preserveContentsJson, onProgress);
    }
  }

  /**
   * 客户端加密
   */
  private async encryptFileClientSide(
    file: File,
    onProgress?: ProgressCallback
  ): Promise<CryptoResult> {
    try {
      onProgress?.({ current: 0, total: 100, status: 'starting' });

      // Use frontend encryption service
      const frontendCryptoService = new FrontendCryptoService();
      
      // Monitor progress
      const progressInterval = setInterval(() => {
        const progress = frontendCryptoService.getProgress();
        onProgress?.({
          current: progress.current,
          total: progress.total,
          status: progress.status
        });
      }, 100);

      const result = await frontendCryptoService.encryptZipFile(file);

      clearInterval(progressInterval);
      onProgress?.({ current: 90, total: 100, status: 'preparing_download' });

      // 创建与后端一致的打包下载方式
      // 将加密文件和密钥文件打包成一个ZIP文件
      const JSZip = (await import('jszip')).default;
      const downloadZip = new JSZip();
      
      // 生成文件名
      const originalName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      const encryptedFileName = 'output.zip';
      const keyFileName = 'output.zip.key';
      
      // 将加密文件和密钥文件添加到下载包中
      downloadZip.file(encryptedFileName, result.encryptedZip);
      downloadZip.file(keyFileName, result.keyFile);

      // 生成最终的下载包
      const finalZipBlob = await downloadZip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });

      // 下载打包文件（与后端行为一致）
      const downloadUrl = URL.createObjectURL(finalZipBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = `${originalName}_encrypted_package.zip`;
      downloadLink.click();
      URL.revokeObjectURL(downloadUrl);

      // Cleanup
      frontendCryptoService.destroy();

      onProgress?.({ current: 100, total: 100, status: 'completed' });

      return {
        data: {
          files: {
            encrypted: encryptedFileName,
            key: keyFileName
          },
          expiresIn: 'Immediate download'
        }
      };
    } catch (error) {
      console.error('Client-side encryption failed:', error);
      onProgress?.({ current: 0, total: 100, status: 'error' });
      throw error;
    }
  }

  /**
   * 客户端解密
   */
  private async decryptFileClientSide(
    encryptedFile: File,
    keyFile: File,
    preserveContentsJson: boolean,
    onProgress?: ProgressCallback
  ): Promise<CryptoResult> {
    try {
      onProgress?.({ current: 0, total: 100, status: 'starting' });

      // 使用前端解密服务
      const frontendCryptoService = new FrontendCryptoService();
      
      // Monitor progress
      const progressInterval = setInterval(() => {
        const progress = frontendCryptoService.getProgress();
        onProgress?.({
          current: progress.current,
          total: progress.total,
          status: progress.status
        });
      }, 100);

      const result = await frontendCryptoService.decryptZipFile(
        encryptedFile,
        keyFile,
        preserveContentsJson
      );

      clearInterval(progressInterval);
      onProgress?.({ current: 90, total: 100, status: 'preparing_download' });

      // 生成文件名
      const originalName = encryptedFile.name.replace(/_encrypted\.zip$/, '') || 'decrypted';
      const decryptedFileName = `${originalName}_decrypted.zip`;

      // 下载解密文件
      downloadArrayBuffer(result, decryptedFileName, 'application/zip');

      onProgress?.({ current: 100, total: 100, status: 'completed' });

      return {
        data: {
          files: {
            decrypted: decryptedFileName
          },
          expiresIn: 'Immediate download'
        }
      };
    } catch (error) {
      console.error('Client-side decryption failed:', error);
      onProgress?.({ current: 0, total: 100, status: 'error' });
      throw error;
    }
  }

  /**
   * 服务器端加密
   */
  private async encryptFileServerSide(
    file: File,
    onProgress?: ProgressCallback
  ): Promise<CryptoResult> {
    try {
      onProgress?.({ current: 0, total: 100, status: 'starting' });

      // 开始轮询进度
      const progressPoller = this.startProgressPolling('encrypt', onProgress);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/encrypt', {
        method: 'POST',
        body: formData,
      });

      // 停止轮询
      clearInterval(progressPoller);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '加密失败');
      }

      const result = await response.json();
      onProgress?.({ current: 100, total: 100, status: 'completed' });

      return result;
    } catch (error) {
      onProgress?.({ current: 0, total: 100, status: 'error' });
      throw error;
    }
  }

  /**
   * 服务器端解密
   */
  private async decryptFileServerSide(
    encryptedFile: File,
    keyFile: File,
    preserveContentsJson: boolean,
    onProgress?: ProgressCallback
  ): Promise<CryptoResult> {
    try {
      onProgress?.({ current: 0, total: 100, status: 'starting' });

      // 开始轮询进度
      const progressPoller = this.startProgressPolling('decrypt', onProgress);

      const formData = new FormData();
      formData.append('encryptedFile', encryptedFile);
      formData.append('keyFile', keyFile);
      
      if (preserveContentsJson) {
        formData.append('preserveContentsJson', 'true');
      }

      const response = await fetch('/api/decrypt', {
        method: 'POST',
        body: formData,
      });

      // 停止轮询
      clearInterval(progressPoller);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '解密失败');
      }

      const result = await response.json();
      onProgress?.({ current: 100, total: 100, status: 'completed' });

      return result;
    } catch (error) {
      onProgress?.({ current: 0, total: 100, status: 'error' });
      throw error;
    }
  }

  /**
   * 开始进度轮询（仅用于服务器端）
   */
  private startProgressPolling(
    type: 'encrypt' | 'decrypt',
    onProgress?: ProgressCallback
  ): NodeJS.Timeout {
    const url = type === 'encrypt' ? '/api/encrypt/progress' : '/api/decrypt/progress';
    
    const poller = setInterval(async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const progress = await response.json();
          onProgress?.(progress);
          
          // 如果完成或出错，停止轮询
          if (progress.status === 'completed' || progress.status === 'error' || progress.status === 'idle') {
            clearInterval(poller);
          }
        }
      } catch (error) {
        console.error('Failed to get progress:', error);
      }
    }, 1000);

    return poller;
  }

  /**
   * 获取当前部署模式信息
   */
  async getDeploymentInfo() {
    return await deploymentModeDetector.detectDeploymentMode();
  }

  /**
   * 获取部署模式描述
   */
  async getModeDescription() {
    return await deploymentModeDetector.getModeDescription();
  }

  /**
   * 获取功能描述
   */
  async getFeatureDescription() {
    return await deploymentModeDetector.getFeatureDescription();
  }
}

// 导出单例实例
export const cryptoServiceAdapter = CryptoServiceAdapter.getInstance();