//Handles mass file downloads
import { getConfig, getRuntime } from "./config.js";
import { isWorker, setupMaster, fork } from 'cluster';
import { cpus } from 'os';
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync, unlinkSync, symlinkSync } from 'fs';
import { join } from 'path';
import { platform as _platform, arch } from "os";
import { mkdir, lawyer, getOS } from "./internal/util.js";

import Fetch from 'node-fetch';
import { setup } from "../index.js";
const processCMD = "download.progress";
const failCMD = "download.fail";
const config = await getConfig();
/**
 * @param {{objects:{[key: string]:{hash:string,size:number}}}} file 
 */
if (isWorker) { throw "This file can only run on the root thread" }

const defEvents = config.events;
const files = config.files;
const OS = getOS()
setupMaster({
    exec: join(".", "modules", "internal", "rapid.js")
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
    return new Promise(res => {
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
    if (file.map_to_resources) {
        resources = config.metaFiles.assets.resources;
        const merge = new Map([
            ["icons/icon_16x16.png", { "hash": "bdf48ef6b5d0d23bbb02e17d04865216179f510a", "size": 3665 }],
            ["icons/icon_32x32.png", { "hash": "92750c5f93c312ba9ab413d546f32190c56d6f1f", "size": 5362 }],
            ["icons/minecraft.icns", { "hash": "991b421dfd401f115241601b2b373140a8d78572", "size": 114786 }]
        ])
        merge.forEach((v, k) => {
            file.objects[k] = v;
        })
        file.virtual = true;
    } else if (file.virtual) {
        resources = config.metaFiles.assets.virtual;
    } else
        resources = join(basepath, "objects");

    const object = file.objects;
    const keys = Object.keys(object);
    const arr = [];
    mkdir(basepath);
    var resources
    //https://launchermeta.mojang.com/v1/packages/770572e819335b6c0a053f8378ad88eda189fc14/legacy.json

    const objectPath = resources;

    mkdir(objectPath)
    for (let i = 0; i < keys.length; i++) {
        const o = object[keys[i]]

        const root = file.virtual ? keys[i].split("/") : [o.hash.substring(0, 2), o.hash]
        const d = root.pop()

        const location = join(objectPath, ...root);
        mkdir(location);

        const resource = "http://resources.download.minecraft.net/" + o.hash.substring(0, 2) + "/" + o.hash;
        arr.push({ size: o.size, location: join(location, d), url: resource, key: keys[i] });
    }

    const onDone = (key) => { delete file.objects[key]; return Object.keys(file.objects).length; };
    const onTimeOut = (iter) => assets(file, events, iter);
    return await downloader(arr, events, onDone, onTimeOut, r, keys.length);
}

export async function runtime( runtimeName = "all",events = defEvents) {
    const runtime = files.runtimes;
    const meta = join(runtime, "meta");
    mkdir(meta);

    const downloadFolder = join(runtime, "lzma");
    mkdir(downloadFolder);

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

    //Sets up runtime downloader
    const setup = async (e) => {
        grandManifest[e] = {};
        const root = join(runtime, e);
        mkdir(root);
        const libs = manifest[platform][e];
        if (libs.length < 1) return;
        const lib = libs[0];
        const libjsonfile = join(meta, e + ".json");
        var runManifest
        if (!existsSync(libjsonfile) || statSync(libjsonfile).size != lib.manifest.size) {
            const ljf = await Fetch(lib.manifest.url);
            if (ljf.status != 200) return;
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
                    mkdir(file); break;
                case ("file"):
                    if (todoobj.downloads.lzma) {
                        const fn = rawPath.pop()
                        const container = join(...rawPath);
                        const hash = todoobj.downloads.lzma.sha1;
                        // const loc1 = join(downloadFolder, hash.substring(0, 2));
                        // mkdir(loc1);
                        const loc2 = join(join(downloadFolder, hash.substring(0, 2)), hash.substring(2));
                        mkdir(loc2);
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
    if (gamecore.includes(runtimeName)) await setup(runtimeName)
    else for (var id = 0; id < gamecore.length; id++) await setup(gamecore[id]);


    async function ddload(r = 3) {
        const onDone = (key) => { delete toDownLoad[key]; return Object.keys(toDownLoad).length; };
        await downloader(Object.values(toDownLoad), events, onDone, ddload, r, Object.keys(toDownLoad).length);
    }
    await ddload();
}
/**
 * @param  {GMLL.version.structure} versionJSON 
 * @param {*} events 
 * @param {*} r 
 */
export async function libs(versionJSON, events = defEvents, r = 1) {
    const libArray = versionJSON.libraries
    /**@type {Array<GMLL.artifact>} */
    var LibFiles = {};
    console.log("Checking rules");
    var nativeFolder = join(files.natives, versionJSON.id)

    mkdir(nativeFolder);
    for (var key = 0; key < libArray.length; key++) {

        const e = libArray[key]
        if (e.rules) {
            if (!lawyer(e.rules)) continue;
        }
        if (e.downloads) {
            if (e.downloads.classifiers && e.natives && e.natives[OS] && e.downloads.classifiers[e.natives[OS]]) {
                const obj = e.downloads.classifiers[e.natives[OS]];
                obj.extract = e.extract || {};
                obj.extract.path = nativeFolder
                LibFiles[obj.path] = obj;

            }

            if (e.downloads.artifact) {
                if (!e.downloads.artifact.path) {
                    const namespec = e.name.split(":")
                    const path = namespec[0].replace(/\./g, "/") + "/" + namespec[1] + "/" + namespec[2] + "/" + namespec[1] + "-" + namespec[2] + ".jar";
                    e.downloads.artifact.path = path;
                }
                LibFiles[e.downloads.artifact.path] = (e.downloads.artifact);
            }
        } else if (e.url) {
            //Maven repo
            const namespec = e.name.split(":")
            const path = namespec[0].replace(/\./g, "/") + "/" + namespec[1] + "/" + namespec[2] + "/" + namespec[1] + "-" + namespec[2] + ".jar";
            console.log(path)
            const r = await Fetch(e.url + path + ".sha1")
            /**@type {GMLL.artifact} */
            var artifact = { path: path, sha1: await r.text(), url: e.url + path }
            LibFiles[path] = (artifact);
        } else {
            console.log(e)
        }
    }


    const libIndex = []
    function load() {
        const arr = []
        Object.values(LibFiles).forEach(e => {
            var file = files.libraries;
            const filz = String(e.path).split("/");
            //console.log(path.join(file, ...filz));
            const locPath = join(file, ...filz);
            var art = { extract: e.extract, size: e.size, location: locPath, url: e.url, key: e.path, sha: e.sha1 }
            libIndex.push(locPath)
            arr.push(art)
            for (var fff = 0; fff < filz.length - 1; fff++) {
                file = join(file, filz[fff]);
                //  console.log(file);
                mkdir(file);
            }
        })
        const onDone = (key) => { delete LibFiles[key]; return Object.keys(LibFiles).length; };
        return downloader(arr, events, onDone, load, 2, Object.keys(LibFiles).length);
    }
    await load();
    mkdir(config.metaFiles.launcher.libIndex);
    const indexFiles = join(config.metaFiles.launcher.libIndex, versionJSON.id + ".json");
    writeFileSync(indexFiles, JSON.stringify(libIndex));
}




