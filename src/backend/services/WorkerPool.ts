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
    console.log(`Initializing Worker thread pool, CPU cores: ${cpuCount}, max workers: ${this.maxWorkers}`);
  }

  private createWorker(): PoolWorker {
    // 在开发环境中使用 TypeScript 文件，在生产环境中使用编译后的 JavaScript 文件
    const isDevelopment = process.env.NODE_ENV !== 'production';
    let worker: Worker;
    
    console.log(`Creating Worker, development environment: ${isDevelopment}`);
    
    if (isDevelopment) {
      // 开发环境：使用 ts-node 运行 TypeScript 文件
      const workerPath = path.join(__dirname, '../workers/cryptoWorker.ts');
      console.log(`Attempting to create Worker, path: ${workerPath}`);
      try {
        worker = new Worker(workerPath, {
          execArgv: ['--require', 'ts-node/register']
        });
        console.log('Worker created successfully (using ts-node)');
      } catch (error) {
        console.error('Failed to create Worker using ts-node:', error);
        throw error;
      }
    } else {
      // 生产环境：使用编译后的 JavaScript 文件
      const workerPath = path.join(__dirname, '../workers/cryptoWorker.js');
      console.log(`Attempting to create Worker, path: ${workerPath}`);
      try {
        worker = new Worker(workerPath);
        console.log('Worker created successfully (using JavaScript)');
      } catch (error) {
        console.error('Failed to create Worker:', error);
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
        console.error(`Worker ${workerId} exited abnormally, exit code: ${code}`);
      }
      this.removeWorker(poolWorker);
    });

    this.workers.push(poolWorker);
    console.log(`Created Worker thread ${workerId}, current pool size: ${this.workers.length}`);
    return poolWorker;
  }

  private removeWorker(poolWorker: PoolWorker): void {
    const index = this.workers.indexOf(poolWorker);
    if (index > -1) {
      this.workers.splice(index, 1);
      console.log(`Removed Worker thread ${poolWorker.id}, current pool size: ${this.workers.length}`);
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
          console.error(`Worker ${availableWorker.id} task execution error:`, error);
          reject(error);
        };

        // 设置超时机制（30秒）
        timeoutId = setTimeout(() => {
          if (isResolved) return;
          isResolved = true;
          cleanup();
          console.error(`Worker ${availableWorker.id} task execution timeout`);
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
    console.log(`Starting batch processing of ${tasks.length} tasks`);
    const startTime = Date.now();
    
    const promises = tasks.map(task => this.executeTask(task));
    const results = await Promise.all(promises);
    
    const endTime = Date.now();
    console.log(`Batch processing completed, time taken: ${endTime - startTime}ms, average per task: ${(endTime - startTime) / tasks.length}ms`);
    
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
    console.log('Shutting down Worker thread pool...');
    const terminationPromises = this.workers.map(poolWorker => 
      poolWorker.worker.terminate()
    );
    
    await Promise.all(terminationPromises);
    this.workers = [];
    this.taskQueue = [];
    console.log('Worker thread pool has been shut down');
  }
}

// 单例模式，全局共享一个线程池
let globalWorkerPool: WorkerPool | null = null;

export function getWorkerPool(): WorkerPool {
  if (!globalWorkerPool) {
    console.log('Initializing global Worker thread pool...');
    try {
      globalWorkerPool = new WorkerPool();
      console.log('Global Worker thread pool initialized successfully');
    } catch (error) {
      console.error('Worker thread pool initialization failed:', error);
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