import JSZip from 'jszip';
import CryptoJS from 'crypto-js';

// Constants matching backend implementation
const KEY_LENGTH = 32; // 32 characters
const VERSION = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
const MAGIC = new Uint8Array([0xFC, 0xB9, 0xCF, 0x9B]);
const EXCLUDED_FILES = ['manifest.json', 'pack_icon.png', 'bug_pack_icon.png'];

// Progress tracking interface
interface ProgressState {
  current: number;
  total: number;
  status: string;
}

// Content entry interface matching backend
interface ContentEntry {
  path: string;
  key: string | null;
}

// Content interface matching backend
interface Content {
  content: ContentEntry[];
}

// Manifest interface matching backend
interface Manifest {
  header: {
    uuid: string;
  };
}

// Encryption result interface
interface EncryptionResult {
  encryptedZip: Blob;
  keyFile: Blob;
}

// Frontend Crypto Service - using crypto-js for AES-256-CFB8
export class FrontendCryptoService {
  private progress: ProgressState = { current: 0, total: 100, status: 'idle' };

  /**
   * Generate random key (32 characters, matching backend)
   */
  private generateRandomKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < KEY_LENGTH; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Encrypt data using AES-256-CFB8 (matching backend exactly)
   */
  private encryptData(data: ArrayBuffer, keyString: string): ArrayBuffer {
    try {
      // Convert ArrayBuffer to WordArray
      const wordArray = CryptoJS.lib.WordArray.create(data);
      
      // Create key from string (first 32 bytes)
      const key = CryptoJS.enc.Utf8.parse(keyString.substring(0, 32));
      
      // Use first 16 bytes of key as IV (matching backend logic)
      const iv = CryptoJS.enc.Utf8.parse(keyString.substring(0, 16));
      
      // Encrypt using AES-256-CFB with 8-bit segments (CFB8)
      const encrypted = CryptoJS.AES.encrypt(wordArray, key, {
        iv: iv,
        mode: CryptoJS.mode.CFB,
        padding: CryptoJS.pad.NoPadding,
        segmentSize: 1 // CFB8 mode (8-bit segments)
      });
      
      // Convert back to ArrayBuffer
      const encryptedWordArray = encrypted.ciphertext;
      const encryptedArray = new Uint8Array(encryptedWordArray.sigBytes);
      
      for (let i = 0; i < encryptedWordArray.sigBytes; i++) {
        encryptedArray[i] = (encryptedWordArray.words[Math.floor(i / 4)] >>> (24 - (i % 4) * 8)) & 0xff;
      }
      
      return encryptedArray.buffer;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt data using AES-256-CFB8 (matching backend exactly)
   */
  private decryptData(encryptedData: ArrayBuffer, keyString: string): ArrayBuffer {
    try {
      // Convert ArrayBuffer to WordArray
      const encryptedArray = new Uint8Array(encryptedData);
      const words: number[] = [];
      
      for (let i = 0; i < encryptedArray.length; i += 4) {
        let word = 0;
        for (let j = 0; j < 4 && i + j < encryptedArray.length; j++) {
          word |= (encryptedArray[i + j] << (24 - j * 8));
        }
        words.push(word);
      }
      
      const encryptedWordArray = CryptoJS.lib.WordArray.create(words, encryptedArray.length);
      
      // Create key from string (first 32 bytes)
      const key = CryptoJS.enc.Utf8.parse(keyString.substring(0, 32));
      
      // Use first 16 bytes of key as IV (matching backend logic)
      const iv = CryptoJS.enc.Utf8.parse(keyString.substring(0, 16));
      
      // Create cipher params
      const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: encryptedWordArray
      });
      
      // Decrypt using AES-256-CFB with 8-bit segments (CFB8)
      const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
        iv: iv,
        mode: CryptoJS.mode.CFB,
        padding: CryptoJS.pad.NoPadding,
        segmentSize: 1 // CFB8 mode (8-bit segments)
      });
      
      // Convert back to ArrayBuffer
      const decryptedArray = new Uint8Array(decrypted.sigBytes);
      
      for (let i = 0; i < decrypted.sigBytes; i++) {
        decryptedArray[i] = (decrypted.words[Math.floor(i / 4)] >>> (24 - (i % 4) * 8)) & 0xff;
      }
      
      return decryptedArray.buffer;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current progress
   */
  getProgress(): ProgressState {
    return { ...this.progress };
  }

  /**
   * Update progress
   */
  private updateProgress(current: number, total: number, status: string): void {
    this.progress = { current, total, status };
  }

  /**
   * Find pack UUID from manifest.json
   */
  private async findPackUUID(zip: JSZip): Promise<string> {
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      throw new Error('manifest.json not found');
    }

    const manifestContent = await manifestFile.async('text');
    const manifest: Manifest = JSON.parse(manifestContent);
    
    if (!manifest.header?.uuid) {
      throw new Error('UUID not found in manifest.json');
    }

    return manifest.header.uuid;
  }

  /**
   * Generate contents.json file (matching backend implementation)
   */
  private async generateContentsJson(
    outputZip: JSZip,
    name: string,
    contentId: string,
    key: string,
    contentEntries: ContentEntry[]
  ): Promise<void> {
    const stream = new Uint8Array(0x100);
    let offset = 0;

    // Write version and magic (matching backend)
    stream.set(VERSION, offset);
    offset += VERSION.length;
    stream.set(MAGIC, offset);
    offset += MAGIC.length;

    // Pad to 0x10
    while (offset < 0x10) {
      stream[offset++] = 0;
    }

    // Write content ID
    const contentIdBytes = new TextEncoder().encode(contentId);
    stream[offset++] = contentIdBytes.length;
    stream.set(contentIdBytes, offset);
    offset += contentIdBytes.length;

    // Pad to 0x100
    while (offset < 0x100) {
      stream[offset++] = 0;
    }

    // Encrypt contents.json content
    const contentJson = JSON.stringify({ content: contentEntries });
    const contentBuffer = new TextEncoder().encode(contentJson);
    const encryptedContent = this.encryptData(contentBuffer.buffer, key);

    // Merge header and encrypted content
    const encryptedContentArray = new Uint8Array(encryptedContent);
    const finalBuffer = new Uint8Array(stream.length + encryptedContentArray.length);
    finalBuffer.set(stream, 0);
    finalBuffer.set(encryptedContentArray, stream.length);

    outputZip.file(name, finalBuffer);
    console.log('Successfully created contents.json');
  }

  /**
   * Decrypt contents.json file (matching backend implementation)
   */
  private async decryptContentsJson(zip: JSZip, fileName: string, key: string): Promise<Content> {
    console.log(`Starting decryption of ${fileName}, key length: ${key.length}`);
    
    const zipEntry = zip.file(fileName);
    if (!zipEntry) {
      throw new Error(`Cannot find ${fileName}, it seems that this file is not encrypted`);
    }

    const data = await zipEntry.async('arraybuffer');
    return this.decryptContentsJsonData(data, fileName, key);
  }

  /**
   * Decrypt contents.json data (matching backend implementation)
   */
  private async decryptContentsJsonData(data: ArrayBuffer, fileName: string, key: string): Promise<Content> {
    const dataArray = new Uint8Array(data);
    
    if (dataArray.length < 0x100) {
      throw new Error(`Invalid ${fileName} format: file too small`);
    }

    // Verify version and magic
    const version = dataArray.slice(0, 4);
    const magic = dataArray.slice(4, 8);
    
    if (!this.arraysEqual(version, VERSION) || !this.arraysEqual(magic, MAGIC)) {
      throw new Error(`Invalid ${fileName} format: wrong version or magic`);
    }

    // Extract encrypted content
    const encryptedContent = dataArray.slice(0x100);
    
    // Decrypt content
    const decryptedBuffer = this.decryptData(encryptedContent.buffer, key);

    // Parse JSON
    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    
    try {
      return JSON.parse(decryptedText) as Content;
    } catch (error) {
      throw new Error(`Invalid JSON in decrypted ${fileName}`);
    }
  }

  /**
   * Compare two Uint8Arrays for equality
   */
  private arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /**
   * Encrypt ZIP file - complete implementation matching backend
   */
  async encryptZipFile(file: File, key?: string): Promise<EncryptionResult> {
    try {
      this.updateProgress(0, 100, 'starting');
      
      // Generate key if not provided
      const encryptionKey = key || this.generateRandomKey();
      if (encryptionKey.length !== KEY_LENGTH) {
        throw new Error('Invalid key length');
      }

      // Read ZIP file
      this.updateProgress(10, 100, 'reading zip file');
      const zipData = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(zipData);

      // Find pack UUID
      this.updateProgress(15, 100, 'analyzing files');
      const uuid = await this.findPackUUID(zip);
      console.log('ContentId:', uuid);

      const contentEntries: ContentEntry[] = [];
      const outputZip = new JSZip();

      // Separate files and directories
      const fileEntries: Array<{ fileName: string; file: JSZip.JSZipObject }> = [];
      const dirEntries: string[] = [];

      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) {
          dirEntries.push(relativePath);
        } else {
          fileEntries.push({ fileName: relativePath, file: zipEntry });
        }
      });

      this.updateProgress(20, 100, 'processing directories');

      // Process directories
      for (const dirPath of dirEntries) {
        outputZip.folder(dirPath);
      }

      this.updateProgress(30, 100, 'preparing files for encryption');

      // Process files
      let processedFiles = 0;
      const totalFiles = fileEntries.length;

      for (const { fileName, file } of fileEntries) {
        if (EXCLUDED_FILES.includes(fileName)) {
          // Copy excluded files directly
          const data = await file.async('arraybuffer');
          outputZip.file(fileName, data);
          contentEntries.push({ path: fileName, key: null });
          console.log('Excluded file:', fileName, 'copied directly');
        } else {
          // Encrypt files
          const data = await file.async('arraybuffer');
          const entryKey = this.generateRandomKey();
          
          this.updateProgress(
            30 + (processedFiles / totalFiles) * 50, 
            100, 
            `encrypting ${fileName}`
          );
          
          const encryptedData = this.encryptData(data, entryKey);
          outputZip.file(fileName, encryptedData);
          contentEntries.push({ path: fileName, key: entryKey });
          console.log('File:', fileName, 'encrypted successfully');
        }
        
        processedFiles++;
      }

      this.updateProgress(85, 100, 'generating contents.json');

      // Generate contents.json
      await this.generateContentsJson(outputZip, 'contents.json', uuid, encryptionKey, contentEntries);

      this.updateProgress(95, 100, 'finalizing zip');

      // Generate final ZIP file
      const encryptedZipBlob = await outputZip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });

      // Create key file (matching backend format)
      const keyData = {
        key: encryptionKey,
        version: "1.0.0",
        created: new Date().toISOString()
      };
      const keyFileBlob = new Blob([JSON.stringify(keyData, null, 2)], { type: 'application/json' });

      this.updateProgress(100, 100, 'completed');
      console.log('Encryption completed. Key:', encryptionKey);

      return {
        encryptedZip: encryptedZipBlob,
        keyFile: keyFileBlob
      };

    } catch (error) {
      this.updateProgress(0, 100, 'error');
      console.error('Encryption failed:', error);
      throw error;
    }
  }

  /**
   * Decrypt ZIP file - complete implementation matching backend
   */
  async decryptZipFile(
    encryptedFile: File,
    keyFile: File,
    preserveContentsJson: boolean = false
  ): Promise<ArrayBuffer> {
    try {
      this.updateProgress(0, 100, 'starting');

      // Read key file
      const keyText = await keyFile.text();
      let keyData: any;

      try {
        keyData = JSON.parse(keyText);
      } catch {
        throw new Error('Invalid key file format');
      }

      if (!keyData.key) {
        throw new Error('Key not found in key file');
      }

      const key = keyData.key;
      if (key.length !== KEY_LENGTH) {
        throw new Error('Invalid key length');
      }

      // Read ZIP file
      this.updateProgress(10, 100, 'reading zip file');
      const zipData = await encryptedFile.arrayBuffer();
      const zip = await JSZip.loadAsync(zipData);

      this.updateProgress(15, 100, 'decrypting contents.json');

      // Decrypt contents.json
      const content = await this.decryptContentsJson(zip, 'contents.json', key);
      if (!content) {
        throw new Error('Failed to decrypt contents.json');
      }

      const outputZip = new JSZip();

      this.updateProgress(25, 100, 'preparing files for decryption');

      // Process files based on contents.json
      let processedFiles = 0;
      const totalFiles = content.content.length;

      for (const contentEntry of content.content) {
        if (contentEntry.key === null) {
          // Copy excluded files directly
          const zipEntry = zip.file(contentEntry.path);
          if (zipEntry) {
            const data = await zipEntry.async('arraybuffer');
            outputZip.file(contentEntry.path, data);
            console.log('Copying excluded file:', contentEntry.path);
          }
        } else {
          // Decrypt files
          const zipEntry = zip.file(contentEntry.path);
          if (!zipEntry) {
            console.error('Zip entry not exists:', contentEntry.path);
            continue;
          }

          this.updateProgress(
            25 + (processedFiles / totalFiles) * 50,
            100,
            `decrypting ${contentEntry.path}`
          );

          const encryptedData = await zipEntry.async('arraybuffer');
          const decryptedData = this.decryptData(encryptedData, contentEntry.key);
          outputZip.file(contentEntry.path, decryptedData);
          console.log('File:', contentEntry.path, 'decrypted successfully');
        }

        processedFiles++;
      }

      // If preserveContentsJson is true, add contents.json to output
      if (preserveContentsJson && content) {
        console.log('Preserving contents.json file');
        const contentsJsonData = JSON.stringify(content, null, 2);
        outputZip.file('contents.json', contentsJsonData);
      }

      this.updateProgress(95, 100, 'finalizing zip');

      // Generate final ZIP file
      const decryptedData = await outputZip.generateAsync({
        type: 'arraybuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });

      this.updateProgress(100, 100, 'completed');
      console.log('Decryption completed successfully');

      return decryptedData;

    } catch (error) {
      this.updateProgress(0, 100, 'error');
      console.error('Decryption failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.progress = { current: 0, total: 100, status: 'idle' };
  }
}