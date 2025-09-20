import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as yauzl from 'yauzl';
import * as yazl from 'yazl';
import { promisify } from 'util';
import { getWorkerPool } from './WorkerPool';
import { WorkerTask, WorkerResult } from '../workers/cryptoWorker';
import { EventEmitter } from 'events';

const KEY_LENGTH = 32; // 32个字符
const VERSION = Buffer.from([0x00, 0x00, 0x00, 0x00]);
const MAGIC = Buffer.from([0xFC, 0xB9, 0xCF, 0x9B]);
const EXCLUDED_FILES = ['manifest.json', 'pack_icon.png', 'bug_pack_icon.png'];

interface ContentEntry {
  path: string;
  key: string | null;
}

interface Content {
  content: ContentEntry[];
}

interface Manifest {
  header: {
    uuid: string;
  };
}

export class CryptoService extends EventEmitter {
  private static instance: CryptoService;
  private currentProgress: { current: number; total: number; status: string } = { current: 0, total: 0, status: 'idle' };
  
  constructor() {
    super();
  }
  
  static getInstance(): CryptoService {
    if (!CryptoService.instance) {
      CryptoService.instance = new CryptoService();
    }
    return CryptoService.instance;
  }
  
  getProgress() {
    return this.currentProgress;
  }
  
  private updateProgress(current: number, total: number, status: string) {
    this.currentProgress = { current, total, status };
    this.emit('progress', this.currentProgress);
  }
  /**
   * 生成随机密钥
   */
  static generateRandomKey(): string {
    // 生成32个字符的随机字符串
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < KEY_LENGTH; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  generateRandomKey(): string {
    return CryptoService.generateRandomKey();
  }

  /**
   * 加密资源包
   */
  async encryptPack(inputPath: string, outputPath: string, key: string): Promise<void> {
    this.updateProgress(0, 100, 'starting');
    if (!CryptoService.checkArgs(inputPath, outputPath, key)) {
      throw new Error('Invalid arguments');
    }

    return new Promise((resolve, reject) => {
      yauzl.open(inputPath, { lazyEntries: true }, async (err, zipfile) => {
        if (err) return reject(err);
        
        try {
          await this.encrypt0(zipfile!, outputPath, key);
          this.updateProgress(100, 100, 'completed');
          resolve();
        } catch (error) {
          // 确保ZIP文件被关闭
          if (zipfile) {
            zipfile.close();
            console.log('ZIP文件已关闭');
          }
          this.updateProgress(0, 100, 'error');
          reject(error);
        }
      });
    });
  }

  /**
   * 解密资源包
   */
  async decryptPack(inputPath: string, outputPath: string, key: string | Buffer, preserveContentsJson: boolean = false): Promise<void> {
    console.log('=== CryptoService.decryptPack 开始 ===');
    console.log('输入文件:', inputPath);
    console.log('输出文件:', outputPath);
    console.log('密钥类型:', typeof key);
    console.log('密钥长度:', key.length);
    
    this.updateProgress(0, 100, 'starting');
    if (!CryptoService.checkArgs(inputPath, outputPath, key)) {
      throw new Error('Invalid arguments');
    }

    return new Promise((resolve, reject) => {
      console.log('正在打开ZIP文件...');
      yauzl.open(inputPath, { lazyEntries: true }, async (err, zipfile) => {
        if (err) {
          console.error('打开ZIP文件失败:', err);
          return reject(err);
        }
        
        console.log('ZIP文件打开成功，开始解密...');
        try {
          await this.decrypt0(zipfile!, outputPath, key, preserveContentsJson);
          console.log('=== 解密完成 ===');
          this.updateProgress(100, 100, 'completed');
          resolve();
        } catch (error) {
          console.error('解密过程中出错:', error);
          this.updateProgress(0, 100, 'error');
          reject(error);
        }
      });
    });
  }

  private async encrypt0(zipfile: yauzl.ZipFile, outputPath: string, key: string): Promise<void> {
    console.log('开始加密流程...');
    
    // 首先读取所有ZIP条目
    const entries = await CryptoService.getAllZipEntriesStatic(zipfile);
    console.log(`ZIP文件包含 ${entries.length} 个条目`);
    
    // 查找包UUID
    const uuid = await CryptoService.findPackUUIDFromEntries(entries, zipfile);
    console.log('ContentId:', uuid);
    this.updateProgress(10, 100, 'analyzing files');

    const contentEntries: ContentEntry[] = [];
    const outputZip = new yazl.ZipFile();

    return new Promise((resolve, reject) => {
      const processEntries = async () => {
        try {
          // 分离文件和目录
          const fileEntries = entries.filter(entry => !/\/$/.test(entry.fileName));
          const dirEntries = entries.filter(entry => /\/$/.test(entry.fileName));
          
          this.updateProgress(20, 100, 'processing directories');
          
          // 先处理目录
          for (const entry of dirEntries) {
            outputZip.addEmptyDirectory(entry.fileName);
            if (CryptoService.isSubPackRoot(entry)) {
              await this.encryptSubPack(zipfile, outputZip, entry.fileName, key, uuid, entries);
            }
          }
          
          this.updateProgress(30, 100, 'preparing files for encryption');
          
          // 准备并行加密任务
          const encryptTasks: Array<{entry: yauzl.Entry, data: Buffer, entryKey: string}> = [];
          const workerPool = getWorkerPool();
          
          // 收集需要加密的文件数据
          for (const entry of fileEntries) {
            if (CryptoService.isSubPackFile(entry)) {
              continue; // 子包文件在encryptSubPack中处理
            }
            
            if (EXCLUDED_FILES.includes(entry.fileName)) {
              await this.encryptExcludedFileFromEntry(zipfile, outputZip, entry);
              contentEntries.push({ path: entry.fileName, key: null });
            } else {
              const data = await CryptoService.getZipEntryDataFromEntry(zipfile, entry);
              if (data) {
                const entryKey = CryptoService.generateRandomKey();
                encryptTasks.push({ entry, data, entryKey });
              }
            }
          }
          
          this.updateProgress(40, 100, `encrypting ${encryptTasks.length} files in parallel`);
          console.log(`开始并行加密 ${encryptTasks.length} 个文件...`);
          
          // 创建Worker任务
          const workerTasks: WorkerTask[] = encryptTasks.map(task => ({
            type: 'encrypt' as const,
            data: task.data,
            key: task.entryKey,
            fileName: task.entry.fileName
          }));
          
          // 并行执行加密
          let results: WorkerResult[];
          try {
            results = await workerPool.executeBatch(workerTasks);
          } catch (error) {
            console.warn('Worker pool failed, falling back to synchronous encryption:', error);
            // 回退到同步加密
            results = await this.encryptTasksSynchronously(encryptTasks);
          }
          
          this.updateProgress(70, 100, 'processing encrypted results');
          
          // 处理加密结果
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const task = encryptTasks[i];
            
            if (result.success && result.data) {
              // Worker返回Uint8Array，需要转换为Buffer
              const bufferData = result.data instanceof Uint8Array 
                ? Buffer.from(result.data) 
                : Buffer.isBuffer(result.data) 
                  ? result.data 
                  : Buffer.from(result.data);
              
              outputZip.addBuffer(bufferData, task.entry.fileName);
              contentEntries.push({ path: task.entry.fileName, key: task.entryKey });
              console.log('File:', task.entry.fileName, 'encrypted successfully');
            } else {
              console.error('Failed to encrypt file:', task.entry.fileName, result.error);
              throw new Error(`Failed to encrypt file: ${task.entry.fileName}`);
            }
          }

          this.updateProgress(90, 100, 'generating contents.json');
          
          // 生成contents.json
          await CryptoService.generateContentsJson(outputZip, 'contents.json', uuid, key, contentEntries);
          
          // 写入输出文件
          outputZip.outputStream.pipe(fs.createWriteStream(outputPath))
            .on('close', () => {
              console.log('Encryption finish. Key:', key, 'Output file:', outputPath);
              // 确保ZIP文件被关闭
              if (zipfile) {
                zipfile.close();
                console.log('ZIP文件已关闭');
              }
              resolve();
            })
            .on('error', (error) => {
              // 确保ZIP文件被关闭
              if (zipfile) {
                zipfile.close();
                console.log('ZIP文件已关闭');
              }
              reject(error);
            });
          
          outputZip.end();
        } catch (error) {
          // 确保ZIP文件被关闭
          if (zipfile) {
            zipfile.close();
            console.log('ZIP文件已关闭');
          }
          reject(error);
        }
      };
      
      processEntries();
    });
  }

  private async decrypt0(zipfile: yauzl.ZipFile, outputPath: string, key: string | Buffer, preserveContentsJson: boolean = false): Promise<void> {
    this.updateProgress(10, 100, 'reading all zip entries');
    
    // 一次性读取所有ZIP条目，避免重复读取
    const allEntries = await CryptoService.getAllZipEntriesStatic(zipfile);
    console.log(`一次性读取完成，共 ${allEntries.length} 个ZIP条目`);
    
    this.updateProgress(12, 100, 'decrypting contents.json');
    const keyString = typeof key === 'string' ? key : key.toString('hex');
    let content: Content | null = null;
    try {
      content = await CryptoService.decryptContentsJsonFromEntries(allEntries, zipfile, 'contents.json', keyString);
    } catch (error) {
      console.error('Failed to decrypt contents.json:', error);
      throw error; // 如果无法解密contents.json，解密过程应该失败
    }
    const outputZip = new yazl.ZipFile();

    return new Promise((resolve, reject) => {
      const processDecryption = async () => {
        try {
          this.updateProgress(20, 100, 'preparing files for decryption');
          
          // 准备并行解密任务
          const decryptTasks: Array<{contentEntry: ContentEntry, data: Buffer}> = [];
          const workerPool = getWorkerPool();
          
          // 收集需要解密的文件数据
          if (!content) {
            throw new Error('Contents.json could not be decrypted');
          }
          for (const contentEntry of content.content) {
            if (contentEntry.key === null) {
              continue;
            }

            const entryData = await CryptoService.getZipEntryDataFromEntries(allEntries, zipfile, contentEntry.path);
            if (!entryData) {
              console.error('Zip entry not exists:', contentEntry.path);
              continue;
            }
            
            decryptTasks.push({ contentEntry, data: entryData });
          }
          
          this.updateProgress(30, 100, `decrypting ${decryptTasks.length} files in parallel`);
          console.log(`开始并行解密 ${decryptTasks.length} 个文件...`);
          
          // 创建Worker任务
          const workerTasks: WorkerTask[] = decryptTasks.map(task => ({
            type: 'decrypt' as const,
            data: task.data,
            key: task.contentEntry.key!,
            fileName: task.contentEntry.path
          }));
          
          // 并行执行解密
          let results: WorkerResult[];
          try {
            results = await workerPool.executeBatch(workerTasks);
          } catch (error) {
            console.warn('Worker pool failed, falling back to synchronous decryption:', error);
            // 回退到同步解密
            results = await this.decryptTasksSynchronously(decryptTasks);
          }
          
          this.updateProgress(70, 100, 'processing decrypted results');
          
          // 处理解密结果
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const task = decryptTasks[i];
            
            if (result.success && result.data) {
              // Worker返回Uint8Array，需要转换为Buffer
              const bufferData = result.data instanceof Uint8Array 
                ? Buffer.from(result.data) 
                : Buffer.isBuffer(result.data) 
                  ? result.data 
                  : Buffer.from(result.data);
              
              outputZip.addBuffer(bufferData, task.contentEntry.path);
              console.log('File:', task.contentEntry.path, 'decrypted successfully');
            } else {
              console.error('Failed to decrypt file:', task.contentEntry.path, result.error);
              throw new Error(`Failed to decrypt file: ${task.contentEntry.path}`);
            }
          }

          this.updateProgress(85, 100, 'copying excluded files');
          
          // 复制排除的文件
          for (const excluded of EXCLUDED_FILES) {
            const entryData = await CryptoService.getZipEntryDataFromEntries(allEntries, zipfile, excluded);
            if (entryData) {
              console.log('Copying file:', excluded);
              outputZip.addBuffer(entryData, excluded);
            }
          }
          
          // 如果需要保留contents.json，将解密后的内容写入文件
          console.log('preserveContentsJson:', preserveContentsJson, 'content exists:', !!content);
          if (content) {
            console.log('content structure:', JSON.stringify(content, null, 2));
          }
          if (preserveContentsJson && content) {
            console.log('Preserving contents.json file');
            const contentsJsonData = Buffer.from(JSON.stringify(content, null, 2), 'utf8');
            outputZip.addBuffer(contentsJsonData, 'contents.json');
          }

          // 写入输出文件
          outputZip.outputStream.pipe(fs.createWriteStream(outputPath))
            .on('close', () => {
              console.log('Decrypted file successfully. Output file:', outputPath);
              resolve();
            })
            .on('error', reject);
          
          outputZip.end();
        } catch (error) {
          reject(error);
        }
      };

      processDecryption();
    });
  }

  private async encryptSubPack(zipfile: yauzl.ZipFile, outputZip: yazl.ZipFile, subPackPath: string, key: string, contentId: string, entries: yauzl.Entry[]): Promise<void> {
    console.log('Encrypting sub pack:', subPackPath);
    const subPackContentEntries: ContentEntry[] = [];

    for (const entry of entries) {
      if (/\/$/.test(entry.fileName) || !entry.fileName.startsWith(subPackPath)) {
        continue;
      }

      const entryKey = await CryptoService.encryptFile(zipfile, outputZip, entry);
      console.log('Sub pack file:', entry.fileName, 'entryKey:', entryKey);
      subPackContentEntries.push({ 
        path: entry.fileName.substring(subPackPath.length), 
        key: entryKey 
      });
    }

    await CryptoService.generateContentsJson(outputZip, subPackPath + 'contents.json', contentId, key, subPackContentEntries);
  }

  private async encryptTasksSynchronously(encryptTasks: Array<{entry: yauzl.Entry, data: Buffer, entryKey: string}>): Promise<WorkerResult[]> {
    console.log('使用同步加密处理文件...');
    const results: WorkerResult[] = [];
    
    for (let i = 0; i < encryptTasks.length; i++) {
      const task = encryptTasks[i];
      try {
        // 使用AES-256-CFB8加密文件，使用密钥前16字节作为IV
        const keyBuffer = Buffer.from(task.entryKey, 'utf8');
        const iv = keyBuffer.slice(0, 16); // 使用密钥前16字节作为IV
        const cipher = crypto.createCipheriv('aes-256-cfb8', keyBuffer, iv);
        
        const encryptedData = Buffer.concat([
          cipher.update(task.data),
          cipher.final()
        ]);
        
        results.push({
          success: true,
          data: encryptedData,
          fileName: task.entry.fileName
        });
        
        // 更新进度
        const progress = Math.floor(40 + (i + 1) / encryptTasks.length * 30);
        this.updateProgress(progress, 100, `encrypting file ${i + 1}/${encryptTasks.length}`);
        
        console.log(`同步加密完成: ${task.entry.fileName}`);
      } catch (error) {
        console.error(`同步加密失败: ${task.entry.fileName}`, error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
          fileName: task.entry.fileName
        });
      }
    }
    
    return results;
  }

  private async decryptTasksSynchronously(decryptTasks: Array<{contentEntry: ContentEntry, data: Buffer}>): Promise<WorkerResult[]> {
    console.log('使用同步解密处理文件...');
    const results: WorkerResult[] = [];
    
    for (let i = 0; i < decryptTasks.length; i++) {
      const task = decryptTasks[i];
      try {
        // 使用AES-256-CFB8解密文件，使用密钥前16字节作为IV
        const keyBuffer = Buffer.from(task.contentEntry.key!, 'utf8');
        const iv = keyBuffer.slice(0, 16); // 使用密钥前16字节作为IV
        const decipher = crypto.createDecipheriv('aes-256-cfb8', keyBuffer, iv);
        
        const decryptedData = Buffer.concat([
          decipher.update(task.data),
          decipher.final()
        ]);
        
        results.push({
          success: true,
          data: decryptedData,
          fileName: task.contentEntry.path
        });
        
        // 更新进度
        const progress = Math.floor(30 + (i + 1) / decryptTasks.length * 40);
        this.updateProgress(progress, 100, `decrypting file ${i + 1}/${decryptTasks.length}`);
        
        console.log(`同步解密完成: ${task.contentEntry.path}`);
      } catch (error) {
        console.error(`同步解密失败: ${task.contentEntry.path}`, error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
          fileName: task.contentEntry.path
        });
      }
    }
    
    return results;
  }

  private static async generateContentsJson(outputZip: yazl.ZipFile, name: string, contentId: string, key: string, contentEntries: ContentEntry[]): Promise<void> {
    const stream = Buffer.alloc(0x100);
    let offset = 0;

    // 写入版本和魔数
    VERSION.copy(stream, offset);
    offset += VERSION.length;
    MAGIC.copy(stream, offset);
    offset += MAGIC.length;

    // 填充到0x10
    while (offset < 0x10) {
      stream[offset++] = 0;
    }

    // 写入内容ID
    const contentIdBytes = Buffer.from(contentId, 'utf8');
    stream[offset++] = contentIdBytes.length;
    contentIdBytes.copy(stream, offset);
    offset += contentIdBytes.length;

    // 填充到0x100
    while (offset < 0x100) {
      stream[offset++] = 0;
    }

    // 使用AES-256-CFB8加密contents.json，使用密钥前16字节作为IV
    const keyBuffer = Buffer.from(key, 'utf8');
    const iv = keyBuffer.slice(0, 16); // 使用密钥前16字节作为IV
    const cipher = crypto.createCipheriv('aes-256-cfb8', keyBuffer, iv);
    
    const contentJson = JSON.stringify({ content: contentEntries });
    const encryptedContent = Buffer.concat([
      cipher.update(contentJson, 'utf8'),
      cipher.final()
    ]);

    const finalBuffer = Buffer.concat([stream, encryptedContent]);
    outputZip.addBuffer(finalBuffer, name);
    console.log('Successfully create contents.json');
  }

  private async encryptExcludedFile(zipfile: yauzl.ZipFile, outputZip: yazl.ZipFile, entry: yauzl.Entry): Promise<void> {
    console.log('Excluded file:', entry.fileName, 'copy directly');
    const data = await CryptoService.getZipEntryData(zipfile, entry.fileName);
    if (data) {
      outputZip.addBuffer(data, entry.fileName);
    }
  }

  private async encryptExcludedFileFromEntry(zipfile: yauzl.ZipFile, outputZip: yazl.ZipFile, entry: yauzl.Entry): Promise<void> {
    console.log('Excluded file:', entry.fileName, 'copy directly');
    const data = await CryptoService.getZipEntryDataFromEntry(zipfile, entry);
    if (data) {
      outputZip.addBuffer(data, entry.fileName);
    }
  }

  private static async encryptFile(zipfile: yauzl.ZipFile, outputZip: yazl.ZipFile, entry: yauzl.Entry): Promise<string> {
    const data = await this.getZipEntryData(zipfile, entry.fileName);
    if (!data) {
      throw new Error(`Cannot read entry: ${entry.fileName}`);
    }

    // 生成随机密钥
    const entryKey = this.generateRandomKey();
    
    // 使用AES-256-CFB8加密文件，使用密钥前16字节作为IV
    const keyBuffer = Buffer.from(entryKey, 'utf8');
    const iv = keyBuffer.slice(0, 16); // 使用密钥前16字节作为IV
    const cipher = crypto.createCipheriv('aes-256-cfb8', keyBuffer, iv);
    
    const encryptedData = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);

    outputZip.addBuffer(encryptedData, entry.fileName);
    return entryKey;
  }

  private static decryptFile(data: Buffer, entryKey: string): Buffer {
    if (entryKey.length !== KEY_LENGTH) {
      throw new Error(`Invalid key length (length should be ${KEY_LENGTH}): ${entryKey}`);
    }

    // 使用密钥前16字节作为IV
    const keyBuffer = Buffer.from(entryKey, 'utf8');
    const iv = keyBuffer.slice(0, 16); // 使用密钥前16字节作为IV
    const decipher = crypto.createDecipheriv('aes-256-cfb8', keyBuffer, iv);
    
    return Buffer.concat([
      decipher.update(data),
      decipher.final()
    ]);
  }

  private static async decryptContentsJson(zipfile: yauzl.ZipFile, subPackPath: string, key: string): Promise<Content> {
    console.log(`开始解密 ${subPackPath}，密钥长度: ${key.length}`);
    
    const data = await this.getZipEntryData(zipfile, subPackPath);
    if (!data) {
      throw new Error(`Cannot find ${subPackPath}, it seems that this file is not encrypted`);
    }
    
    return this.decryptContentsJsonData(data, subPackPath, key);
  }

  private static async decryptContentsJsonFromEntries(entries: yauzl.Entry[], zipfile: yauzl.ZipFile, subPackPath: string, key: string): Promise<Content> {
    console.log(`开始解密 ${subPackPath}，密钥长度: ${key.length}`);
    
    const data = await this.getZipEntryDataFromEntries(entries, zipfile, subPackPath);
    if (!data) {
      throw new Error(`Cannot find ${subPackPath}, it seems that this file is not encrypted`);
    }
    
    return this.decryptContentsJsonData(data, subPackPath, key);
  }

  private static decryptContentsJsonData(data: Buffer, subPackPath: string, key: string): Content {
    console.log(`${subPackPath} 文件大小: ${data.length} 字节`);
    
    if (data.length < 0x100 + 32) { // 至少需要头部 + IV + 认证标签
      throw new Error(`${subPackPath} 文件太小，不是有效的加密文件`);
    }

    // 跳过前0x100字节
    const encryptedData = data.slice(0x100);
    console.log(`跳过头部后的数据大小: ${encryptedData.length} 字节`);
    
    // 使用密钥前16字节作为IV
    console.log(`加密数据长度: ${encryptedData.length}`);
    
    try {
      const keyBuffer = Buffer.from(key, 'utf8');
      const iv = keyBuffer.slice(0, 16); // 使用密钥前16字节作为IV
      console.log(`密钥缓冲区长度: ${keyBuffer.length}, IV长度: ${iv.length}`);
      
      const decipher = crypto.createDecipheriv('aes-256-cfb8', keyBuffer, iv);
      
      const decryptedData = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
      ]);
      
      console.log(`解密后数据长度: ${decryptedData.length}`);
      
      const content: Content = JSON.parse(decryptedData.toString('utf8'));
      console.log('Decrypted content json:', content);
      return content;
    } catch (error) {
      console.error(`解密 ${subPackPath} 时出错:`, error);
      if (error instanceof Error) {
        if (error.message.includes('bad decrypt')) {
          throw new Error('密钥错误或文件损坏');
        }
        throw new Error(`解密失败: ${error.message}`);
      }
      throw error;
    }
  }

  private static async getZipEntryData(zipfile: yauzl.ZipFile, fileName: string): Promise<Buffer | null> {
    console.log(`正在读取ZIP条目数据: ${fileName}`);
    
    // 首先获取所有条目
    const entries = await this.getAllZipEntriesStatic(zipfile);
    console.log(`ZIP条目读取完成，共找到 ${entries.length} 个条目`);
    
    const targetEntry = entries.find(e => e.fileName === fileName);
    if (!targetEntry) {
      console.log(`未找到目标文件: ${fileName}`);
      return null;
    }

    console.log(`找到目标文件: ${fileName}，开始读取数据`);
    return new Promise((resolve, reject) => {
      zipfile.openReadStream(targetEntry, (err: Error | null, readStream?: NodeJS.ReadableStream) => {
        if (err) {
          console.error(`读取文件流失败: ${fileName}`, err);
          reject(err);
          return;
        }

        const chunks: Buffer[] = [];
        readStream!.on('data', (chunk: Buffer) => chunks.push(chunk));
        readStream!.on('end', () => {
          console.log(`文件数据读取完成: ${fileName}，大小: ${Buffer.concat(chunks).length} 字节`);
          resolve(Buffer.concat(chunks));
        });
        readStream!.on('error', (error) => {
          console.error(`读取文件数据时出错: ${fileName}`, error);
          reject(error);
        });
      });
    });
  }

  private static async getZipEntryDataFromEntry(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer | null> {
    console.log(`直接从条目读取数据: ${entry.fileName}`);
    return new Promise((resolve, reject) => {
      zipfile.openReadStream(entry, (err: Error | null, readStream?: NodeJS.ReadableStream) => {
        if (err) {
          console.error(`读取文件流失败: ${entry.fileName}`, err);
          reject(err);
          return;
        }

        const chunks: Buffer[] = [];
        readStream!.on('data', (chunk: Buffer) => chunks.push(chunk));
        readStream!.on('end', () => {
          console.log(`文件数据读取完成: ${entry.fileName}，大小: ${Buffer.concat(chunks).length} 字节`);
          resolve(Buffer.concat(chunks));
        });
        readStream!.on('error', (error) => {
          console.error(`读取文件数据时出错: ${entry.fileName}`, error);
          reject(error);
        });
      });
    });
  }

  private static async getZipEntryDataFromEntries(entries: yauzl.Entry[], zipfile: yauzl.ZipFile, fileName: string): Promise<Buffer | null> {
    console.log(`从已读取的条目列表中查找文件: ${fileName}`);
    
    const targetEntry = entries.find(e => e.fileName === fileName);
    if (!targetEntry) {
      console.log(`未找到目标文件: ${fileName}`);
      return null;
    }

    console.log(`找到目标文件: ${fileName}，开始读取数据`);
    return this.getZipEntryDataFromEntry(zipfile, targetEntry);
  }

  private static async getAllZipEntriesStatic(zipfile: yauzl.ZipFile): Promise<yauzl.Entry[]> {
    console.log('开始读取所有ZIP条目...');
    return new Promise((resolve, reject) => {
      const entries: yauzl.Entry[] = [];
      let entryCount = 0;
      let expectedEntryCount = zipfile.entryCount;
      
      console.log(`ZIP文件总共包含 ${expectedEntryCount} 个条目`);
      
      // 添加超时机制
      const timeout = setTimeout(() => {
        console.error('读取ZIP条目超时');
        reject(new Error('读取ZIP条目超时'));
      }, 30000); // 30秒超时
      
      zipfile.on('entry', (entry) => {
        entryCount++;
        console.log(`读取条目 ${entryCount}/${expectedEntryCount}: ${entry.fileName}`);
        entries.push(entry);
        
        // 检查是否已读取完所有条目
        if (entryCount >= expectedEntryCount) {
          clearTimeout(timeout);
          console.log(`成功读取所有 ${entries.length} 个ZIP条目`);
          // 不触发end事件，直接resolve
          resolve(entries);
          return;
        }
        
        // 继续读取下一个条目
        zipfile.readEntry();
      });

      zipfile.on('error', (error) => {
        clearTimeout(timeout);
        console.error('读取ZIP文件时出错:', error);
        reject(error);
      });

      console.log('调用zipfile.readEntry()开始读取...');
      try {
        zipfile.readEntry();
      } catch (error) {
        clearTimeout(timeout);
        console.error('调用readEntry()时出错:', error);
        reject(error);
      }
    });
  }

  private static async findPackUUID(zipfile: yauzl.ZipFile): Promise<string> {
    const manifestData = await this.getZipEntryData(zipfile, 'manifest.json');
    if (!manifestData) {
      throw new Error('manifest file not exists');
    }

    // 清理JSON注释
    let manifestContent = manifestData.toString('utf8');
    // 移除单行注释 //
    manifestContent = manifestContent.replace(/\/\/.*$/gm, '');
    // 移除多行注释 /* */
    manifestContent = manifestContent.replace(/\/\*[\s\S]*?\*\//g, '');
    // 移除空行
    manifestContent = manifestContent.replace(/^\s*\n/gm, '');

    const manifest: Manifest = JSON.parse(manifestContent);
    return manifest.header.uuid;
  }

  private static async findPackUUIDFromEntries(entries: yauzl.Entry[], zipfile: yauzl.ZipFile): Promise<string> {
    console.log('从条目列表中查找manifest.json...');
    const manifestEntry = entries.find(e => e.fileName === 'manifest.json');
    if (!manifestEntry) {
      throw new Error('manifest file not exists');
    }

    const manifestData = await this.getZipEntryDataFromEntry(zipfile, manifestEntry);
    if (!manifestData) {
      throw new Error('manifest file not exists');
    }

    // 清理JSON注释
    let manifestContent = manifestData.toString('utf8');
    // 移除单行注释 //
    manifestContent = manifestContent.replace(/\/\/.*$/gm, '');
    // 移除多行注释 /* */
    manifestContent = manifestContent.replace(/\/\*[\s\S]*?\*\//g, '');
    // 移除空行
    manifestContent = manifestContent.replace(/^\s*\n/gm, '');
    
    console.log('清理后的manifest内容:', manifestContent.substring(0, 200) + '...');
    
    const manifest: Manifest = JSON.parse(manifestContent);
    console.log('成功解析manifest.json，UUID:', manifest.header.uuid);
    return manifest.header.uuid;
  }

  private static isSubPackFile(entry: yauzl.Entry): boolean {
    return entry.fileName.startsWith('subpacks/');
  }

  private static isSubPackRoot(entry: yauzl.Entry): boolean {
    return /\/$/.test(entry.fileName) &&
           entry.fileName.startsWith('subpacks/') &&
           this.calculateCharCount(entry.fileName, '/') === 2;
  }

  private static checkArgs(inputPath: string, outputPath: string, key: string | Buffer): boolean {
    // 密钥是32字符的字母数字字符串
    const keyLength = typeof key === 'string' ? key.length : key.length;
    if (keyLength !== KEY_LENGTH) {
      console.error(`key length must be ${KEY_LENGTH}`);
      return false;
    }

    if (!fs.existsSync(inputPath)) {
      console.error('Input file does not exist');
      return false;
    }

    if (inputPath === outputPath) {
      console.error('input and output file cannot be the same');
      return false;
    }

    return true;
  }

  private static calculateCharCount(str: string, target: string): number {
    return str.split(target).length - 1;
  }
}