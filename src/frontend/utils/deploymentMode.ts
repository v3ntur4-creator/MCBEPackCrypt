// 部署模式检测工具
// 用于前端判断当前部署模式，决定是否使用客户端加密

interface DeploymentInfo {
  mode: 'fullstack' | 'frontend-only';
  features: {
    backendCrypto: boolean;
    fileServices: boolean;
    cleanupService: boolean;
  };
}

class DeploymentModeDetector {
  private static instance: DeploymentModeDetector;
  private deploymentInfo: DeploymentInfo | null = null;
  private isDetecting = false;

  private constructor() {}

  static getInstance(): DeploymentModeDetector {
    if (!DeploymentModeDetector.instance) {
      DeploymentModeDetector.instance = new DeploymentModeDetector();
    }
    return DeploymentModeDetector.instance;
  }

  /**
   * 检测部署模式
   */
  async detectDeploymentMode(): Promise<DeploymentInfo> {
    if (this.deploymentInfo) {
      return this.deploymentInfo;
    }

    if (this.isDetecting) {
      // 等待检测完成
      while (this.isDetecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.deploymentInfo!;
    }

    this.isDetecting = true;

    try {
      // 尝试调用健康检查接口
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const healthData = await response.json();
        
        // 从健康检查响应中获取部署模式信息
        if (healthData.data && healthData.data.deploymentMode) {
          this.deploymentInfo = {
            mode: healthData.data.deploymentMode,
            features: healthData.data.features || {
              backendCrypto: healthData.data.deploymentMode === 'fullstack',
              fileServices: healthData.data.deploymentMode === 'fullstack',
              cleanupService: healthData.data.deploymentMode === 'fullstack'
            }
          };
        } else {
          // 兼容旧版本响应格式
          this.deploymentInfo = {
            mode: 'fullstack',
            features: {
              backendCrypto: true,
              fileServices: true,
              cleanupService: true
            }
          };
        }
      } else {
        // 如果健康检查失败，假设为frontend-only模式
        console.warn('Health check failed, assuming frontend-only mode');
        this.deploymentInfo = {
          mode: 'frontend-only',
          features: {
            backendCrypto: false,
            fileServices: false,
            cleanupService: false
          }
        };
      }
    } catch (error) {
      // 网络错误或其他错误，假设为frontend-only模式
      console.warn('Failed to detect deployment mode, assuming frontend-only:', error);
      this.deploymentInfo = {
        mode: 'frontend-only',
        features: {
          backendCrypto: false,
          fileServices: false,
          cleanupService: false
        }
      };
    } finally {
      this.isDetecting = false;
    }

    return this.deploymentInfo;
  }

  /**
   * 获取当前部署模式（同步）
   */
  getCurrentMode(): DeploymentInfo | null {
    return this.deploymentInfo;
  }

  /**
   * 是否为前端模式
   */
  async isFrontendOnlyMode(): Promise<boolean> {
    const info = await this.detectDeploymentMode();
    return info.mode === 'frontend-only';
  }

  /**
   * 是否支持后端加密
   */
  async supportsBackendCrypto(): Promise<boolean> {
    const info = await this.detectDeploymentMode();
    return info.features.backendCrypto;
  }

  /**
   * 重置检测状态（用于强制重新检测）
   */
  reset(): void {
    this.deploymentInfo = null;
    this.isDetecting = false;
  }

  /**
   * 获取部署模式描述
   */
  async getModeDescription(): Promise<string> {
    const info = await this.detectDeploymentMode();
    
    if (info.mode === 'frontend-only') {
      return '纯前端模式 - 所有加密解密操作在浏览器中完成';
    } else {
      return '全栈模式 - 加密解密操作在服务器端完成';
    }
  }

  /**
   * 获取功能可用性描述
   */
  async getFeatureDescription(): Promise<string[]> {
    const info = await this.detectDeploymentMode();
    const features: string[] = [];
    
    if (info.features.backendCrypto) {
      features.push('✅ 服务器端加密解密');
    } else {
      features.push('🔧 客户端加密解密');
    }
    
    if (info.features.fileServices) {
      features.push('✅ 文件上传下载服务');
    } else {
      features.push('📁 浏览器本地文件处理');
    }
    
    if (info.features.cleanupService) {
      features.push('✅ 自动清理服务');
    } else {
      features.push('🗑️ 无需清理（本地处理）');
    }
    
    return features;
  }
}

// 导出单例实例
export const deploymentModeDetector = DeploymentModeDetector.getInstance();
export type { DeploymentInfo };