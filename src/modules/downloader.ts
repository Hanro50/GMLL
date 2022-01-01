import { lawyer, getOS, assetTag, throwErr, classPathResolver, getErr, combine, processAssets } from "./internal/util.js";
import { join } from "path";
import { emit, getAssets, getlibraries, getMeta, getNatives, getRuntimes, getUpdateConfig } from "./config.js";
import { processCMD, failCMD, getSelf } from "./internal/get.js"
//Handles mass file downloads
import cluster from "cluster";
const fork = cluster.fork;
const setupMaster = cluster.setupPrimary || cluster.setupMaster;
import { cpus, arch } from 'os';
//import { readFileSync, copyFileSync } from "fs";
import Fetch from 'node-fetch';
import { assetIndex, assets, manifest, runtimeFILE, runtimeManifest, runtimeManifests, runtimes, version } from "../index.js";
import { dir, downloadable, file, mklink } from "./objects/files.js";


setupMaster({
    exec: getSelf()
});
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
export function download(obj: Partial<downloadable>[], it: number = 1) {
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
        // console.trace();
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

            //     const tmpRoot = join(getMeta().temp);
            //   rmdir(tmpRoot)
            // mkdir(tmpRoot);
            for (let i = 0; i < arr.length; i++) {
                //   const tmp = join(tmpRoot, i + ".json");
                // writeJSON(tmp, arr[i]);
                let cpu = { length: arr[i].length };
                for (var i7 = 0; i7 < arr[i].length; i7++) {
                    cpu["gmll_" + i7] = JSON.stringify(arr[i][i7]);
                }
                console.log(cpu)
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
export function runtime(runtime: runtimes) {
    const meta = getMeta();
    const cfile = meta.runtimes.getFile(runtime + ".json");
    if (!cfile.exists()) {
        throwErr("Cannot find runtime");
    }
    const json = cfile.toJSON<runtimeFILE>().files;
    var arr = [];
    const lzma = getRuntimes().getDir("lzma");
    lzma.mkdir();
    let linkz: { target: string, path: string }[] = [];
    Object.keys(json).forEach(key => {
        const obj = json[key];
        var _file = getRuntimes().getFile(runtime, ...key.split("/"));
        var _dir = getRuntimes().getDir(runtime, ...key.split("/"));

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


                arr.push(_file.toDownloadable(url, name, chk, opt));
                break;
            case "link":
                _file.mkdir();
                if (getOS() != "windows") {

                    mklink(join(..._file.path, obj.target), _file.sysPath());
                }
                break;
            default:
                break;
        }
    });
    return download(arr, 5);


}
/**Install a set version's assets based on a provided asset index. */
export async function assets(index: assetIndex) {
    const root = getAssets();
    var indexes = root.getDir("indexes").mkdir();
    var file = indexes.getFile(index.id + ".json");
    let assetIndex = (await file.download(index.url, { sha1: index.sha1, size: index.size })).toJSON<assets>()
    var downloader: downloadable[] = [];
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



export async function libraries(version: version) {
    const arr: Partial<downloadable>[] = [];
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
                /*
                                dload2.unzip = { exclude: e.extract ? e.extract.exclude : undefined, path: natives };
                                dload2.name = rawPath.pop().toString();
                                dload2.path = join(...rawPath);
                
                                dload2.sha1 = art.sha1;
                                dload2.url = art.url
                                dload2.size = art.size;
                                dload2.key = art.path;
                                */
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
                /*
                 dload.sha1 = e.downloads.artifact.sha1;
                 dload.url = e.downloads.artifact.url
                 dload.size = e.downloads.artifact.size;
                 dload.key = e.downloads.artifact.path;
                 */
                arr.push(dload.toDownloadable(e.downloads.artifact.url, e.downloads.artifact.path, { sha1: e.downloads.artifact.sha1, size: e.downloads.artifact.size }));
            }
        } else {
            if (!e.url) e.url = "https://libraries.minecraft.net/";
            const path = classPathResolver(e.name);
            const file = getlibraries().getFile(path); // [getlibraries(), ...path.split("/")];

            var sha1: string | string[];

            //Maven repo
            for (var i = 0; i < 3; i++) {
                try {
                    console.log(e)
                    if (e.checksums) {
                        sha1 = e.checksums;
                    } else {
                        const r = await Fetch(e.url + path + ".sha1");
                        if (r.ok) sha1 = await r.text();
                        else continue;
                    }
                    break;
                } catch (e) {
                    console.log(getErr(e));
                }
            }
            arr.push(file.toDownloadable(e.url + path, path, { sha1: sha1 }))
        }
    }
    return await download(arr, 3);
}



export async function manifests() {
    const forgiacURL = "https://github.com/Hanro50/Forgiac/releases/download/1.7-SNAPSHOT/Forgiac-basic-1.7-SNAPSHOT.jar";
    const forgiacSHA = "https://github.com/Hanro50/Forgiac/releases/download/1.7-SNAPSHOT/Forgiac-basic-1.7-SNAPSHOT.jar.sha1";
    const forgiacPath = ["za", "net", "hanro50", "forgiac", "basic"];

    const fabricLoader = "https://meta.fabricmc.net/v2/versions/loader/";
    const fabricVersions = "https://meta.fabricmc.net/v2/versions/game/";

    const mcRuntimes = "https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json";
    const mcVersionManifest = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
    /*
     const mcLog4jFix_1 = "https://launcher.mojang.com/v1/objects/dd2b723346a8dcd48e7f4d245f6bf09e98db9696/log4j2_17-111.xml";
     const mcLog4jFix_2 = "https://launcher.mojang.com/v1/objects/02937d122c86ce73319ef9975b58896fc1b491d1/log4j2_112-116.xml";
 
 */
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
    if (update.includes("vanilla")) {
        const r = await Fetch(mcVersionManifest);
        if (r.status == 200) {
            const json: { versions?: [manifest], latest?: {} } = await r.json();
            meta.index.getFile("latest.json").write(json.latest);
            meta.manifests.getFile("vanilla.json").write(json.versions);
        }
        /*
        const a = await Fetch(mcLog4jFix_1);
        write(join(meta.index, "log4j-fix-1.xml"), await a.text());
        const ab = await Fetch(mcLog4jFix_2);
        write(join(meta.index, "log4j-fix-2.xml"), await ab.text());
        */
    }
    if (update.includes("fabric")) {
        try {
            const jsgame = (await meta.index.getFile("fabric_game.json").download(fabricVersions)).toJSON<[jsgameInf]>();  //await loadSave<[jsgameInf]>(fabricVersions, join(meta.index, "fabric_game.json"));
            const jsloader = (await meta.index.getFile("fabric_loader.json").download(fabricLoader)).toJSON<[jsloaderInf]>();  //await loadSave<[jsloaderInf]>(fabricLoader, join(meta.index, "fabric_loader.json"));
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
            //writeJSON(join(meta.manifests, "fabric.json"), result);
        } catch (e) {
            console.log(getErr(e));
        }
    }
    if (update.includes("forge")) {
        var libzFolder = getlibraries().getDir(...forgiacPath).mkdir();
        //   mkdir(libzFolder);

        var rURL2 = await Fetch(forgiacSHA);

        if (rURL2.status == 200) {
            await libzFolder.getFile("forgiac.jar").download(forgiacURL, { sha1: await rURL2.text() })
            // await chkFileDownload({ key: "forgiac", name: "forgiac.jar", url: forgiacURL, path: libzFolder, sha1: await rURL2.text() });
        }
    }
    if (update.includes("runtime")) {
        const meta = getMeta();
        //  const mf =   //  await loadSave(mcRuntimes, join(meta.index, "runtime.json"));
        const manifest = (await meta.index.getFile("runtime.json").download(mcRuntimes)).toJSON<runtimeManifests>();

        var platform: "gamecore" | "linux" | "linux-i386" | "mac-os" | "windows-x64" | "windows-x86";

        switch (getOS()) {
            case ("osx"):
                platform = "mac-os"; break;
            case ("linux"):
                platform = arch() == "x64" ? "linux" : "linux-i386"; break;
            case ("windows"):
                platform = arch() == "x64" ? "windows-x64" : "windows-x86"; break;
            default: throw ("Unsupported operating system");
        }
        for (const key of Object.keys(manifest[platform])) {
            if (manifest[platform][key].length < 1) continue;
            var obj = manifest[platform][key][0] as runtimeManifest;
            // obj.key = key;
            // obj.path = meta.runtimes;
            // obj.name = key + ".json";
            await meta.runtimes.getFile(key + ".json").download(obj.manifest.url, obj.manifest);
            //if (!compare(obj)) {
            //     await loadSave(obj.url, join(obj.path, obj.name), true);
            // }
        }
    }

}
