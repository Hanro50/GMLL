/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * This is the core of the download manager. No code from the main thread should interact with it!
 * If GMLL is unable to reach this library then it will use a slower fallback.
 * 
 * Redefine the property __get in the config module to change where GMLL looks for this file.
 * ^ If you want to reenable the faster downloader.
 */

import { Dir, File } from "../objects/files.js";
import { parentPort, workerData } from "worker_threads";

export type getWorkerDate = { processCMD: string, failCMD: string, getCMD: string, postCMD: string, zipDir: string[] };

const { processCMD, failCMD, getCMD, postCMD, zipDir }: getWorkerDate = workerData;
async function load(a: any, retry = 0) {
    const o = a.data;
    try {
        await File.process(o, new Dir(...zipDir));
        parentPort.postMessage({ cmd: processCMD, key: o.key });
        return;
    } catch (e) {
        if (retry <= 3) {
            retry++;
            parentPort.postMessage({ cmd: failCMD, type: "retry", key: o.key, err: e });
            await load(a, retry);
            return;
        }
        console.error("[GMLL]: procedural failure : " + new Dir(...o.path));
        parentPort.postMessage({ cmd: failCMD, type: "system", key: o.path, err: e });
        parentPort.postMessage({ cmd: processCMD, key: o.key });
    }
}

parentPort.on("message", async (a) => {
    if (a.data && a.cmd == postCMD)
        await load(a);

})
parentPort.postMessage({ cmd: getCMD, type: "system" });

