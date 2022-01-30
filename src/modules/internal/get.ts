import { join } from 'path';
import { cmd as _cmd } from '7zip-min';
/**@ts-ignore */
import root from './root.cjs';
import { dir, downloadable, file } from '../objects/files.js';
export const processCMD = "download.progress";
export const failCMD = "download.fail";

export function getSelf(): string {
    return join(root, "get.js");
}

if (process.env.length) {
    const keys: downloadable[] = [];
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