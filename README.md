# MCBEPackCrypt

A web-based encryption and decryption utility tool for Minecraft Bedrock Edition resource packs.

## 📖 Project Overview

MCBEPackCrypt is a resource pack encryption and decryption tool specifically designed for Minecraft Bedrock Edition. Through a clean web interface, users can easily encrypt resource packs for protection against unauthorized access and modification.

## ✨ Key Features

- 🔐 **Resource Pack Encryption**: Support for `.zip` and `.mcpack` format resource pack encryption
- 🔓 **Resource Pack Decryption**: Decrypt encrypted resource packs using key files
- 🌐 **Web Interface**: Intuitive and user-friendly modern web user interface
- ⚡ **Real-time Processing**: Fast file upload, processing, and download
- 🔒 **Secure Download**: Temporary download links with 5-minute validity, single-use
- 📦 **Multi-format Support**: Automatic recognition and processing of different resource pack formats

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern user interface framework
- **TypeScript** - Type-safe JavaScript superset
- **Ant Design** - Enterprise-class UI design language and component library
- **Vite** - Fast frontend build tool

### Backend
- **Node.js** - JavaScript runtime environment
- **Express.js** - Lightweight web application framework
- **TypeScript** - Type-safe server-side development
- **tsx** - Main process TypeScript executor (development environment)
- **ts-node** - Worker thread TypeScript executor (development environment)

### Core Dependencies
- **multer** - File upload handling middleware
- **archiver** - ZIP file creation and compression
- **yauzl/yazl** - ZIP file read/write operations
- **uuid** - Unique identifier generation
- **crypto** - Node.js built-in encryption module

### Technical Architecture

#### Development Environment
- **Main Process (Backend Server)**: Uses `tsx` to directly run TypeScript files
- **Worker Threads**: Uses `ts-node/register` to run TypeScript Worker files
- **Frontend**: Uses Vite development server with hot reload support

#### Production Environment
- **Main Process**: Runs JavaScript files compiled by `tsc`
- **Worker Threads**: Runs compiled JavaScript Worker files
- **Frontend**: Built as static assets, served by backend server

#### Multi-threading Architecture
- **WorkerPool**: Manages multiple Worker threads for parallel processing
- **CryptoWorker**: Specialized Worker threads for encryption/decryption tasks
- **Main Thread**: Handles HTTP request processing, file management, and task scheduling
- **Fallback Mechanism**: Automatically falls back to main thread synchronous processing when Worker thread pool fails

#### Security Features
- **Temporary File Cleanup**: Automatically cleans up residual temporary files on server startup
- **Immediate Cleanup**: Immediately deletes intermediate files after encryption/decryption completion
- **Secure Download**: Download links with 5-minute validity, automatically deleted after single use
- **Memory Protection**: Uses streaming processing to avoid sensitive data residing in memory for extended periods
- **Scheduled Cleanup**: Automatically cleans up files older than 1 hour every 30 minutes

## 🔐 Encryption Algorithm

This project uses **AES-256-CFB8** encryption algorithm with the following characteristics:

- **Algorithm**: AES (Advanced Encryption Standard)
- **Key Length**: 256-bit
- **Mode**: CFB8 (Cipher Feedback 8-bit)
- **Key Generation**: 16-character random string
- **File Processing**: Supports subpacks encryption
- **Excluded Files**: Metadata files like `manifest.json`, `pack_icon.png`, `bug_pack_icon.png` are not encrypted

## 🚀 Installation and Setup

### Requirements

- Node.js >= 18.0.0
- npm >= 8.0.0

### Installation Steps

1. **Clone the Project**
   ```bash
   # Clone the project locally
   git clone https://cnb.cool/EnderRealm/public/MCBEPackCrypt.git
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Access the Application**
   - Frontend Interface: http://localhost:3000
   - Backend API: http://localhost:3001

### Production Deployment

#### Method 1: Docker Deployment (Recommended)

1. **Pull Docker Image**
   ```bash
   docker pull docker.cnb.cool/enderrealm/public/MCBEPackCrypt
   ```

2. **Run Container**

   **Full-Stack Mode (Default)**
   ```bash
   docker run -d -p 3000:3000 --name MCBEPackCrypt-app docker.cnb.cool/enderrealm/public/MCBEPackCrypt
   ```

   **Pure Frontend Mode**
   ```bash
   docker run -d -p 3000:3000 -e DEPLOYMENT_MODE=frontend-only --name MCBEPackCrypt-frontend docker.cnb.cool/enderrealm/public/MCBEPackCrypt
   ```

3. **Deployment Modes**

   This application supports two deployment modes:

   - **Full-Stack Mode** (`DEPLOYMENT_MODE=fullstack`, default)
     - Complete backend API services
     - Server-side encryption/decryption processing
     - File upload and download management
     - Suitable for production environments with high security requirements

   - **Pure Frontend Mode** (`DEPLOYMENT_MODE=frontend-only`)
     - Client-side encryption/decryption using Web Crypto API
     - No file upload to server, all processing in browser
     - Enhanced privacy protection
     - Suitable for scenarios requiring maximum data privacy

4. **Custom Configuration**
   
   You can modify the following parameters as needed:
   
   - **Port Mapping**: `-p host_port:3000`
     ```bash
     # Example: Use port 8080
     docker run -d -p 8080:3000 --name MCBEPackCrypt-app docker.cnb.cool/enderrealm/public/MCBEPackCrypt
     ```
   
   - **Container Name**: `--name custom_name`
     ```bash
     # Example: Use custom name
     docker run -d -p 3000:3000 --name my-encrypt-tool docker.cnb.cool/enderrealm/public/MCBEPackCrypt
     ```

   - **Environment Variables**: `-e VARIABLE=value`
     ```bash
     # Frontend-only mode with custom port
     docker run -d -p 8080:3000 -e DEPLOYMENT_MODE=frontend-only --name my-encrypt-tool docker.cnb.cool/enderrealm/public/MCBEPackCrypt
     ```
   
   - **Complete Custom Example**:
     ```bash
     docker run -d -p 8080:3000 -e DEPLOYMENT_MODE=frontend-only --name my-encrypt-tool docker.cnb.cool/enderrealm/public/MCBEPackCrypt
     ```

4. **Access Application**
   - **Full-Stack Mode**: http://localhost:3000 (or your custom port)
   - **Pure Frontend Mode**: http://localhost:3000 (or your custom port)
   
   You can check the current deployment mode by visiting: http://localhost:3000/api/health

#### Method 2: Source Code Deployment

1. **Build Project**
   ```bash
   npm run build
   ```

2. **Start Production Server**
   ```bash
   npm start
   ```

## 📋 API Endpoints

**Note**: API availability depends on the deployment mode.

### Health Check (Available in all modes)
- `GET /api/health` - Service status check and deployment mode information

### Full-Stack Mode APIs
The following APIs are only available when `DEPLOYMENT_MODE=fullstack`:

#### Encryption Service
- `POST /api/encrypt` - Upload and encrypt resource pack
- `GET /api/encrypt/status` - Get encryption service status

#### Decryption Service
- `POST /api/decrypt` - Upload encrypted file and key for decryption
- `GET /api/decrypt/status` - Get decryption service status

#### Download Service
- `GET /api/download/:id` - Download processed file
- `GET /api/download/stats` - Get download statistics

### Pure Frontend Mode
When `DEPLOYMENT_MODE=frontend-only`, encryption and decryption are performed entirely in the browser using the Web Crypto API. No backend processing APIs are available.

## 📝 Usage Instructions

### Encrypting Resource Packs

1. Access the web interface
2. Select the resource pack file to encrypt (.zip, .mcpack)
3. Click the "Encrypt" button
4. Wait for processing to complete
5. Download the compressed package containing the encrypted file and key

### Decrypting Resource Packs

1. Prepare the encrypted .zip file and corresponding .key file
2. Upload both files simultaneously on the decryption page
3. Click the "Decrypt" button
4. Download the decrypted resource pack

## ⚠️ Important Notes

- File size limit: Maximum 100MB per file
- Download link validity: 5 minutes
- Download limit: Each link can only be downloaded once
- Key security: Please keep the key file safe, it cannot be recovered if lost
- Supported formats: Only supports standard Minecraft Bedrock Edition resource pack formats

## 📄 License

This project is licensed under [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html).

## 🙏 Acknowledgments

The encryption and decryption algorithm implementation of this project references the [AllayMC/EncryptMyPack](https://github.com/AllayMC/EncryptMyPack) project.