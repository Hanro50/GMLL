//Handles mass file downloads
import { getConfig, getRuntime } from "./config.js";
import { isWorker, setupMaster, fork } from 'cluster';
import { cpus } from 'os';
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync, unlinkSync, symlinkSync } from 'fs';
import { join } from 'path';
import { platform as _platform, arch } from "os";

import Fetch from 'node-fetch';
const processCMD = "download.progress";
const failCMD = "download.fail";
const config = await getConfig();
/**
 * @param {{objects:{[key: string]:{hash:string,size:number}}}} file 
 */
if (isWorker) { throw "This file can only run on the root thread" }

const defEvents = config.events;
const files = config.files;
const OS = _platform();
if (OS == "win32" || OS == "win64") OS = "windows";
if (OS == "darwin") OS = "osx"
setupMaster({
    exec: join(".","modules","internal", "rapid.js")
});
/**
* 
* @param {Array<{size: Number, location: string, url: string, key:string,sha1?:string}>} data 
* @param {EventEmitter} events 
* @param {(key:string)=>Number} onDone 
* @param {(Number)=>Promise<any>} onTimeOut 
* @param {Number} iterations 
* @param {Number} totalItems 
* @returns 
*/
export function downloader(data, events, onDone, onTimeOut, iterations, totalItems) {
    const numCPUs = cpus().length;
    var done = 0;
    var arr = [];
    events.emit("download.setup", numCPUs);
    data.sort((a, b) => b.size - a.size);
    for (let i3 = 0; i3 < numCPUs; i3++) {
        var iCpu = [];
        for (let i = i3; i < data.length; i += numCPUs) iCpu.push(data[i]);
        arr.push(iCpu);
    }
    return new Promise( res => {
        /**@type {Array<cluster.Worker>} */
        const workers = [];
        const fire = () => workers.forEach(w => w.process.kill());
        const to = setTimeout(async () => {
            events.emit('download.restart');
            fire();
            iterations++;
            res(await onTimeOut(iterations));
        }, 15000 * iterations);
        events.emit('download.start');
        for (let i = 0; i < arr.length; i++) {
            const w = fork({ "data": JSON.stringify(arr[i]) });
            workers.push(w);
            w.on('message', (msg) => {
                to.refresh();
                if (!msg.cmd) return;
                if (msg.cmd === processCMD) {
                    done++;
                    const left = onDone(msg.key);
                    events.emit('download.progress', msg.key, done, totalItems, left);
                    if (left < 1) {
                        clearTimeout(to);
                        events.emit('download.done');
                        fire();
                        res();
                    }
                }
                else if (msg.cmd === failCMD) events.emit('download.fail', msg.key, msg.type, msg.err);
            });
        }
    });
}
export async function assets(file, events = defEvents, r = 1) {
    const basepath = files.assets;
    const object = file.objects;
    const objectPath = join(basepath, "objects");
    if (!existsSync(basepath)) { mkdirSync(basepath); }
    if (!existsSync(objectPath)) { mkdirSync(objectPath); }
    Object.values(object).forEach(o => {
        const folder = join(objectPath, o.hash.substring(0, 2));
        if (!existsSync(folder)) { mkdirSync(folder); }
    })
    const keys = Object.keys(object);
    const arr = [];
    for (let i = 0; i < keys.length; i++) {
        const o = object[keys[i]]
        const resource = "http://resources.download.minecraft.net/" + o.hash.substring(0, 2) + "/" + o.hash;
        const location = join(join(objectPath, o.hash.substring(0, 2)), o.hash);
        arr.push({ size: o.size, location: location, url: resource, key: keys[i] });
    }
    const onDone = (key) => { delete file.objects[key]; return Object.keys(file.objects).length; };
    const onTimeOut = (iter) => this.assets(file, events, iter);
    return await downloader(arr, events, onDone, onTimeOut, r, keys.length);
}

export async function runtime(events = defEvents) {
    const runtime = files.runtimes;
    const meta = join(runtime, "meta");
    if (!existsSync(meta)) { mkdirSync(meta); }

    const downloadFolder = join(runtime, "lzma");
    if (!existsSync(downloadFolder)) { mkdirSync(downloadFolder); }

    const manifest = getRuntime();
    const gamecore = Object.keys(manifest.gamecore);
    var platform;

    switch (OS) {
        case ("osx"):
            platform = "mac-os"; break
        case ("linux"):
            platform = arch() == "x64" ? "linux" : "linux-i386"; break;
        case ("windows"):
            platform = arch() == "x64" ? "windows-x64" : "windows-x86"; break;
        default: throw ("Unsupported operating system");
    }
    const toDownLoad = {}
    const grandManifest = {};
    for (var id = 0; id < gamecore.length; id++) {
        const e = gamecore[id]
        grandManifest[e] = {};
        const root = join(runtime, e);
        if (!existsSync(root)) mkdirSync(root);
        const libs = manifest[platform][e];
        if (libs.length < 1) continue;
        const lib = libs[0];
        const libjsonfile = join(meta, e + ".json");
        var runManifest
        if (!existsSync(libjsonfile) || statSync(libjsonfile).size != lib.manifest.size) {
            const ljf = await Fetch(lib.manifest.url);
            if (ljf.status != 200) continue;
            const ljff = await ljf.text();
            writeFileSync(libjsonfile, ljff);
            runManifest = JSON.parse(ljff).files;
            console.log(ljff)
        } else { runManifest = JSON.parse(readFileSync(libjsonfile)).files }
        Object.keys(runManifest).forEach(rmk => {
            const todoobj = runManifest[rmk]
            const rawPath = [root, ...rmk.split("/")]
            const file = join(...rawPath);
            switch (todoobj.type) {
                case ("directory"):
                    if (!existsSync(file)) mkdirSync(file); break;
                case ("file"):
                    if (todoobj.downloads.lzma) {
                        const fn = rawPath.pop()
                        const container = join(...rawPath);
                        const hash = todoobj.downloads.lzma.sha1;
                        const loc1 = join(downloadFolder, hash.substring(0, 2));
                        if (!existsSync(loc1)) mkdirSync(loc1);
                        const loc2 = join(loc1, hash.substring(2));
                        if (!existsSync(loc2)) mkdirSync(loc2);
                        toDownLoad[e + ":" + rmk] = {
                            extract: { path: container, file: fn },
                            executable: todoobj.executable,
                            key: e + ":" + rmk,
                            location: join(loc2, fn + ".xz"),
                            size: todoobj.downloads.lzma.size,
                            sha1: hash,
                            url: todoobj.downloads.lzma.url
                        };
                        break;
                    }
                    toDownLoad[e + ":" + rmk] = {
                        executable: todoobj.executable,
                        key: e + ":" + rmk,
                        location: file,
                        size: todoobj.downloads.raw.size,
                        sha1: todoobj.downloads.raw.sha1,
                        url: todoobj.downloads.raw.url
                    };
                    break;
                case ("link"):
                    try {
                        if (existsSync(file)) unlinkSync(file);
                        symlinkSync(join(...todoobj.target.split("/")), file);
                    } catch { }
                    break;
                default: console.error("[GMLL]: Unknown file type => " + todoobj.type);
            }
        })
    }
    async function ddload(r = 3) {
        const onDone = (key) => { delete toDownLoad[key]; return Object.keys(toDownLoad).length; };
        await downloader(Object.values(toDownLoad), events, onDone, ddload, r, Object.keys(toDownLoad).length);
    }
    await ddload();
}
/**
 * @param  {{libraries:Array<GMLL.libFiles>,id:string,assets:string}} versionJSON 
 * @param {*} events 
 * @param {*} r 
 */
export async function libs(versionJSON, events = defEvents, r = 1) {
    const libArray = versionJSON.libraries
    /**@type {Array<GMLL.artifact>} */
    var LibFiles = {};
    console.log("Checking rules");
    var nativeFolder = join(files.natives, versionJSON.assets || versionJSON.id)

    if (!existsSync(nativeFolder)) mkdirSync(nativeFolder);
    for (var key = 0; key < libArray.length; key++) {
        rule: {
            const e = libArray[key]
            if (e.rules) {
                for (var i = 0; i < e.rules.length; i++) {
                    if (e.rules[i].action == "disallow" && (!e.rules[i].os || e.rules[i].os == OS)) {
                        console.log(e.rules)
                        break  rule;
                    }
                    else if (e.rules[i].action == "allow" && e.rules[i].os && e.rules[i].os != OS) {
                        console.log(e.rules)
                        break  rule;
                    }
                }
            }
            if (e.downloads) {
                if (e.downloads.classifiers && e.natives && e.natives[OS] && e.downloads.classifiers[e.natives[OS]]) {
                    const obj = e.downloads.classifiers[e.natives[OS]];
                    obj.extract = e.extract || {};

                    obj.extract.path = nativeFolder

                    LibFiles[obj.path] = obj;

                }
                LibFiles[e.downloads.artifact.path] = (e.downloads.artifact);
            } else if (e.url) {
                //Maven repo
                const namespec = e.name.split(":")
                const path = namespec[0].replace(/\./g, "/") + "/" + namespec[1] + "/" + namespec[2] + "/" + namespec[1] + "-" + namespec[2] + ".jar";
                const r = await fetch(path + ".sha1")
                /**@type {GMLL.artifact} */
                var artifact = { path: path, sha1: await r.text(), url: e.url + path }
                LibFiles[path] = (artifact);
            } else {
                console.log(e)
            }
        }
    }

    console.log("Checking rules");

    function load() {
        const arr = []
        Object.values(LibFiles).forEach(e => {
            var file = files.libraries;
            const filz = String(e.path).split("/");
            //console.log(path.join(file, ...filz));
            var art = { extract: e.extract, size: e.size, location: join(file, ...filz), url: e.url, key: e.path, sha: e.sha1 }

            arr.push(art)
            for (var fff = 0; fff < filz.length - 1; fff++) {
                file = join(file, filz[fff]);
                //  console.log(file);
                if (!existsSync(file)) mkdirSync(file);
            }
        })
        const onDone = (key) => { delete LibFiles[key]; return Object.keys(LibFiles).length; };
        return downloader(arr, events, onDone, load, 2, Object.keys(LibFiles).length);
    }
    await load();
}




