/**
 * This is the core of the download manager. No code from the main thread should interact with it!
 * DO NOT WRAP THIS FUNTION UP WITH WEBPACK IF YOU DO NOT WANT THINGS TO BREAK BADLY. 
 * 
 * Redefine the property __get in the config module to change where GMLL looks for this file.
 */
import { cmd as _cmd } from '7zip-min';
import type { downloadableFile } from "gmll/types";
import { dir, file } from "gmll/objects/files";
import cluster from 'cluster';

const processCMD = "download.progress";
const failCMD = "download.fail";

if (cluster.isPrimary || cluster.isMaster) throw "[GMLL]: Cannot run this module from main thread!"



if (process.env.length) {
    const keys: downloadableFile[] = [];
    for (var i = 0; i < new Number(process.env.length); i++) {
        keys.push(JSON.parse(process.env["gmll_" + i]));
    }
    keys.forEach(o => {
        var retry = 0;
        async function load() {
            await file.process(o);
            process.send({ cmd: processCMD, key: o.key });
        }
        load().catch(e => {
            if (retry <= 3) {
                retry++;
                process.send({ cmd: failCMD, type: "retry", key: o.key, err: e });
                return;
            }
            load();
            console.log("[GMLL]: procedural failure : " + new dir(...o.path));
            process.send({ cmd: failCMD, type: "system", key: o.path, err: e });
            process.send({ cmd: processCMD, key: o.path });
        });
    });
}