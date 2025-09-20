import { Request, Response } from 'express';
import * as path from 'path';
import { DownloadService } from '../services/downloadService';

export class DownloadController {
  /**
   * 处理文件下载
   */
  static downloadFile(req: Request, res: Response): void {
    try {
      const { downloadId } = req.params;
      
      if (!downloadId) {
        res.status(400).json({
          success: false,
          message: '缺少下载ID'
        });
        return;
      }

      console.log('Download request for ID:', downloadId);

      // 获取下载文件路径
      const filePath = DownloadService.getDownloadFile(downloadId);
      
      if (!filePath) {
        res.status(404).json({
          success: false,
          message: '下载链接无效、已过期或已被使用'
        });
        return;
      }

      // 设置响应头
      const fileName = path.basename(filePath);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      console.log('Starting file download:', filePath);

      // 发送文件
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error('Download error:', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: '文件下载失败'
            });
          }
        } else {
          console.log('Download completed successfully:', downloadId);
        }
      });

    } catch (error) {
      console.error('Download controller error:', error);
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: '下载过程中发生错误',
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }
  }

  /**
   * 获取下载统计信息
   */
  static getDownloadStats(req: Request, res: Response): void {
    try {
      const stats = DownloadService.getStats();
      
      res.json({
        success: true,
        data: {
          service: 'MCBEPackCrypt - Download Service',
          status: 'running',
          statistics: stats,
          info: {
            linkExpiration: '5min',
            oneTimeUse: true,
            autoCleanup: true
          }
        }
      });
    } catch (error) {
      console.error('Download stats error:', error);
      
      res.status(500).json({
        success: false,
        message: '获取下载统计信息失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }
}