import { lawyer, getOS, assetTag, throwErr, classPathResolver, getErr, processAssets, getCpuArch, combine } from "./internal/util.js";
import { resolve } from "path";
import { emit, getAssets, getlibraries, getMeta, getNatives, getRuntimes, getUpdateConfig, onUnsupportedArm, __get } from "./config.js";
import cluster from "cluster";
const fork = cluster.fork;
const setupMaster = cluster.setupPrimary || cluster.setupMaster;
import { cpus } from 'os';
import Fetch from 'node-fetch';
import { dir, file, packAsync } from "./objects/files.js";
import { readlinkSync } from "fs";
import type { downloadableFile, versionManifest, runtimeManifestEntry, runtimeManifest, mcRuntimeVal, versionJson, assetIndex, artifact, mojangResourceManifest, mojangResourceFile } from "../types.js";

const processCMD = "download.progress";
const failCMD = "download.fail";
if (cluster.isWorker) console.warn("[GMLL]: Possible worker context leak detected!");
/**
 * Download function. Can be used for downloading modpacks and launcher updates.
 * Checks sha1 hashes and can use multiple cores to download files rapidly. 
 * Untested on Intel's new CPUs, use at own risk and report to me if it breaks. -Hanro50
 * 
 * @param obj The objects that will be downloaded
 * 
 * @param it The retry factor. Will effect how long it takes before the system assumes a crash and restarts. 
 * Lower is better for small files with 1 being the minimum. Higher might cause issues if fetch decides to hang on a download. 
 * Each restart actually increments this value. 
 */
export function download(obj: Partial<downloadableFile>[], it: number = 1) {
    setupMaster({
        exec: __get
    });
    if (it < 1) it = 1;
    emit("download.started");
    obj.sort((a, b) => { return (b.chk.size || 0) - (a.chk.size || 0) });
    var temp = {};

    obj.forEach((e, k) => {
        temp[e.key] = e;
    })

    function resolve() {
        var active = true;
        const totalItems = Object.values(temp).length;
        return new Promise<void>(res => {
            const numCPUs = cpus().length;
            emit("download.setup", numCPUs);
            var done = 0;
            var arr = [];
            const data = Object.values(temp);
            const workers = [];
            const fire = () => workers.forEach(w => w.process.kill());
            for (let i3 = 0; i3 < numCPUs; i3++) {
                var iCpu = [];
                for (let i = i3; i < data.length; i += numCPUs) iCpu.push(data[i]);
                arr.push(iCpu);
            }

            const to = setTimeout(async () => {
                if (!active) return;
                active = false;
                emit('download.restart');
                fire();
                it++;
                res(await resolve());
            }, 15000 * it);

            for (let i = 0; i < arr.length; i++) {

                let cpu = { length: arr[i].length };
                for (var i7 = 0; i7 < arr[i].length; i7++) {
                    cpu["gmll_" + i7] = JSON.stringify(arr[i][i7]);
                }

                const w = fork(cpu);
                workers.push(w);
                w.on('message', (msg) => {
                    if (!msg.cmd) return;
                    if (active) to.refresh();
                    if (msg.cmd === processCMD) {
                        done++;
                        delete temp[msg.key]
                        const left = Object.values(temp).length;
                        emit('download.progress', msg.key, done, totalItems, left);
                        if (left < 1) {
                            active = false;
                            clearTimeout(to);
                            emit('download.done');
                            fire();

                            return res();
                        }
                    }
                    else if (msg.cmd === failCMD) emit(msg.cmd, msg.key, msg.type, msg.err);
                });
            }
        });
    }
    return resolve();
}
/**
 * Installs a set version of Java locally.
 * @param runtime the name of the Java runtime. Based on the names Mojang gave them.
 * @returns This is an asyn function!
 */
export function runtime(runtime: mcRuntimeVal) {
    const meta = getMeta();
    const cfile = meta.runtimes.getFile(runtime + ".json");
    if (!cfile.exists()) {
        throwErr("Cannot find runtime");
    }
    return mojangRFDownloader(cfile.toJSON<mojangResourceManifest>(), getRuntimes().getDir(runtime), getRuntimes().getDir("lzma"))
}
/**
 * Did you know you can use this file to download dungeons?
 * (We prefer not to be sued...so no more details then that)  
 */
export function mojangRFDownloader(file: mojangResourceManifest, baseFile: dir, lzma?: dir) {
    if (!lzma)
        lzma = baseFile.getDir("lzma")

    lzma.mkdir();
    const json = file.files;
    var arr = [];

    Object.keys(json).forEach(key => {
        const obj = json[key];
        var _file = baseFile.getFile(...key.split("/"));
        var _dir = baseFile.getDir(...key.split("/"));
        const name = key.split("/").pop();
        switch (obj.type) {
            case "directory":
                _dir.mkdir();
                break;
            case "file":
                var chk: { size: number; sha1: string; }, opt: { executable?: boolean | string; unzip?: { file: dir; exclude?: string[] } }, url: string;
                opt = { executable: obj.executable }
                if (obj.downloads.lzma) {
                    opt.unzip = { file: _file.dir() }
                    opt.executable = _file.javaPath();
                    const downLoc = assetTag(lzma, obj.downloads.lzma.sha1);
                    _file = downLoc.getFile(obj.downloads.lzma.sha1, name + ".xz");
                    _file.mkdir();


                    url = obj.downloads.lzma.url;
                    chk = { size: obj.downloads.lzma.size, sha1: obj.downloads.lzma.sha1 };
                } else {

                    url = obj.downloads.raw.url;
                    chk = { size: obj.downloads.raw.size, sha1: obj.downloads.raw.sha1 }
                }
                arr.push(_file.toDownloadable(url, key, chk, opt));
                break;
            case "link":
                _file.mkdir();
                if (getOS() != "windows") {
                    _file.rm()

                    _file.linkTo(resolve(..._file.path, obj.target))
                }
            default:
                break;
        }
    });
    return download(arr, 5);
}


/**Install a set version's assets based on a provided asset index. */
export async function assets(index: artifact) {
    const root = getAssets();
    var indexes = root.getDir("indexes").mkdir();
    var file = indexes.getFile(index.id + ".json");
    let assetIndex = (await file.download(index.url, { sha1: index.sha1, size: index.size })).toJSON<assetIndex>()
    var downloader: downloadableFile[] = [];
    const getURL = (obj: { hash: string; size: Number; }) => "http://resources.download.minecraft.net/" + obj.hash.substring(0, 2) + "/" + obj.hash;

    if (assetIndex.map_to_resources) {
        let addin = (path: string | number, sck: { hash: string; size: number; }) => {
            if (!assetIndex[path]) {
                assetIndex.objects[path] = sck;
            }
        }
        addin("icons/icon_16x16.png", { "hash": "bdf48ef6b5d0d23bbb02e17d04865216179f510a", "size": 3665 });
        addin("icons/icon_32x32.png", { "hash": "92750c5f93c312ba9ab413d546f32190c56d6f1f", "size": 5362 });
        addin("icons/minecraft.icns", { "hash": "991b421dfd401f115241601b2b373140a8d78572", "size": 114786 });

        addin("minecraft/icons/icon_16x16.png", { "hash": "bdf48ef6b5d0d23bbb02e17d04865216179f510a", "size": 3665 });
        addin("minecraft/icons/icon_32x32.png", { "hash": "92750c5f93c312ba9ab413d546f32190c56d6f1f", "size": 5362 });
        addin("minecraft/icons/minecraft.icns", { "hash": "991b421dfd401f115241601b2b373140a8d78572", "size": 114786 });
    }

    Object.entries(assetIndex.objects).forEach(o => {
        const key = o[0];
        const obj = o[1];
        if (!obj.ignore)
            downloader.push(assetTag(root.getDir("objects"), obj.hash).getFile(obj.hash).toDownloadable(getURL(obj), key, { sha1: obj.hash, size: obj.size }));
    })
    await download(downloader);
    processAssets(assetIndex);
}
/**Installs the lib files from a set version */
export async function libraries(version: versionJson) {
    const arr: Partial<downloadableFile>[] = [];
    const natives = getNatives();
    natives.rm();
    natives.mkdir();

    const OS = getOS();
    const libraries = version.libraries;
    for (var key = 0; key < libraries.length; key++) {
        var dload: file;
        const e = libraries[key]
        if (e.rules) {
            if (!lawyer(e.rules)) continue;
        }
        if (e.downloads) {
            if (e.downloads.classifiers && e.natives && e.natives[OS] && e.downloads.classifiers[e.natives[OS]]) {
                const art = e.downloads.classifiers[e.natives[OS]];
                var dload2 = getlibraries().getFile(art.path);
                arr.push(dload2.toDownloadable(art.url, art.path, { sha1: art.sha1, size: art.size }, { unzip: { file: natives, exclude: e.extract ? e.extract.exclude : undefined } }));
            }

            if (e.downloads.artifact) {
                if (!e.downloads.artifact.path) {
                    const namespec = e.name.split(":")
                    const path = namespec[0].replace(/\./g, "/") + "/" + namespec[1] + "/" + namespec[2] + "/" + namespec[1] + "-" + namespec[2] + ".jar";
                    e.downloads.artifact.path = path;
                }
                dload = getlibraries().getFile(e.downloads.artifact.path);
                dload.mkdir()
                arr.push(dload.toDownloadable(e.downloads.artifact.url, e.downloads.artifact.path, { sha1: e.downloads.artifact.sha1, size: e.downloads.artifact.size }));
            }
        } else {
            if (!e.url) e.url = "https://libraries.minecraft.net/";
            const path = classPathResolver(e.name);
            const file = getlibraries().getFile(path);
            var sha1: string | string[];

            //Maven repo
            for (var i = 0; i < 3; i++) {
                try {
                    if (e.checksums) {
                        sha1 = e.checksums;
                    } else {
                        const r = await Fetch(e.url + path + ".sha1");
                        if (r.ok) sha1 = await r.text();
                        else continue;
                    }
                    break;
                } catch (e) {
                    console.error(getErr(e));
                }
            }
            arr.push(file.toDownloadable(e.url + path, path, { sha1: sha1 }))
        }
    }
    return await download(arr, 3);
}
export async function getRuntimeIndexes(manifest: runtimeManifest) {
    const runtimes = getMeta().runtimes.mkdir();
    var platform: "gamecore" | "linux" | "linux-i386" | "mac-os" | "mac-os-arm64" | "windows-x64" | "windows-x86" | "linux-arm64" | "linux-arm32" | "windows-arm64";
    switch (getOS()) {
        case ("windows"):
            if (onUnsupportedArm) { platform = "windows-arm64"; break; }
            platform = getCpuArch() == "x64" ? "windows-x64" : "windows-x86"; break;
        case ("linux"):
            if (onUnsupportedArm) { platform = getCpuArch() == "arm" ? "linux-arm32" : "linux-arm64"; break; }
            platform = getCpuArch() == "x64" ? "linux" : "linux-i386"; break;

        case ("osx"):
            if (getCpuArch() == "arm64") {
                platform = "mac-os-arm64";
                //Intel fallback for m1
                console.warn("[GMLL]: Loading intel fallback for M1. Please contact devs if this bugs out.")
                for (const key of Object.keys(manifest[platform]))
                    if (manifest[platform][key].length < 1) manifest[platform][key] = manifest["mac-os"][key];
            } else {
                platform = "mac-os";
            }
            break;
        default: throw ("Unsupported operating system");
    }
    for (const key of Object.keys(manifest[platform])) {
        if (manifest[platform][key].length < 1) continue;
        var obj = manifest[platform][key][0] as runtimeManifestEntry;
        await runtimes.getFile(key + ".json").download(obj.manifest.url, obj.manifest);
    }
}

/**
 * Updates GMLL's manifest files. Used internally
 */
export async function manifests() {
    const forgiacURL = "https://github.com/Hanro50/Forgiac/releases/download/1.8-SNAPSHOT/basic-1.8-SNAPSHOT.jar";
    const forgiacSHA = "https://github.com/Hanro50/Forgiac/releases/download/1.8-SNAPSHOT/basic-1.8-SNAPSHOT.jar.sha1";
    const forgiacPath = ["za", "net", "hanro50", "forgiac", "basic"];

    const fabricLoader = "https://meta.fabricmc.net/v2/versions/loader/";
    const fabricVersions = "https://meta.fabricmc.net/v2/versions/game/";

    const mcRuntimes = "https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json";
    const mcVersionManifest = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";

    const armRuntimes = "https://download.hanro50.net.za/java/index.json"
    const armPatch = "https://download.hanro50.net.za/java/arm-patch.json"


    const update = getUpdateConfig();
    const meta = getMeta();
    interface jsloaderInf {
        "separator": string,
        "build": Number,
        "maven": string,
        "version": string,
        "stable": boolean
    }
    interface jsgameInf {
        version: string; stable: boolean;
    }
    if (onUnsupportedArm) {
        await meta.index.getFile("arm-patch.json").download(armPatch);
    }
    if (update.includes("vanilla")) {
        const r = await Fetch(mcVersionManifest);
        if (r.status == 200) {
            const json: { versions?: [versionManifest], latest?: {} } = await r.json();
            meta.index.getFile("latest.json").write(json.latest);
            meta.manifests.getFile("vanilla.json").write(json.versions);
        }
    }
    if (update.includes("fabric")) {
        try {
            const jsgame = (await meta.index.getFile("fabric_game.json").download(fabricVersions)).toJSON<[jsgameInf]>();
            const jsloader = (await meta.index.getFile("fabric_loader.json").download(fabricLoader)).toJSON<[jsloaderInf]>();
            const result = [];
            jsgame.forEach(game => {
                const version = game.version;
                jsloader.forEach(l => {
                    result.push({
                        id: "fabric-loader-" + l.version + "-" + version,
                        base: version,
                        stable: l.stable,
                        type: "fabric",
                        url: fabricLoader + version + "/" + l.version + "/profile/json"
                    });
                });
            });
            meta.manifests.getFile("fabric.json").write(result);
        } catch (e) {
            console.error(getErr(e));
        }
    }

    if (update.includes("forge")) {
        var libzFolder = getlibraries().getDir(...forgiacPath).mkdir();
        var rURL2 = await Fetch(forgiacSHA);
        if (rURL2.status == 200) {
            await libzFolder.getFile("forgiac.jar").download(forgiacURL, { sha1: await rURL2.text() })
        }
    }
    if (update.includes("runtime")) {
        let manifest = (await meta.index.getFile("runtime.json").download(mcRuntimes)).toJSON<runtimeManifest>();
        getRuntimeIndexes(manifest);
        if (onUnsupportedArm) {
            getRuntimeIndexes((await meta.index.getFile("runtime-Arm.json").download(armRuntimes)).toJSON<runtimeManifest>());
        }
    }
}

/**
 * Used for runtime management
  */
export async function encodeMRF(url: string, root: dir, out: dir) {
    let res: mojangResourceManifest = { files: {} }
    let packed = out.getDir('encoded').mkdir();
    console.log("[GMLL]: Starting to encode as Mojang resource file")
    let tfiles = 0;
    let cfiles = 0;
    emit('encode.start');
    async function encodeDir(path: string, root: dir) {
        const ls = root.ls().sort((a, b) => a.sysPath().length - b.sysPath().length);
        tfiles += ls.length;
        for (let index = 0; index < ls.length; index++) {
            const e = ls[index]
            const directory = [path, e.getName()].join("/")
            cfiles++
            emit('encode.progress', directory, cfiles, tfiles, tfiles - cfiles);
            if (e.islink()) {
                res.files[directory] = {
                    "type": "link",
                    "target": readlinkSync(e.sysPath())
                }
                continue;
            }
            else if (e instanceof file) {
                const rhash = e.getHash();
                e.copyto(packed.getFile(rhash, e.name).mkdir())
                let zip = out.getFile('tmp', e.name + ".7z").mkdir()
                await packAsync(e.sysPath(), zip.sysPath())
                const zhash = zip.getHash();
                let downloadable: mojangResourceFile = {
                    "type": "file",
                    "executable": await e.isExecutable(),
                    "downloads": {
                        "raw": {
                            "sha1": rhash,
                            "size": e.getSize(),
                            "url": [url, rhash, e.name].join("/")
                        }
                    }
                }
                if (zip.getSize() < e.getSize()) {
                    zip = zip.moveTo(packed.getFile(zhash, e.name).mkdir())
                    downloadable.downloads.lzma = {
                        "sha1": zhash,
                        "size": zip.getSize(),
                        "url": [url, zhash, e.name].join("/")
                    }
                } else {
                    zip.rm()
                }
                res.files[directory] = downloadable;
                continue;
            }
            else if (e instanceof dir) {
                res.files[directory] = {
                    "type": "directory",
                }
                await encodeDir(directory, e)
                continue;
            }
        }
    }
    await encodeDir("", root)
    const manifest = out.getFile(root.getName() + "_manifest.json")
    manifest.write(res)

    const mhash = manifest.getHash()
    manifest.copyto(packed.getFile(mhash, "manifest.json").mkdir())
    const index = out.getFile(root.getName() + "_index.json")
    index.write({
        sha1: mhash,
        size: manifest.getSize(),
        url: [url, mhash, "manifest.json"].join("/")
    })
    emit('encode.done');
    out.getDir('tmp').rm();
    return res;
}
