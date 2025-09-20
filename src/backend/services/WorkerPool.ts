import { Worker } from 'worker_threads';
import * as path from 'path';
import * as os from 'os';
import { WorkerTask, WorkerResult } from '../workers/cryptoWorker';

interface PoolWorker {
  worker: Worker;
  busy: boolean;
  id: number;
}

interface QueuedTask {
  task: WorkerTask;
  resolve: (result: WorkerResult) => void;
  reject: (error: Error) => void;
}

export class WorkerPool {
  private workers: PoolWorker[] = [];
  private taskQueue: QueuedTask[] = [];
  private readonly maxWorkers: number;
  private workerIdCounter = 0;

  constructor(maxWorkers?: number) {
    // 针对低配置服务器优化：减少默认Worker数量
    const cpuCount = os.cpus().length;
    const defaultWorkers = process.env.NODE_ENV === 'production' 
      ? Math.min(Math.max(cpuCount - 1, 1), 4) // 生产环境：保留1个CPU核心，最多4个Worker
      : Math.min(cpuCount, 8); // 开发环境：使用更多Worker便于调试
    
    this.maxWorkers = maxWorkers || defaultWorkers;
    console.log(`初始化Worker线程池，CPU核心数: ${cpuCount}，最大工作线程数: ${this.maxWorkers}`);
  }

  private createWorker(): PoolWorker {
    // 在开发环境中使用 TypeScript 文件，在生产环境中使用编译后的 JavaScript 文件
    const isDevelopment = process.env.NODE_ENV !== 'production';
    let worker: Worker;
    
    console.log(`正在创建Worker，开发环境: ${isDevelopment}`);
    
    if (isDevelopment) {
      // 开发环境：使用 ts-node 运行 TypeScript 文件
      const workerPath = path.join(__dirname, '../workers/cryptoWorker.ts');
      console.log(`尝试创建Worker，路径: ${workerPath}`);
      try {
        worker = new Worker(workerPath, {
          execArgv: ['--require', 'ts-node/register']
        });
        console.log('Worker创建成功（使用ts-node）');
      } catch (error) {
        console.error('使用ts-node创建Worker失败:', error);
        throw error;
      }
    } else {
      // 生产环境：使用编译后的 JavaScript 文件
      const workerPath = path.join(__dirname, '../workers/cryptoWorker.js');
      console.log(`尝试创建Worker，路径: ${workerPath}`);
      try {
        worker = new Worker(workerPath);
        console.log('Worker创建成功（使用JavaScript）');
      } catch (error) {
        console.error('创建Worker失败:', error);
        throw error;
      }
    }
    const workerId = this.workerIdCounter++;
    
    // 设置最大监听器数量以避免内存泄漏警告
    worker.setMaxListeners(0); // 移除监听器限制，使用更好的事件管理
    
    const poolWorker: PoolWorker = {
      worker,
      busy: false,
      id: workerId
    };

    // 只监听exit事件，其他事件在任务执行时动态处理
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker ${workerId} 异常退出，退出码: ${code}`);
      }
      this.removeWorker(poolWorker);
    });

    this.workers.push(poolWorker);
    console.log(`创建Worker线程 ${workerId}，当前线程池大小: ${this.workers.length}`);
    return poolWorker;
  }

  private removeWorker(poolWorker: PoolWorker): void {
    const index = this.workers.indexOf(poolWorker);
    if (index > -1) {
      this.workers.splice(index, 1);
      console.log(`移除Worker线程 ${poolWorker.id}，当前线程池大小: ${this.workers.length}`);
    }
  }

  private getAvailableWorker(): PoolWorker | null {
    // 查找空闲的worker
    const availableWorker = this.workers.find(w => !w.busy);
    if (availableWorker) {
      return availableWorker;
    }

    // 如果没有空闲worker且未达到最大数量，创建新worker
    if (this.workers.length < this.maxWorkers) {
      return this.createWorker();
    }

    return null;
  }

  private processNextTask(): void {
    if (this.taskQueue.length === 0) {
      return;
    }

    const availableWorker = this.getAvailableWorker();
    if (!availableWorker) {
      return;
    }

    const queuedTask = this.taskQueue.shift()!;
    availableWorker.busy = true;

    // 使用Promise包装Worker通信，确保事件监听器正确管理
    const executeTask = () => {
      return new Promise<WorkerResult>((resolve, reject) => {
        let isResolved = false;
        let timeoutId: NodeJS.Timeout;

        const cleanup = () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          availableWorker.worker.removeAllListeners('message');
          availableWorker.worker.removeAllListeners('error');
        };

        const messageHandler = (result: WorkerResult) => {
          if (isResolved) return;
          isResolved = true;
          cleanup();
          resolve(result);
        };

        const errorHandler = (error: Error) => {
          if (isResolved) return;
          isResolved = true;
          cleanup();
          console.error(`Worker ${availableWorker.id} 任务执行错误:`, error);
          reject(error);
        };

        // 设置超时机制（30秒）
        timeoutId = setTimeout(() => {
          if (isResolved) return;
          isResolved = true;
          cleanup();
          console.error(`Worker ${availableWorker.id} 任务执行超时`);
          reject(new Error('Worker task timeout'));
        }, 30000);

        // 添加事件监听器
        availableWorker.worker.on('message', messageHandler);
        availableWorker.worker.on('error', errorHandler);
        
        // 发送任务
        try {
          availableWorker.worker.postMessage(queuedTask.task);
        } catch (error) {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            reject(error as Error);
          }
        }
      });
    };

    executeTask()
      .then(result => {
        availableWorker.busy = false;
        queuedTask.resolve(result);
        // 延迟处理下一个任务，避免递归调用栈过深
        setImmediate(() => this.processNextTask());
      })
      .catch(error => {
        availableWorker.busy = false;
        queuedTask.reject(error);
        // 延迟处理下一个任务，避免递归调用栈过深
        setImmediate(() => this.processNextTask());
      });
  }

  public async executeTask(task: WorkerTask): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      const queuedTask: QueuedTask = { task, resolve, reject };
      this.taskQueue.push(queuedTask);
      this.processNextTask();
    });
  }

  public async executeBatch(tasks: WorkerTask[]): Promise<WorkerResult[]> {
    console.log(`开始批量处理 ${tasks.length} 个任务`);
    const startTime = Date.now();
    
    const promises = tasks.map(task => this.executeTask(task));
    const results = await Promise.all(promises);
    
    const endTime = Date.now();
    console.log(`批量处理完成，耗时: ${endTime - startTime}ms，平均每个任务: ${(endTime - startTime) / tasks.length}ms`);
    
    return results;
  }

  public getStats() {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter(w => w.busy).length,
      queuedTasks: this.taskQueue.length,
      maxWorkers: this.maxWorkers
    };
  }

  public async terminate(): Promise<void> {
    console.log('正在关闭Worker线程池...');
    const terminationPromises = this.workers.map(poolWorker => 
      poolWorker.worker.terminate()
    );
    
    await Promise.all(terminationPromises);
    this.workers = [];
    this.taskQueue = [];
    console.log('Worker线程池已关闭');
  }
}

// 单例模式，全局共享一个线程池
let globalWorkerPool: WorkerPool | null = null;

export function getWorkerPool(): WorkerPool {
  if (!globalWorkerPool) {
    console.log('正在初始化全局Worker线程池...');
    try {
      globalWorkerPool = new WorkerPool();
      console.log('全局Worker线程池初始化成功');
    } catch (error) {
      console.error('Worker线程池初始化失败:', error);
      throw error;
    }
  }
  return globalWorkerPool;
}

export async function terminateWorkerPool(): Promise<void> {
  if (globalWorkerPool) {
    await globalWorkerPool.terminate();
    globalWorkerPool = null;
  }
}