// 类型声明文件 for crypto-browserify
declare module 'crypto-browserify' {
  export function createCipheriv(algorithm: string, key: Buffer | Uint8Array, iv: Buffer | Uint8Array): any;
  export function createDecipheriv(algorithm: string, key: Buffer | Uint8Array, iv: Buffer | Uint8Array): any;
  export function randomBytes(size: number): Buffer;
  
  // 其他可能需要的加密函数
  export function createHash(algorithm: string): any;
  export function createHmac(algorithm: string, key: string | Buffer | Uint8Array): any;
  export function pbkdf2Sync(password: string | Buffer, salt: string | Buffer, iterations: number, keylen: number, digest: string): Buffer;
  
  // 常量
  export const constants: {
    [key: string]: any;
  };
}