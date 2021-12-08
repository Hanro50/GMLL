//Handles mass file downloads
import { existsSync, readFileSync, createWriteStream } from 'fs';
import { join } from 'path';
import Fetch from 'node-fetch';
import { cmd as _cmd } from '7zip-min';
import { mutator, compare } from './util.js';
/**@ts-ignore */
import root from './root.cjs';
export const processCMD = "download.progress";
export const failCMD = "download.fail";


export function getSelf(): string {
    return join(root, "get.js");
}
export interface downloadable {
    path: string,
    url: string,
    name: string,
    unzip?: {
        exclude?: string[],
        name?: string,
        path: string
    }
    size?: number,
    sha1?: String,
    executable?: boolean,
    /**Internally used to identify object: 
           * May not be constant */
    key: string
}

if (process.env.file && existsSync(process.env.file)) {
    const keys: downloadable[] = JSON.parse(readFileSync(process.env.file).toString());

    keys.forEach(o => {
        var retry = 0;
        async function load() {
            if (compare(o)) {
                await mutator(o);
                process.send({ cmd: processCMD, key: o.key }); return
            };
            const download =
                new Promise(async e => {
                    const file = createWriteStream(join(o.path, o.name))
                    const res = await Fetch(o.url);
                    res.body.pipe(file, { end: true });
                    file.on("close", e);

                });
            download.then(() => mutator(o))
            download.then(() => process.send({ cmd: processCMD, key: o.key }));

            download.catch(e => {
                if (retry > 3) {
                    process.send({ cmd: processCMD, key: o.key });
                    process.send({ cmd: failCMD, type: "fail", key: o.key, err: e });
                    return;
                }
                retry++;
                process.send({ cmd: failCMD, type: "retry", key: o.key, err: e });
                load();
            });
        }
        load().catch(e => {
            console.log("[GMLL]: procedural failure : " + o.key);
            process.send({ cmd: failCMD, type: "system", key: o.key, err: e });
            process.send({ cmd: processCMD, key: o.key });
            return;
        });
    });
}