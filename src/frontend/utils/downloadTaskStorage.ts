// 下载任务存储管理工具

export interface DownloadTask {
  id: string;
  downloadUrl: string;
  operationType: 'encrypt' | 'decrypt';
  files: {
    encrypted?: string;
    key?: string;
    decrypted?: string;
  };
  createdAt: number;
  expiresAt: number;
  expiresIn: string;
}

const STORAGE_KEY = 'mcbe_download_task';
const TASK_DURATION = 5 * 60 * 1000; // 5分钟

/**
 * 保存下载任务到会话存储
 */
export const saveDownloadTask = (task: Omit<DownloadTask, 'id' | 'createdAt' | 'expiresAt'>): void => {
  const now = Date.now();
  const downloadTask: DownloadTask = {
    ...task,
    id: `task_${now}`,
    createdAt: now,
    expiresAt: now + TASK_DURATION
  };
  
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(downloadTask));
  } catch (error) {
    console.error('保存下载任务失败:', error);
  }
};

/**
 * 获取当前的下载任务
 */
export const getDownloadTask = (): DownloadTask | null => {
  try {
    const taskData = sessionStorage.getItem(STORAGE_KEY);
    if (!taskData) {
      return null;
    }
    
    const task: DownloadTask = JSON.parse(taskData);
    const now = Date.now();
    
    // 检查是否过期
    if (now > task.expiresAt) {
      clearDownloadTask();
      return null;
    }
    
    return task;
  } catch (error) {
    console.error('获取下载任务失败:', error);
    clearDownloadTask();
    return null;
  }
};

/**
 * 清除下载任务
 */
export const clearDownloadTask = (): void => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('清除下载任务失败:', error);
  }
};

/**
 * 检查是否有有效的下载任务
 */
export const hasValidDownloadTask = (): boolean => {
  return getDownloadTask() !== null;
};

/**
 * 获取任务剩余时间（毫秒）
 */
export const getRemainingTime = (): number => {
  const task = getDownloadTask();
  if (!task) {
    return 0;
  }
  
  const remaining = task.expiresAt - Date.now();
  return Math.max(0, remaining);
};



/**
 * 开始下载任务
 */
export const startDownload = (downloadUrl: string): void => {
  try {
    window.open(downloadUrl, '_blank');
    // 下载后清除任务
    clearDownloadTask();
  } catch (error) {
    console.error('开始下载失败:', error);
  }
};