import { Router } from 'express';
import { DownloadController } from '../controllers/downloadController';

const router = Router();

/**
 * GET /api/download/:downloadId
 * 下载文件
 * 
 * 参数：
 * - downloadId: 下载链接ID
 * 
 * 响应：
 * - 成功：返回文件流（application/zip）
 * - 失败：JSON错误信息
 * 
 * 注意：
 * - 下载链接有效期为5min
 * - 每个链接只能使用一次
 * - 下载后文件会被自动删除
 */
router.get('/:downloadId', DownloadController.downloadFile);

/**
 * GET /api/download/stats
 * 获取下载服务统计信息
 * 
 * 响应：
 * {
 *   "success": true,
 *   "data": {
 *     "service": "MCBEPackCrypt - Download Service",
 *     "status": "running",
 *     "statistics": {
 *       "total": 0,
 *       "active": 0,
 *       "expired": 0
 *     },
 *     "info": {
 *       "linkExpiration": "5分钟",
 *       "oneTimeUse": true,
 *       "autoCleanup": true
 *     }
 *   }
 * }
 */
router.get('/stats', DownloadController.getDownloadStats);

export default router;