import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { CryptoService } from '../services/cryptoService';
import { DownloadService } from '../services/downloadService';
import { cleanupFile } from '../middleware/upload';
import { CleanupService } from '../services/cleanupService';

export class EncryptController {
  /**
   * 加密资源包
   */
  static async encryptPack(req: Request, res: Response): Promise<void> {
    let inputFile: string | undefined;
    let outputFile: string | undefined;
    let keyFile: string | undefined;

    try {
      // 检查上传的文件
      if (!req.file) {
        res.status(400).json({ 
          success: false, 
          message: 'Please upload a resource pack file' 
        });
        return;
      }

      inputFile = req.file.path;
      console.log('Processing file:', req.file.originalname, 'at:', inputFile);

      // 生成随机密钥
      const cryptoService = CryptoService.getInstance();
      const encryptionKey = cryptoService.generateRandomKey();
      console.log('Generated encryption key:', encryptionKey);

      // 生成输出文件路径
      const timestamp = Date.now();
      const outputDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      outputFile = path.join(outputDir, `encrypted_${timestamp}.zip`);
      keyFile = path.join(outputDir, `key_${timestamp}.key`);

      // 执行加密
      console.log('Starting encryption...');
      await cryptoService.encryptPack(inputFile, outputFile, encryptionKey);
      console.log('Encryption completed');

      // 创建密钥文件
      fs.writeFileSync(keyFile, encryptionKey, 'utf8');
      console.log('Key file created:', keyFile);

      // 创建下载链接
      const downloadId = await DownloadService.createDownloadLink({
        'output.zip': outputFile,
        'output.zip.key': keyFile
      });

      // 清理输入文件
      cleanupFile(inputFile);
      
      // 立即删除中间文件（加密后的文件和密钥文件）
      // 因为它们已经被打包到下载文件中
      CleanupService.safeDeleteFile(outputFile, 'encrypted output file');
      CleanupService.safeDeleteFile(keyFile, 'key file');
      
      console.log('🔒 Encryption completed and intermediate files cleaned up');

      res.json({
        success: true,
        message: 'Resource pack encrypted successfully',
        data: {
          downloadId,
          downloadUrl: `/api/download/${downloadId}`,
          expiresIn: '5min',
          files: {
            encrypted: 'output.zip',
            key: 'output.zip.key'
          }
        }
      });

    } catch (error) {
      console.error('Encryption error:', error);

      // 清理文件
      if (inputFile) cleanupFile(inputFile);
      if (outputFile) CleanupService.safeDeleteFile(outputFile, 'encrypted output file');
      if (keyFile) CleanupService.safeDeleteFile(keyFile, 'key file');

      res.status(500).json({
        success: false,
        message: 'Error occurred during encryption',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 获取加密状态
   */
  static getEncryptStatus(req: Request, res: Response): void {
    const stats = DownloadService.getStats();
    const cryptoService = CryptoService.getInstance();
    const progress = cryptoService.getProgress();
    
    res.json({
      success: true,
      data: {
        service: 'MCBEPackCrypt - Encryption Service',
        status: 'running',
        downloadLinks: stats,
        supportedFormats: ['.zip', '.zjp', '.mcpack'],
        maxFileSize: '100MB',
        keyLength: 32,
        progress: progress
      }
    });
  }

  /**
   * 获取加密进度
   */
  static getEncryptProgress(req: Request, res: Response): void {
    const cryptoService = CryptoService.getInstance();
    const progress = cryptoService.getProgress();
    res.json(progress);
  }
}