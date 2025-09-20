import * as crypto from 'crypto';
import { Transform, TransformCallback } from 'stream';
import { pipeline } from 'stream/promises';

interface StreamCryptoOptions {
  key: string;
  operation: 'encrypt' | 'decrypt';
  chunkSize?: number;
}

/**
 * 流式加密/解密转换器
 * 支持大文件的流式处理，避免内存溢出
 */
export class StreamCryptoTransform extends Transform {
  private cipher?: crypto.Cipher;
  private decipher?: crypto.Decipher;
  private iv?: Buffer;
  private authTag?: Buffer;
  private keyBuffer: Buffer;
  private operation: 'encrypt' | 'decrypt';
  private headerProcessed = false;

  constructor(options: StreamCryptoOptions) {
    super({ 
      objectMode: false,
      highWaterMark: options.chunkSize || 64 * 1024 // 64KB chunks
    });
    
    this.operation = options.operation;
    this.keyBuffer = Buffer.from(options.key, 'utf8');
    
    if (this.operation === 'encrypt') {
      this.iv = this.keyBuffer.slice(0, 16); // 使用密钥前16字节作为IV
      this.cipher = crypto.createCipheriv('aes-256-cfb8', this.keyBuffer, this.iv);
    }
  }

  _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
    try {
      if (this.operation === 'encrypt') {
        this.handleEncryptChunk(chunk, callback);
      } else {
        this.handleDecryptChunk(chunk, callback);
      }
    } catch (error) {
      callback(error as Error);
    }
  }

  _flush(callback: TransformCallback): void {
    try {
      if (this.operation === 'encrypt' && this.cipher) {
        // 完成加密
        const final = this.cipher.final();
        
        if (final.length > 0) {
          this.push(final);
        }
      } else if (this.operation === 'decrypt' && this.decipher) {
        // 完成解密
        const final = this.decipher.final();
        if (final.length > 0) {
          this.push(final);
        }
      }
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  private handleEncryptChunk(chunk: Buffer, callback: TransformCallback): void {
    if (!this.cipher || !this.iv) {
      return callback(new Error('Cipher not initialized'));
    }

    // 加密数据（不输出IV）
    const encrypted = this.cipher.update(chunk);
    if (encrypted.length > 0) {
      this.push(encrypted);
    }
    
    callback();
  }

  private handleDecryptChunk(chunk: Buffer, callback: TransformCallback): void {
    if (!this.headerProcessed) {
      // 使用密钥前16字节作为IV
      this.iv = this.keyBuffer.slice(0, 16);
      this.decipher = crypto.createDecipheriv('aes-256-cfb8', this.keyBuffer, this.iv);
      this.headerProcessed = true;
    }

    if (!this.decipher) {
      return callback(new Error('Decipher not initialized'));
    }

    // 直接处理加密数据
    try {
      const decrypted = this.decipher.update(chunk);
      if (decrypted.length > 0) {
        this.push(decrypted);
      }
    } catch (error) {
      return callback(error as Error);
    }
    
    callback();
  }


}

/**
 * 流式加密函数
 */
export async function encryptStream(
  inputStream: NodeJS.ReadableStream,
  outputStream: NodeJS.WritableStream,
  key: string
): Promise<void> {
  const cryptoTransform = new StreamCryptoTransform({
    key,
    operation: 'encrypt',
    chunkSize: 128 * 1024 // 128KB chunks for better performance
  });

  await pipeline(inputStream, cryptoTransform, outputStream);
}

/**
 * 流式解密函数
 */
export async function decryptStream(
  inputStream: NodeJS.ReadableStream,
  outputStream: NodeJS.WritableStream,
  key: string
): Promise<void> {
  const cryptoTransform = new StreamCryptoTransform({
    key,
    operation: 'decrypt',
    chunkSize: 128 * 1024 // 128KB chunks for better performance
  });

  await pipeline(inputStream, cryptoTransform, outputStream);
}

/**
 * 内存优化的文件加密
 */
export async function encryptFileStream(
  inputPath: string,
  outputPath: string,
  key: string
): Promise<void> {
  const fs = require('fs');
  const inputStream = fs.createReadStream(inputPath, { highWaterMark: 128 * 1024 });
  const outputStream = fs.createWriteStream(outputPath);
  
  await encryptStream(inputStream, outputStream, key);
}

/**
 * 内存优化的文件解密
 */
export async function decryptFileStream(
  inputPath: string,
  outputPath: string,
  key: string
): Promise<void> {
  const fs = require('fs');
  const inputStream = fs.createReadStream(inputPath, { highWaterMark: 128 * 1024 });
  const outputStream = fs.createWriteStream(outputPath);
  
  await decryptStream(inputStream, outputStream, key);
}