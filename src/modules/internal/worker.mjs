import { Worker, WorkerOptions } from 'worker_threads';
/**
 * @param {WorkerOptions} options options to initalize a worker
 * @returns a fully created worker instance
 */
export function makeWorker(options) {
	return new Worker(new URL('./get.js', import.meta), options);
}
