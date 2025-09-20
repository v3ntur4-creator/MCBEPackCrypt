import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { encryptStream, decryptStream } from '../services/StreamCrypto';
import { Readable, Writable } from 'stream';

interface WorkerTask {
  type: 'encrypt' | 'decrypt';
  data: Buffer;
  key: string;
  fileName: string;
}

interface WorkerResult {
  success: boolean;
  data?: Uint8Array; // 使用Uint8Array确保Worker线程通信兼容性
  error?: string;
  fileName: string;
}

if (!isMainThread && parentPort) {
  parentPort.on('message', async (task: WorkerTask) => {
    try {
      // 确保输入数据是Buffer类型
      const inputData = Buffer.isBuffer(task.data) ? task.data : Buffer.from(task.data);
      
      let result: Buffer;
      
      if (task.type === 'encrypt') {
        result = await encryptData(inputData, task.key);
      } else {
        result = await decryptData(inputData, task.key);
      }
      
      // 确保返回的数据能正确传输：将Buffer转换为Uint8Array
      // Worker线程通信会序列化数据，Buffer可能会丢失类型信息
      const response: WorkerResult = {
        success: true,
        data: new Uint8Array(result), // 使用Uint8Array确保数据正确传输
        fileName: task.fileName
      };
      
      parentPort!.postMessage(response);
    } catch (error) {
      const response: WorkerResult = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        fileName: task.fileName
      };
      
      parentPort!.postMessage(response);
    }
  });
}

async function encryptData(data: Buffer, entryKey: string): Promise<Buffer> {
  // 对于小文件（<1MB），使用直接加密
  if (data.length < 1024 * 1024) {
    const keyBuffer = Buffer.from(entryKey, 'utf8');
    const iv = keyBuffer.slice(0, 16); // 使用密钥前16字节作为IV
    const cipher = crypto.createCipheriv('aes-256-cfb8', keyBuffer, iv);
    
    const encryptedData = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    return encryptedData;
  }
  
  // 对于大文件，使用流式处理
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const inputStream = Readable.from([data]);
    const outputStream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      }
    });
    
    outputStream.on('finish', () => {
      resolve(Buffer.concat(chunks));
    });
    
    outputStream.on('error', reject);
    
    encryptStream(inputStream, outputStream, entryKey).catch(reject);
  });
}

async function decryptData(data: Buffer, entryKey: string): Promise<Buffer> {
  // 对于小文件（<1MB），使用直接解密
  if (data.length < 1024 * 1024) {
    const keyBuffer = Buffer.from(entryKey, 'utf8');
    const iv = keyBuffer.slice(0, 16); // 使用密钥前16字节作为IV
    const decipher = crypto.createDecipheriv('aes-256-cfb8', keyBuffer, iv);
    
    return Buffer.concat([
      decipher.update(data),
      decipher.final()
    ]);
  }
  
  // 对于大文件，使用流式处理
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const inputStream = Readable.from([data]);
    const outputStream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      }
    });
    
    outputStream.on('finish', () => {
      resolve(Buffer.concat(chunks));
    });
    
    outputStream.on('error', reject);
    
    decryptStream(inputStream, outputStream, entryKey).catch(reject);
  });
}

export type { WorkerTask, WorkerResult };