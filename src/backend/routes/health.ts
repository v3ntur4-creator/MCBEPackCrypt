import { Router } from 'express';
import { CleanupService } from '../services/cleanupService';
import { DownloadService } from '../services/downloadService';

const router = Router();

// 健康检查路由
router.get('/health', (req, res) => {
  const cleanupStats = CleanupService.getStats();
  const downloadStats = DownloadService.getStats();
  
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'MCBEPackCrypt Backend',
    fileSystem: {
      temp: {
        fileCount: cleanupStats.temp.fileCount,
        totalSize: `${(cleanupStats.temp.totalSize / 1024 / 1024).toFixed(2)} MB`
      },
      uploads: {
        fileCount: cleanupStats.uploads.fileCount,
        totalSize: `${(cleanupStats.uploads.totalSize / 1024 / 1024).toFixed(2)} MB`
      }
    },
    downloads: {
      total: downloadStats.total,
      active: downloadStats.active,
      expired: downloadStats.expired
    },
    security: {
      autoCleanup: 'enabled',
      startupCleanup: 'enabled',
      intermediateFileCleanup: 'enabled'
    }
  });
});

export default router;