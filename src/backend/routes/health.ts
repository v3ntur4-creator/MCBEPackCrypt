import { Router } from 'express';
import { CleanupService } from '../services/cleanupService';
import { DownloadService } from '../services/downloadService';

const router = Router();

// 健康检查路由
router.get('/health', (req, res) => {
  const deploymentMode = process.env.DEPLOYMENT_MODE || 'fullstack';
  const isFrontendOnly = deploymentMode === 'frontend-only';
  
  const response: any = { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'MCBEPackCrypt',
    mode: deploymentMode,
    features: {
      frontend: 'enabled',
      backendCrypto: isFrontendOnly ? 'disabled' : 'enabled',
      clientSideCrypto: isFrontendOnly ? 'enabled' : 'disabled'
    }
  };
  
  // 仅在全栈模式下包含后端统计信息
  if (!isFrontendOnly) {
    const cleanupStats = CleanupService.getStats();
    const downloadStats = DownloadService.getStats();
    
    response.fileSystem = {
      temp: {
        fileCount: cleanupStats.temp.fileCount,
        totalSize: `${(cleanupStats.temp.totalSize / 1024 / 1024).toFixed(2)} MB`
      },
      uploads: {
        fileCount: cleanupStats.uploads.fileCount,
        totalSize: `${(cleanupStats.uploads.totalSize / 1024 / 1024).toFixed(2)} MB`
      }
    };
    
    response.downloads = {
      total: downloadStats.total,
      active: downloadStats.active,
      expired: downloadStats.expired
    };
    
    response.security = {
      autoCleanup: 'enabled',
      startupCleanup: 'enabled',
      intermediateFileCleanup: 'enabled'
    };
  }
  
  res.json(response);
});

export default router;