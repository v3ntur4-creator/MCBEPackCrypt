import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { Request } from 'express';

// 支持的文件扩展名
const ALLOWED_EXTENSIONS = ['.zip', '.zjp', '.mcpack'];
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 存储配置
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    // 生成唯一文件名
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    
    // 如果是.mcpack文件，重命名为.zip
    const finalExt = ext === '.mcpack' ? '.zip' : ext;
    const filename = `${timestamp}-${randomSuffix}${finalExt}`;
    
    cb(null, filename);
  }
});

// 文件过滤器
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件格式。仅支持: ${ALLOWED_EXTENSIONS.join(', ')}`));
  }
};

// 创建multer实例
export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB限制
    files: 1
  }
}).single('file');

// 用于解密的多文件上传（加密文件 + 密钥文件）
export const uploadDecrypt = multer({
  storage: multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
      cb(null, UPLOAD_DIR);
    },
    filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const timestamp = Date.now();
      const randomSuffix = Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `${timestamp}-${randomSuffix}${ext}`;
      cb(null, filename);
    }
  }),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (file.fieldname === 'encryptedFile') {
      // 加密文件必须是.zip
      if (ext === '.zip') {
        cb(null, true);
      } else {
        cb(new Error('加密文件必须是.zip格式'));
      }
    } else if (file.fieldname === 'keyFile') {
      // 密钥文件必须是.key
      if (ext === '.key') {
        cb(null, true);
      } else {
        cb(new Error('密钥文件必须是.key格式'));
      }
    } else {
      cb(new Error('未知的文件字段'));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB限制
    files: 2
  }
}).fields([
  { name: 'encryptedFile', maxCount: 1 },
  { name: 'keyFile', maxCount: 1 }
]);

/**
 * 清理上传的文件
 */
export const cleanupFile = (filePath: string): void => {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up file: ${filePath}`);
    } catch (error) {
      console.error(`Failed to cleanup file: ${filePath}`, error);
    }
  }
};

/**
 * 清理多个文件
 */
export const cleanupFiles = (filePaths: string[]): void => {
  filePaths.forEach(cleanupFile);
};

/**
 * 定期清理旧的上传文件（超过1小时的文件）
 */
setInterval(() => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    files.forEach(file => {
      const filePath = path.join(UPLOAD_DIR, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtime.getTime() > oneHour) {
        cleanupFile(filePath);
      }
    });
  } catch (error) {
    console.error('Failed to cleanup old upload files:', error);
  }
}, 30 * 60 * 1000); // 每30分钟检查一次