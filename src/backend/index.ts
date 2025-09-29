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

// 服务器启动时清理临时文件
CleanupService.initializeCleanup();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务（用于临时文件）
app.use('/temp', express.static(path.join(process.cwd(), 'temp')));

// 在生产环境中提供前端静态文件
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(process.cwd(), 'dist')));
}

// API路由
app.use('/api', healthRouter);
app.use('/api/encrypt', encryptRouter);
app.use('/api/decrypt', decryptRouter);
app.use('/api/download', downloadRouter);

// 根路径处理
app.get('/', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(process.cwd(), 'dist/index.html'));
  } else {
    res.redirect('/api/health');
  }
});

// SPA路由处理和404处理
app.use('*', (req, res) => {
  // 如果是API请求，返回404错误
  if (req.originalUrl.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      message: 'API endpoint not found',
      availableEndpoints: {
        health: '/api/health',
        encrypt: 'POST /api/encrypt',
        decrypt: 'POST /api/decrypt',
        download: 'GET /api/download/:downloadId',
        encryptStatus: 'GET /api/encrypt/status',
        decryptStatus: 'GET /api/decrypt/status',
        downloadStats: 'GET /api/download/stats'
      }
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
  console.log(`🚀 MCBEPackCrypt Backend Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Encrypt API: http://localhost:${PORT}/api/encrypt`);
  console.log(`🔓 Decrypt API: http://localhost:${PORT}/api/decrypt`);
  console.log(`📥 Download API: http://localhost:${PORT}/api/download/:id`);
  console.log(`📊 API Documentation available at each endpoint`);
});

export default app;