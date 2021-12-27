//Handles mass file downloads
import { existsSync, readFileSync, createWriteStream } from 'fs';
import { join } from 'path';
import Fetch from 'node-fetch';
import { cmd as _cmd } from '7zip-min';
/**@ts-ignore */
import root from './root.cjs';
import { dir, downloadable, file } from '../objects/files.js';
export const processCMD = "download.progress";
export const failCMD = "download.fail";


export function getSelf(): string {
    return join(root, "get.js");
}

//console.log(process.env)
if (process.env.length) {
    //  console.log(process.env)
    const keys: downloadable[] = [];
    for (var i = 0; i < new Number(process.env.length); i++) {
        keys.push(JSON.parse(process.env["gmll_" + i]));
    }
    keys.forEach(o => {
        var retry = 0;
        async function load() {
            await file.process(o);
            /*
            let crash = (e) => {
                if (retry > 3) {
                    process.send({ cmd: processCMD, key: o.key });
                    process.send({ cmd: failCMD, type: "fail", key: o.key, err: e });
                    return;
                }
                retry++;
                process.send({ cmd: failCMD, type: "retry", key: o.key, err: e });
                load();
            }
            const download =
                new Promise((resolve, reject) => {

                    const file = createWriteStream(join(o.path, o.name))
                    try {
                        Fetch(o.url).then(res => {
                            res.body.pipe(file, { end: true });
                            file.on("close", resolve);
                        }).catch(reject);
                    } catch (e) {
                        //Fabric kept bypassing the async catch statements... somehow
                        reject(e);
                    }
                });
            download.then(() => mutator(o))
            download.then(() => process.send({ cmd: processCMD, key: o.key }));

            download.catch(crash);
            */
        }
        load().catch(e => {
            console.log("[GMLL]: procedural failure : " + new dir(...o.path));
            process.send({ cmd: failCMD, type: "system", key: o.path, err: e });
            process.send({ cmd: processCMD, key: o.path });
            return;
        });
    });
}