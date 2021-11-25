//Handles mass file downloads
import { existsSync, readFileSync, createWriteStream } from 'fs';
import { join } from 'path';
import Fetch from 'node-fetch';
import { cmd as _cmd } from '7zip-min';
import { chmod, compare } from './util.js';
import { downloadable } from '../downloader.js';
export const processCMD = "download.progress";
export const failCMD = "download.fail";


export function getSelf(): string {
        let self = join(...new URL(import.meta.url).pathname.split("/"));
        return self.substr(process.cwd().length);
}


export async function mutator(o: downloadable): Promise<void> {
    try {
        var path = o.path;
        var name = o.name;
        if (!existsSync(path)) {
            console.error("[GMLL] Does not exist", path);
            return;
        }
        if (o.unzip) {
            if (o.unzip.path) {
                var com = ['x', join(path, name), '-y', '-o' + o.unzip.path]
                if (o.unzip.exclude) {
                    o.unzip.exclude.forEach(e => {
                        var f = String(e);
                        if (f.endsWith("/")) f += "*"
                        com.push("-xr!" + f);
                    })
                }
                await new Promise<void>(e => _cmd(com, (err: any) => { if (err) console.log(err); e() }));
                if (o.unzip.name)
                    name = o.unzip.name;
                path = o.unzip.path
            }
        }
        if (o.executable) {
            chmod(join(path, name));
        }
    } catch (e) { }

}
/**
 * @param {{objects:{[key: string]:{hash:string,size:number}}}} file 
 */
if (process.env.file) {
    /**
     * @type {GMLL.get.downloadable[]}
     */
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