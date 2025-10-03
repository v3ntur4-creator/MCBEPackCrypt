// 前端加密/解密 Web Worker
// 使用与后端相同的算法：AES-256-CFB8，IV是密钥的前16字节
// 实现流式处理和CPU使用控制

// 为Web Worker环境提供Buffer和process的polyfill
import { Buffer } from 'buffer';
(globalThis as any).Buffer = Buffer;
(globalThis as any).process = {
  env: {},
  nextTick: (fn: Function) => setTimeout(fn, 0),
  browser: true,
  version: '',
  versions: { node: '' }
};

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto-browserify';

// CPU控制配置
const CPU_CONFIG = {
  CHUNK_SIZE: 1024 * 1024, // 1MB块大小，充分利用CPU
  BATCH_SIZE: 10,
  YIELD_INTERVAL: 50, // 每50个块让出控制权
  MAX_CONCURRENT_CHUNKS: Math.max(navigator.hardwareConcurrency || 4, 4), // 使用所有可用核心
  // CPU速率限制配置（用于测试）
  THROTTLE_ENABLED: false, // 是否启用CPU限制
  THROTTLE_DELAY: 400, // 每个块处理后的延迟（毫秒）
  THROTTLE_CHUNK_INTERVAL: 1 // 每处理几个块后进行延迟
};

// 进度报告接口
export interface ProgressReport {
  stage: string;
  percentage: number;
  processedBytes: number;
  totalBytes: number;
}

// 工作消息类型
export interface WorkerMessage {
  type: 'encrypt' | 'decrypt';
  data: {
    fileData: ArrayBuffer;
    keyData?: ArrayBuffer;
    filename: string;
    preserveContentsJson?: boolean;
  };
  id: string;
}

// 响应消息类型
export interface WorkerResponse {
  type: 'progress' | 'success' | 'error';
  id: string;
  taskId: string;
  data?: any;
  error?: string;
  progress?: number;
}

/**
 * CPU友好的延迟函数
 */
function cpuFriendlyDelay(ms: number = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 让出控制权给主线程
 */
function yieldToMainThread(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * 报告进度
 */
function reportProgress(id: string, progress: ProgressReport): void {
  const response: WorkerResponse = {
    type: 'progress',
    id,
    taskId: id,
    data: progress,
    progress: progress.percentage
  };
  self.postMessage(response);
}

/**
 * 生成与后端一致的密钥和UUID
 */
function generateKeyAndUuid(): { key: Buffer; uuid: string } {
  // 生成32字节密钥（AES-256）
  const key = randomBytes(32);
  
  // 生成UUID（简化版本，与后端格式一致）
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  
  return { key, uuid };
}

/**
 * 流式加密数据
 */
async function encryptDataStream(
  data: Uint8Array,
  key: Uint8Array,
  id: string,
  onProgress: (progress: ProgressReport) => void
): Promise<Uint8Array> {
  const totalBytes = data.length;
  let processedBytes = 0;
  const chunks: Uint8Array[] = [];
  
  // 使用密钥前16字节作为IV（与后端一致）
  const iv = key.slice(0, 16);
  const cipher = createCipheriv('aes-256-cfb8', key, iv);
  
  // 分块处理
  for (let offset = 0; offset < totalBytes; offset += CPU_CONFIG.CHUNK_SIZE) {
    const chunkEnd = Math.min(offset + CPU_CONFIG.CHUNK_SIZE, totalBytes);
    const chunk = data.slice(offset, chunkEnd);
    
    // 加密块
    const encryptedChunk = cipher.update(chunk);
    chunks.push(new Uint8Array(encryptedChunk));
    
    processedBytes += chunk.length;
    
    // 报告进度
    onProgress({
      stage: 'encrypting',
      percentage: Math.round((processedBytes / totalBytes) * 100),
      processedBytes,
      totalBytes
    });
    
    // CPU控制：处理一定数量的块后让出控制权
    if ((offset / CPU_CONFIG.CHUNK_SIZE) % CPU_CONFIG.YIELD_INTERVAL === 0) {
      await yieldToMainThread();
    }
    
    // CPU速率限制（用于测试）
    if (CPU_CONFIG.THROTTLE_ENABLED && 
        (offset / CPU_CONFIG.CHUNK_SIZE) % CPU_CONFIG.THROTTLE_CHUNK_INTERVAL === 0) {
      await cpuFriendlyDelay(CPU_CONFIG.THROTTLE_DELAY);
    }
  }
  
  // 完成加密
  const finalChunk = cipher.final();
  if (finalChunk.length > 0) {
    chunks.push(new Uint8Array(finalChunk));
  }
  
  // 合并所有块
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result;
}

/**
 * 流式解密数据
 */
async function decryptDataStream(
  encryptedData: Uint8Array,
  key: Uint8Array,
  id: string,
  onProgress: (progress: ProgressReport) => void
): Promise<Uint8Array> {
  const totalBytes = encryptedData.length;
  let processedBytes = 0;
  const chunks: Uint8Array[] = [];
  
  // 使用密钥前16字节作为IV（与后端一致）
  const iv = key.slice(0, 16);
  const decipher = createDecipheriv('aes-256-cfb8', key, iv);
  
  // 分块处理
  for (let offset = 0; offset < totalBytes; offset += CPU_CONFIG.CHUNK_SIZE) {
    const chunkEnd = Math.min(offset + CPU_CONFIG.CHUNK_SIZE, totalBytes);
    const chunk = encryptedData.slice(offset, chunkEnd);
    
    // 解密块
    const decryptedChunk = decipher.update(chunk);
    chunks.push(new Uint8Array(decryptedChunk));
    
    processedBytes += chunk.length;
    
    // 报告进度
    onProgress({
      stage: 'decrypting',
      percentage: Math.round((processedBytes / totalBytes) * 100),
      processedBytes,
      totalBytes
    });
    
    // CPU控制：处理一定数量的块后让出控制权
    if ((offset / CPU_CONFIG.CHUNK_SIZE) % CPU_CONFIG.YIELD_INTERVAL === 0) {
      await yieldToMainThread();
    }
    
    // CPU速率限制（用于测试）
    if (CPU_CONFIG.THROTTLE_ENABLED && 
        (offset / CPU_CONFIG.CHUNK_SIZE) % CPU_CONFIG.THROTTLE_CHUNK_INTERVAL === 0) {
      await cpuFriendlyDelay(CPU_CONFIG.THROTTLE_DELAY);
    }
  }
  
  // 完成解密
  const finalChunk = decipher.final();
  if (finalChunk.length > 0) {
    chunks.push(new Uint8Array(finalChunk));
  }
  
  // 合并所有块
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result;
}

/**
 * 处理加密请求
 */
async function handleEncrypt(message: WorkerMessage): Promise<void> {
  const { data, id } = message;
  const { fileData, filename, keyData } = data;
  
  try {
    reportProgress(id, {
      stage: 'starting',
      percentage: 0,
      processedBytes: 0,
      totalBytes: fileData.byteLength
    });
    
    // 使用提供的密钥或生成新密钥
    let key: Uint8Array;
    if (keyData) {
      key = new Uint8Array(keyData);
    } else {
      const generated = generateKeyAndUuid();
      key = generated.key;
    }
    
    reportProgress(id, {
      stage: 'preparing_encryption',
      percentage: 5,
      processedBytes: 0,
      totalBytes: fileData.byteLength
    });
    
    // 加密文件数据
    const fileBytes = new Uint8Array(fileData);
    const encryptedData = await encryptDataStream(
      fileBytes,
      key,
      id,
      (progress) => {
        // 调整进度范围到5-90%
        const adjustedProgress = {
          ...progress,
          percentage: 5 + Math.round(progress.percentage * 0.85)
        };
        reportProgress(id, adjustedProgress);
      }
    );
    
    reportProgress(id, {
      stage: 'finalizing',
      percentage: 95,
      processedBytes: fileData.byteLength,
      totalBytes: fileData.byteLength
    });
    
    // 返回结果 - 仅返回加密数据以保持密钥使用的一致性
    // 确保encryptedData有效后再访问.buffer
    if (!encryptedData || !(encryptedData instanceof Uint8Array)) {
      throw new Error('Encryption failed: invalid encrypted data');
    }
    
    const response: WorkerResponse = {
      type: 'success',
      id,
      taskId: id,
      data: encryptedData.buffer
    };
    
    reportProgress(id, {
      stage: 'completed',
      percentage: 100,
      processedBytes: fileData.byteLength,
      totalBytes: fileData.byteLength
    });
    
    self.postMessage(response);
    
  } catch (error) {
    const response: WorkerResponse = {
      type: 'error',
      id,
      taskId: id,
      error: error instanceof Error ? error.message : String(error)
    };
    self.postMessage(response);
  }
}

/**
 * 处理解密请求
 */
async function handleDecrypt(message: WorkerMessage): Promise<void> {
  const { data, id } = message;
  const { fileData, keyData, filename } = data;
  
  if (!keyData) {
    const response: WorkerResponse = {
      type: 'error',
      id,
      taskId: id, // 使用id作为taskId
      error: 'Key data is required for decryption'
    };
    self.postMessage(response);
    return;
  }
  
  try {
    reportProgress(id, {
      stage: 'starting',
      percentage: 0,
      processedBytes: 0,
      totalBytes: fileData.byteLength
    });
    
    const key = new Uint8Array(keyData);
    const encryptedBytes = new Uint8Array(fileData);
    
    reportProgress(id, {
      stage: 'preparing_decryption',
      percentage: 5,
      processedBytes: 0,
      totalBytes: fileData.byteLength
    });
    
    // 解密文件数据
    const decryptedData = await decryptDataStream(
      encryptedBytes,
      key,
      id,
      (progress) => {
        // 调整进度范围到5-90%
        const adjustedProgress = {
          ...progress,
          percentage: 5 + Math.round(progress.percentage * 0.85)
        };
        reportProgress(id, adjustedProgress);
      }
    );
    
    reportProgress(id, {
      stage: 'finalizing',
      percentage: 95,
      processedBytes: fileData.byteLength,
      totalBytes: fileData.byteLength
    });
    
    // 返回结果 - 仅返回解密数据以保持一致性
    // 确保decryptedData有效后再访问.buffer
    if (!decryptedData || !(decryptedData instanceof Uint8Array)) {
      throw new Error('Decryption failed: invalid decrypted data');
    }
    
    const response: WorkerResponse = {
      type: 'success',
      id,
      taskId: id,
      data: decryptedData.buffer
    };
    
    reportProgress(id, {
      stage: 'completed',
      percentage: 100,
      processedBytes: fileData.byteLength,
      totalBytes: fileData.byteLength
    });
    
    self.postMessage(response);
    
  } catch (error) {
    const response: WorkerResponse = {
      type: 'error',
      id,
      taskId: id,
      error: error instanceof Error ? error.message : String(error)
    };
    self.postMessage(response);
  }
}

// 监听主线程消息
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  
  switch (message.type) {
    case 'encrypt':
      await handleEncrypt(message);
      break;
    case 'decrypt':
      await handleDecrypt(message);
      break;
    default:
      const response: WorkerResponse = {
        type: 'error',
        id: message.id,
        taskId: message.id,
        error: `Unknown message type: ${message.type}`
      };
      self.postMessage(response);
  }
};