import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import * as path from 'path';

// 导入路由
import healthRouter from './routes/health';
import encryptRouter from './routes/encrypt';
import decryptRouter from './routes/decrypt';
import downloadRouter from './routes/download';

// 导入清理服务
import { CleanupService } from './services/cleanupService';

// 加载环境变量
config();

// 获取部署模式
const DEPLOYMENT_MODE = process.env.DEPLOYMENT_MODE || 'fullstack';
const IS_FRONTEND_ONLY = DEPLOYMENT_MODE === 'frontend-only';

console.log(`🚀 Starting MCBEPackCrypt in ${DEPLOYMENT_MODE} mode`);

// 服务器启动时清理临时文件（仅在全栈模式下）
if (!IS_FRONTEND_ONLY) {
  CleanupService.initializeCleanup();
}

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务（用于临时文件，仅在全栈模式下）
if (!IS_FRONTEND_ONLY) {
  app.use('/temp', express.static(path.join(process.cwd(), 'temp')));
}

// 在生产环境中提供前端静态文件
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(process.cwd(), 'dist')));
}

// API路由（根据部署模式条件加载）
app.use('/api', healthRouter);

if (!IS_FRONTEND_ONLY) {
  // 仅在全栈模式下启用加解密API
  app.use('/api/encrypt', encryptRouter);
  app.use('/api/decrypt', decryptRouter);
  app.use('/api/download', downloadRouter);
} else {
  // 在纯前端模式下，为加解密API返回不支持的响应
  app.use('/api/encrypt', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Encryption API is not available in frontend-only mode. Please use client-side encryption.',
      mode: 'frontend-only'
    });
  });
  
  app.use('/api/decrypt', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Decryption API is not available in frontend-only mode. Please use client-side decryption.',
      mode: 'frontend-only'
    });
  });
  
  app.use('/api/download', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Download API is not available in frontend-only mode.',
      mode: 'frontend-only'
    });
  });
}

// 根路径处理
app.get('/', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(process.cwd(), 'dist/index.html'));
  } else {
    
    res.json({
      message: 'MCBEPackCrypt Backend API Server',
      mode: DEPLOYMENT_MODE,
      frontend: process.env.FRONTEND_URL || 'http://localhost:3000',
      health: '/api/health',
      documentation: 'Visit /api/health for service status and available endpoints'
    });
  }
});

// SPA路由处理和404处理
app.use('*', (req, res) => {
  // 如果是API请求，返回404错误
  if (req.originalUrl.startsWith('/api/')) {
    const availableEndpoints: any = {
      health: '/api/health'
    };
    
    // 根据部署模式显示可用的端点
    if (!IS_FRONTEND_ONLY) {
      availableEndpoints.encrypt = 'POST /api/encrypt';
      availableEndpoints.decrypt = 'POST /api/decrypt';
      availableEndpoints.download = 'GET /api/download/:downloadId';
      availableEndpoints.encryptStatus = 'GET /api/encrypt/status';
      availableEndpoints.decryptStatus = 'GET /api/decrypt/status';
      availableEndpoints.downloadStats = 'GET /api/download/stats';
    }
    
    res.status(404).json({
      success: false,
      message: 'API endpoint not found',
      mode: DEPLOYMENT_MODE,
      availableEndpoints
    });
  } else if (process.env.NODE_ENV === 'production') {
    // 生产环境中，所有非API请求都返回前端应用
    res.sendFile(path.join(process.cwd(), 'dist/index.html'));
  } else {
    // 开发环境中，返回404
    res.status(404).json({ message: 'Page not found' });
  }
});

// 全局错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 MCBEPackCrypt Server running on http://localhost:${PORT}`);
  console.log(`📋 Mode: ${DEPLOYMENT_MODE}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  
  if (!IS_FRONTEND_ONLY) {
    console.log(`🔐 Encrypt API: http://localhost:${PORT}/api/encrypt`);
    console.log(`🔓 Decrypt API: http://localhost:${PORT}/api/decrypt`);
    console.log(`📥 Download API: http://localhost:${PORT}/api/download/:id`);
    console.log(`📊 API Documentation available at each endpoint`);
  } else {
    console.log(`🌐 Frontend-only mode: Crypto operations will be performed client-side`);
    console.log(`⚠️  Backend crypto APIs are disabled in this mode`);
  }
});

export default app;