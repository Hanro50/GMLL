//Handles mass file downloads
import { isWorker } from 'cluster';
import { chmodSync, existsSync, statSync, readFileSync, createWriteStream } from 'fs';
import { join } from 'path';
import Fetch from 'node-fetch';
import { cmd as _cmd } from '7zip-min';
const processCMD = "download.progress";
const failCMD = "download.fail";
import { createHash } from "crypto";
/**
 * @param {{objects:{[key: string]:{hash:string,size:number}}}} file 
 */
if (isWorker) {
    const keys = JSON.parse(process.env.data);

    async function mutator(o) {
        try {
            var loc = o.location;
            if (!existsSync(loc)) {
                console.log("Does not exist", loc);
               return;
            }
            if (o.extract) {
                if (o.extract.path) {
                    var com = ['x', loc, '-y', '-o' + o.extract.path]
                    if (o.extract.exclude) {
                        o.extract.exclude.forEach(e => {
                            var f = String(e);
                            if (f.endsWith("/")) f += "*"
                            com.push("-xr!" + f);
                        })
                    }
                    await new Promise(e => _cmd(com, err => { if (err) console.log(err); e() }))
                    if (o.extract.file)
                        loc = join(o.extract.path, o.extract.file);
                    else
                        loc = o.extract.path
                }
            }
            if (o.executable) {
                chmodSync(loc, 777);
                console.log(loc)
            } 
        } catch (e) { }

    }
    keys.forEach(o => {
        var retry = 0;
        function chk(){
            
                if (!existsSync(o.location)) return false;
                var stats = statSync(o.location);
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