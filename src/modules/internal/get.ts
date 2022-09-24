/*
 * This is the core of the download manager. No code from the main thread should interact with it!
 * DO NOT WRAP THIS FUNTION UP WITH WEBPACK IF YOU DO NOT WANT THINGS TO BREAK BADLY. 
 * 
 * Redefine the property __get in the config module to change where GMLL looks for this file.
 */
import type { downloadableFile } from "gmll/types";
import { dir, file } from "gmll/objects/files";
import { parentPort, workerData } from "worker_threads";

export type getWorkerDate = { processCMD: string, failCMD: string, keys: downloadableFile[] };

const WD: getWorkerDate = workerData;
const processCMD = WD.processCMD;
const failCMD = WD.failCMD;
const keys = WD.keys;

keys.forEach(o => {
    var retry = 0;
    async function load() {
        await file.process(o);
        parentPort.postMessage({ cmd: processCMD, key: o.key });
    }
    load().catch(e => {
        if (retry <= 3) {
            retry++;
            parentPort.postMessage({ cmd: failCMD,type: "retry", key: o.key, err: e });
            return;
        }
        load();
        console.log("[GMLL]: procedural failure : " + new dir(...o.path));
        parentPort.postMessage({ cmd: failCMD, type: "system", key: o.path, err: e });
        parentPort.postMessage({ cmd: processCMD, key: o.path });
    });
});
