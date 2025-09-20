import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';
import { CleanupService } from './cleanupService';

interface DownloadLink {
  id: string;
  filePath: string;
  expiresAt: Date;
  downloaded: boolean;
  createdAt: Date;
}

export class DownloadService {
  private static downloads = new Map<string, DownloadLink>();
  private static tempDir = path.join(process.cwd(), 'temp');

  static {
    // 确保临时目录存在
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // 定期清理过期文件
    setInterval(() => {
      this.cleanupExpiredFiles();
    }, 60000); // 每分钟检查一次
  }

  /**
   * 创建临时下载链接
   * @param files 要打包的文件列表 {fileName: filePath}
   * @returns 下载链接ID
   */
  static async createDownloadLink(files: Record<string, string>): Promise<string> {
    const linkId = uuidv4();
    const zipFileName = `download_${linkId}.zip`;
    const zipFilePath = path.join(this.tempDir, zipFileName);

    // 创建ZIP文件
    await this.createZipFile(files, zipFilePath);

    // 创建下载链接记录
    const downloadLink: DownloadLink = {
      id: linkId,
      filePath: zipFilePath,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5分钟后过期
      downloaded: false,
      createdAt: new Date()
    };

    this.downloads.set(linkId, downloadLink);
    
    console.log(`Created download link: ${linkId}, expires at: ${downloadLink.expiresAt}`);
    return linkId;
  }

  /**
   * 获取下载文件
   * @param linkId 下载链接ID
   * @returns 文件路径或null（如果链接无效/过期/已下载）
   */
  static getDownloadFile(linkId: string): string | null {
    const download = this.downloads.get(linkId);
    
    if (!download) {
      console.log(`Download link not found: ${linkId}`);
      return null;
    }

    if (download.downloaded) {
      console.log(`Download link already used: ${linkId}`);
      this.removeDownloadLink(linkId);
      return null;
    }

    if (new Date() > download.expiresAt) {
      console.log(`Download link expired: ${linkId}`);
      this.removeDownloadLink(linkId);
      return null;
    }

    if (!fs.existsSync(download.filePath)) {
      console.log(`Download file not found: ${download.filePath}`);
      this.removeDownloadLink(linkId);
      return null;
    }

    // 标记为已下载
    download.downloaded = true;
    
    // 延迟删除文件（给客户端时间下载）
    setTimeout(() => {
      this.removeDownloadLink(linkId);
    }, 30000); // 30秒后删除
    
    console.log(`📥 Download file prepared: ${path.basename(download.filePath)}`);

    console.log(`Download started: ${linkId}`);
    return download.filePath;
  }

  /**
   * 创建ZIP文件
   */
  private static async createZipFile(files: Record<string, string>, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // 最高压缩级别
      });

      output.on('close', () => {
        console.log(`ZIP file created: ${outputPath} (${archive.pointer()} bytes)`);
        resolve();
      });

      archive.on('error', (err: Error) => {
        reject(err);
      });

      archive.pipe(output);

      // 添加文件到ZIP
      for (const [fileName, filePath] of Object.entries(files)) {
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: fileName });
        } else {
          console.warn(`File not found, skipping: ${filePath}`);
        }
      }

      archive.finalize();
    });
  }

  /**
   * 移除下载链接并删除文件
   */
  private static removeDownloadLink(linkId: string): void {
    const download = this.downloads.get(linkId);
    if (download) {
      // 使用安全删除方法删除文件
      CleanupService.safeDeleteFile(download.filePath, 'download file');
      
      // 移除记录
      this.downloads.delete(linkId);
      console.log(`🗑️  Removed download link: ${linkId}`);
    }
  }

  /**
   * 清理过期文件
   */
  private static cleanupExpiredFiles(): void {
    const now = new Date();
    const expiredLinks: string[] = [];

    for (const [linkId, download] of this.downloads.entries()) {
      if (now > download.expiresAt || download.downloaded) {
        expiredLinks.push(linkId);
      }
    }

    for (const linkId of expiredLinks) {
      this.removeDownloadLink(linkId);
    }

    if (expiredLinks.length > 0) {
      console.log(`Cleaned up ${expiredLinks.length} expired download links`);
    }
  }

  /**
   * 获取下载链接统计信息
   */
  static getStats(): { total: number; active: number; expired: number } {
    const now = new Date();
    let active = 0;
    let expired = 0;

    for (const download of this.downloads.values()) {
      if (download.downloaded || now > download.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.downloads.size,
      active,
      expired
    };
  }
}