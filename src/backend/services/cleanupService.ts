import * as fs from 'fs';
import * as path from 'path';

/**
 * 文件清理服务
 * 负责管理临时文件和上传文件的清理
 */
export class CleanupService {
  private static tempDir = path.join(process.cwd(), 'temp');
  private static uploadsDir = path.join(process.cwd(), 'uploads');

  /**
   * 服务器启动时清理所有临时文件和上传文件
   */
  static initializeCleanup(): void {
    console.log('🧹 Initializing file cleanup...');
    
    // 清理temp目录
    this.cleanupDirectory(this.tempDir, 'temp');
    
    // 清理uploads目录
    this.cleanupDirectory(this.uploadsDir, 'uploads');
    
    console.log('✅ File cleanup initialization completed');
  }

  /**
   * 清理指定目录中的所有文件
   * @param dirPath 目录路径
   * @param dirName 目录名称（用于日志）
   */
  private static cleanupDirectory(dirPath: string, dirName: string): void {
    try {
      if (!fs.existsSync(dirPath)) {
        console.log(`📁 Creating ${dirName} directory: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
        return;
      }

      const files = fs.readdirSync(dirPath);
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
          try {
            fs.unlinkSync(filePath);
            cleanedCount++;
            console.log(`🗑️  Removed file: ${file}`);
          } catch (error) {
            console.error(`❌ Failed to remove file ${file}:`, error);
          }
        } else if (stats.isDirectory()) {
          // 递归清理子目录
          this.cleanupDirectory(filePath, `${dirName}/${file}`);
          try {
            // 尝试删除空目录
            fs.rmdirSync(filePath);
            console.log(`📂 Removed empty directory: ${file}`);
          } catch (error) {
            // 目录不为空或其他错误，忽略
          }
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned ${cleanedCount} files from ${dirName} directory`);
      } else {
        console.log(`✨ ${dirName} directory is already clean`);
      }
    } catch (error) {
      console.error(`❌ Failed to cleanup ${dirName} directory:`, error);
    }
  }

  /**
   * 删除单个文件
   * @param filePath 文件路径
   * @param description 文件描述（用于日志）
   */
  static deleteFile(filePath: string, description?: string): void {
    if (!filePath || !fs.existsSync(filePath)) {
      return;
    }

    try {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Deleted ${description || 'file'}: ${path.basename(filePath)}`);
    } catch (error) {
      console.error(`❌ Failed to delete ${description || 'file'} ${filePath}:`, error);
    }
  }

  /**
   * 删除多个文件
   * @param filePaths 文件路径数组
   * @param description 文件描述（用于日志）
   */
  static deleteFiles(filePaths: string[], description?: string): void {
    filePaths.forEach(filePath => {
      this.deleteFile(filePath, description);
    });
  }

  /**
   * 安全删除文件（检查文件是否在允许的目录中）
   * @param filePath 文件路径
   * @param description 文件描述
   */
  static safeDeleteFile(filePath: string, description?: string): void {
    if (!filePath) {
      return;
    }

    const normalizedPath = path.normalize(filePath);
    const normalizedTempDir = path.normalize(this.tempDir);
    const normalizedUploadsDir = path.normalize(this.uploadsDir);

    // 检查文件是否在允许的目录中
    if (!normalizedPath.startsWith(normalizedTempDir) && 
        !normalizedPath.startsWith(normalizedUploadsDir)) {
      console.warn(`⚠️  Attempted to delete file outside allowed directories: ${filePath}`);
      return;
    }

    this.deleteFile(filePath, description);
  }

  /**
   * 获取目录统计信息
   * @param dirPath 目录路径
   * @returns 目录统计信息
   */
  static getDirectoryStats(dirPath: string): { fileCount: number; totalSize: number } {
    let fileCount = 0;
    let totalSize = 0;

    try {
      if (!fs.existsSync(dirPath)) {
        return { fileCount: 0, totalSize: 0 };
      }

      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          fileCount++;
          totalSize += stats.size;
        }
      }
    } catch (error) {
      console.error(`Failed to get directory stats for ${dirPath}:`, error);
    }

    return { fileCount, totalSize };
  }

  /**
   * 获取清理服务统计信息
   */
  static getStats(): { temp: any; uploads: any } {
    return {
      temp: this.getDirectoryStats(this.tempDir),
      uploads: this.getDirectoryStats(this.uploadsDir)
    };
  }
}