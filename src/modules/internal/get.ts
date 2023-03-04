/*
 * This is the core of the download manager. No code from the main thread should interact with it!
 * DO NOT WRAP THIS FUNCTION UP WITH WEBPACK IF YOU DO NOT WANT THINGS TO BREAK BADLY. 
 * 
 * Redefine the property __get in the config module to change where GMLL looks for this file.
 */

import { dir, file } from "gmll/objects/files";
import { parentPort, workerData } from "worker_threads";
export type getWorkerDate = { processCMD:string, failCMD:string,getCMD:string,postCMD:string };
const {processCMD, failCMD,getCMD,postCMD}: getWorkerDate = workerData;
parentPort.on("message", async (a) => {
    if (a.data && a.cmd == postCMD) {
        let retry = 0;
        async function load() {
            const o = a.data;
            try {
                await file.process(o);
                parentPort.postMessage({ cmd: processCMD, key: o.key });
                return;
            } catch (e) {
                if (retry <= 3) {
                    retry++;
                    parentPort.postMessage({ cmd: failCMD, type: "retry", key: o.key, err: e });
                    await load();
                    return;
                }
                console.error("[GMLL]: procedural failure : " + new dir(...o.path));
                parentPort.postMessage({ cmd: failCMD, type: "system", key: o.path, err: e });
                parentPort.postMessage({ cmd: processCMD, key: o.key });
            }
        }
        await load();
    }
})
parentPort.postMessage({ cmd: getCMD, type: "system" });