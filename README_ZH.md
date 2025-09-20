# MCBEPackCrypt

一个基于Web的Minecraft基岩版资源包加密与解密实用工具。

## 📖 项目简介

MCBEPackCrypt 是一个专为 Minecraft 基岩版（Bedrock Edition）设计的资源包加密解密工具。通过简洁的Web界面，用户可以轻松地对资源包进行加密保护，防止未经授权的访问和修改。

## ✨ 主要功能

- 🔐 **资源包加密**：支持 `.zip`、`.mcpack` 格式的资源包加密
- 🔓 **资源包解密**：使用密钥文件对加密的资源包进行解密
- 🌐 **Web界面**：直观易用的现代化Web用户界面
- ⚡ **实时处理**：快速的文件上传、处理和下载
- 🔒 **安全下载**：临时下载链接，5分钟有效期，一次性使用
- 📦 **多格式支持**：自动识别并处理不同的资源包格式

## 🛠️ 技术栈

### 前端
- **React 18** - 现代化的用户界面框架
- **TypeScript** - 类型安全的JavaScript超集
- **Ant Design** - 企业级UI设计语言和组件库
- **Vite** - 快速的前端构建工具

### 后端
- **Node.js** - JavaScript运行时环境
- **Express.js** - 轻量级Web应用框架
- **TypeScript** - 类型安全的服务端开发
- **tsx** - 主进程TypeScript执行器（开发环境）
- **ts-node** - Worker线程TypeScript执行器（开发环境）

### 核心依赖
- **multer** - 文件上传处理中间件
- **archiver** - ZIP文件创建和压缩
- **yauzl/yazl** - ZIP文件读写操作
- **uuid** - 唯一标识符生成
- **crypto** - Node.js内置加密模块

### 技术架构说明

#### 开发环境
- **主进程（后端服务器）**：使用 `tsx` 直接运行 TypeScript 文件
- **Worker线程**：使用 `ts-node/register` 运行 TypeScript Worker 文件
- **前端**：使用 Vite 开发服务器，支持热重载

#### 生产环境
- **主进程**：运行 `tsc` 编译后的 JavaScript 文件
- **Worker线程**：运行编译后的 JavaScript Worker 文件
- **前端**：构建为静态资源，由后端服务器提供

#### 多线程架构
- **WorkerPool**：管理多个 Worker 线程，实现并行处理
- **CryptoWorker**：专门处理加密/解密任务的 Worker 线程
- **主线程**：负责HTTP请求处理、文件管理和任务调度
- **回退机制**：Worker 线程池失败时自动回退到主线程同步处理

#### 安全特性
- **临时文件清理**：服务器启动时自动清理残留的临时文件
- **即时清理**：加密/解密完成后立即删除中间文件
- **安全下载**：下载链接5分钟有效期，一次性使用后自动删除
- **内存保护**：使用流式处理，避免敏感数据长时间驻留内存
- **定时清理**：每30分钟自动清理超过1小时的旧文件

## 🔐 加密算法

本项目使用 **AES-256-CFB8** 加密算法，具体特性：

- **算法**：AES (Advanced Encryption Standard)
- **密钥长度**：256位
- **模式**：CFB8 (Cipher Feedback 8-bit)
- **密钥生成**：16位随机字符串
- **文件处理**：支持子包（subpacks）加密
- **排除文件**：`manifest.json`、`pack_icon.png`、`bug_pack_icon.png` 等元数据文件不加密

## 🚀 安装与启动

### 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0

### 安装步骤

1. **克隆项目**
   ```bash
   # 克隆项目到本地
   git clone https://cnb.cool/EnderRealm/public/MCBEPackCrypt.git
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

4. **访问应用**
   - 前端界面：http://localhost:3000
   - 后端API：http://localhost:3001

### 生产环境部署

#### 方式一：Docker部署（推荐）

1. **拉取Docker镜像**
   ```bash
   docker pull docker.cnb.cool/enderrealm/public/MCBEPackCrypt
   ```

2. **运行容器**
   ```bash
   docker run -d -p 3000:3000 --name MCBEPackCrypt-app docker.cnb.cool/enderrealm/public/MCBEPackCrypt
   ```

3. **自定义配置**
   
   您可以根据需要修改以下参数：
   
   - **端口映射**：`-p 宿主机端口:3000`
     ```bash
     # 例如：使用8080端口
     docker run -d -p 8080:3000 --name MCBEPackCrypt-app docker.cnb.cool/enderrealm/public/MCBEPackCrypt
     ```
   
   - **容器名称**：`--name 自定义名称`
     ```bash
     # 例如：使用自定义名称
     docker run -d -p 3000:3000 --name my-encrypt-tool docker.cnb.cool/enderrealm/public/MCBEPackCrypt
     ```
   
   - **完整自定义示例**：
     ```bash
     docker run -d -p 8080:3000 --name my-encrypt-tool docker.cnb.cool/enderrealm/public/MCBEPackCrypt
     ```

4. **访问应用**
   - 应用界面：http://localhost:3000 （或您自定义的端口）

#### 方式二：源码部署

1. **构建项目**
   ```bash
   npm run build
   ```

2. **启动生产服务器**
   ```bash
   npm start
   ```

## 📋 API 接口

### 健康检查
- `GET /api/health` - 服务状态检查

### 加密服务
- `POST /api/encrypt` - 上传并加密资源包
- `GET /api/encrypt/status` - 获取加密服务状态

### 解密服务
- `POST /api/decrypt` - 上传加密文件和密钥进行解密
- `GET /api/decrypt/status` - 获取解密服务状态

### 下载服务
- `GET /api/download/:id` - 下载处理后的文件
- `GET /api/download/stats` - 获取下载统计信息

## 📝 使用说明

### 加密资源包

1. 访问Web界面
2. 选择要加密的资源包文件（.zip、.mcpack）
3. 点击"加密"按钮
4. 等待处理完成
5. 下载包含加密文件和密钥的压缩包

### 解密资源包

1. 准备加密后的.zip文件和对应的.key密钥文件
2. 在解密页面同时上传这两个文件
3. 点击"解密"按钮
4. 下载解密后的资源包

## ⚠️ 注意事项

- 文件大小限制：单个文件最大100MB
- 下载链接有效期：5分钟
- 下载次数限制：每个链接仅可下载一次
- 密钥安全：请妥善保管密钥文件，丢失后无法恢复
- 支持格式：仅支持标准的Minecraft基岩版资源包格式

## 📄 许可证

本项目采用 [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html) 许可证。

## 🙏 致谢

本项目的加密解密算法实现参考了 [AllayMC/EncryptMyPack](https://github.com/AllayMC/EncryptMyPack) 项目。