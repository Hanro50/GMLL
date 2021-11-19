//Handles mass file downloads
import { isWorker } from 'cluster';
import { existsSync, statSync, readFileSync, createWriteStream } from 'fs';
import { join } from 'path';
import Fetch from 'node-fetch';
import { cmd as _cmd } from '7zip-min';

import { createHash } from "crypto";
import { type } from 'os';
import { execSync } from 'child_process';
export const processCMD = "download.progress";
export const failCMD = "download.fail";


/**
 * @param {{objects:{[key: string]:{hash:string,size:number}}}} file 
 */
if (isWorker) {
    /**
     * @type {GMLL.get.downloadable[]}
     */
    const keys = JSON.parse(process.env.data);
    function chmod(dir) {
        if (type() != "Windows_NT")
            execSync('chmod +x ' + dir)
    }
    /**
     * 
     * @param {GMLL.get.downloadable} o 
     * @returns 
     */
    async function mutator(o) {
        try {
            var path = o.path;
            var name = o.name;
            if (!existsSync(path)) {
                console.log("Does not exist", path);
                return;
            }
            if (o.unzip) {
                if (o.unzip.path) {
                    var com = ['x', path, '-y', '-o' + o.extract.path]
                    if (o.unzip.exclude) {
                        o.unzip.exclude.forEach(e => {
                            var f = String(e);
                            if (f.endsWith("/")) f += "*"
                            com.push("-xr!" + f);
                        })
                    }
                    await new Promise(e => _cmd(com, err => { if (err) console.log(err); e() }))
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
    keys.forEach(o => {
        var retry = 0;
        function chk() {
            if (!existsSync(o.path)) return false;
            var stats = statSync(o.path);
            if (!o.size || stats.size != o.size) {
                if (stats.size > 0) console.log("[GMLL]: " + stats.size + " vs " + o.size + " : " + o.key);
                return false;
            }
            if (o.sha1) {
                const sha1 = createHash('sha1').update(readFileSync(o.location)).digest("hex");
                if (o.sha1 != sha1) {
                    console.log("[GMLL]: " + sha1 + " vs " + o.sha1 + " : " + o.key); return false;
                }
            }
            return true;

        }
        async function load() {
            if (chk()) {
                await mutator(o);
                process.send({ cmd: processCMD, key: o.key }); return
            };
            const download =
                new Promise(async e => {
                    const file = createWriteStream(o.location)
                    const res = await Fetch(o.url);
                    res.body.pipe(file, { end: "true" });
                    file.on("close", e);

                });
            download.then(() => mutator(o))
            download.then(() => process.send({ cmd: processCMD, key: o.key }));

            download.catch(e => {
                if (retry > 3) {
                    console.log(e)
                    process.send({ cmd: processCMD, key: o.key });
                    process.send({ cmd: failCMD, type: "fail", key: o.key, err: e });
                    return;
                }
                console.log(e)
                retry++;
                process.send({ cmd: failCMD, type: "retry", key: o.key, err: e });
                load();
            });
        }
        load().catch(e => {
            console.log(e)
            console.log("[GMLL]: procedural failure : " + o.key);
            process.send({ cmd: failCMD, type: "system", key: o.key, err: e });
            process.send({ cmd: processCMD, key: o.key });
            return;
        });
    });
}