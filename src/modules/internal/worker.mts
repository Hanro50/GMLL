import { Worker, WorkerOptions } from "worker_threads";
/**
 * @param options options to initalize a worker
 * @returns a fully created worker instance
 */
export function makeWorker(options: WorkerOptions) {
  return new Worker(new URL("./get.js", import.meta.url), options);
}
