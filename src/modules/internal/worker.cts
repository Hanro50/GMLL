import { join } from "path";
import { Worker, WorkerOptions } from "worker_threads";
/**
 * @param options options to initalize a worker
 * @returns a fully created worker instance
 */
export function makeWorker(options: WorkerOptions) {
  return new Worker(join(__dirname,"get.js"), options);
}
