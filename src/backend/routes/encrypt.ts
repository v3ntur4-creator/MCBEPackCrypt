import { Router } from 'express';
import { EncryptController } from '../controllers/encryptController';
import { uploadSingle } from '../middleware/upload';

const router = Router();

/**
 * POST /api/encrypt
 * 加密资源包
 * 
 * 请求体：FormData
 * - file: 资源包文件 (.zip, .zjp, .mcpack)
 * 
 * 响应：
 * {
 *   "success": true,
 *   "message": "资源包加密成功",
 *   "data": {
 *     "downloadId": "uuid",
 *     "downloadUrl": "/api/download/uuid",
 *     "expiresIn": "5分钟",
 *     "files": {
 *       "encrypted": "output.zip",
 *       "key": "output.key"
 *     }
 *   }
 * }
 */
router.post('/', (req, res, next) => {
  uploadSingle(req, res, (err: any) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || '文件上传失败'
      });
    }
    next();
  });
}, EncryptController.encryptPack);

/**
 * GET /api/encrypt/status
 * 获取加密服务状态
 * 
 * 响应：
 * {
 *   "success": true,
 *   "data": {
 *     "service": "MCBEPackCrypt - Encryption Service",
 *     "status": "running",
 *     "downloadLinks": { "total": 0, "active": 0, "expired": 0 },
 *     "supportedFormats": [".zip", ".zjp", ".mcpack"],
 *     "maxFileSize": "100MB",
 *     "keyLength": 32
 *   }
 * }
 */
router.get('/status', EncryptController.getEncryptStatus);

/**
 * GET /api/encrypt/progress
 * 获取加密进度
 * 
 * 响应：
 * {
 *   "success": true,
 *   "data": {
 *     "progress": 50,
 *     "status": "processing",
 *     "message": "正在加密文件..."
 *   }
 * }
 */
router.get('/progress', EncryptController.getEncryptProgress);

export default router;