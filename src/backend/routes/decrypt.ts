import { Router } from 'express';
import { DecryptController } from '../controllers/decryptController';
import { uploadDecrypt } from '../middleware/upload';

const router = Router();

/**
 * POST /api/decrypt
 * 解密资源包
 * 
 * 请求体：FormData
 * - encryptedFile: 加密后的资源包文件 (.zip)
 * - keyFile: 密钥文件 (.key)
 * 
 * 响应：
 * {
 *   "success": true,
 *   "message": "资源包解密成功",
 *   "data": {
 *     "downloadId": "uuid",
 *     "downloadUrl": "/api/download/uuid",
 *     "expiresIn": "5分钟",
 *     "files": {
 *       "decrypted": "output.zip"
 *     }
 *   }
 * }
 */
router.post('/', (req, res, next) => {
  uploadDecrypt(req, res, (err: any) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || '文件上传失败'
      });
    }
    next();
  });
}, DecryptController.decryptPack);

/**
 * GET /api/decrypt/status
 * 获取解密服务状态
 * 
 * 响应：
 * {
 *   "success": true,
 *   "data": {
 *     "service": "MCBEPackCrypt - Decryption Service",
 *     "status": "running",
 *     "downloadLinks": { "total": 0, "active": 0, "expired": 0 },
 *     "requiredFiles": {
 *       "encryptedFile": ".zip (加密后的资源包)",
 *       "keyFile": ".key (32字符密钥文件)"
 *     },
 *     "maxFileSize": "100MB"
 *   }
 * }
 */
router.get('/status', DecryptController.getDecryptStatus);
router.get('/progress', DecryptController.getDecryptProgress);

export default router;