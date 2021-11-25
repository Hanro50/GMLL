import { mkdir, lawyer, getOS, loadSave, compare, assetTag, mklink, chkLoadSave, rmdir, stringify, writeJSON } from "./internal/util.js";
import { join } from "path";
import { emit, getAssets, getlibraries, getMeta, getNatives, getRuntimes, getUpdateConfig } from "./config.js";
import { processCMD, failCMD, getSelf } from "./internal/get.js"
//Handles mass file downloads
import cluster from "cluster";
const fork = cluster.fork;
const setupMaster = cluster.setupPrimary || cluster.setupMaster;
import { cpus, arch, tmpdir } from 'os';
import { readFileSync, createWriteStream, copyFileSync } from "fs";
import Fetch from "node-fetch";
import { assetIndex, assets, manifest, runtimes, version } from "../index.js";

export interface downloadable {

    path: string,
    url: string,
    name: string,
    unzip?: {
        exclude?: string[],
        name?: string
        path: string,

    }
    size?: number,
    sha1?: String,
    executable?: boolean,
    /**Internally used to identify object: 
           * May not be constant */
    key: string
}

setupMaster({
    exec: getSelf()
});
/**
 * The root download function
 */
export function download(obj: Partial<downloadable>[], it: number = 1) {
    if (it < 1) it = 1;
    emit("download.started");
    obj.sort((a, b) => { return (b.size || 0) - (a.size || 0) });
    console.log(obj);
    var temp = {};

    obj.forEach((e, k) => {
        e.key = e.key || join(e.path, e.name);
        if (e.path == null) {
            console.log(e)
            process.exit()
        }
        mkdir(e.path);
        if (e.unzip) mkdir(e.unzip.path);
        temp[e.key] = e;
    })

    function resolve() {
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
                emit('download.restart');
                fire();
                it++;
                res(await resolve());
            }, 15000 * it);

            const tmpRoot = join(getMeta().temp);
            rmdir(tmpRoot)
            mkdir(tmpRoot);
            for (let i = 0; i < arr.length; i++) {
                const tmp = join(tmpRoot, i + ".json");

                writeJSON(tmp, arr[i]);
                const w = fork({ "file": tmp });
                workers.push(w);
                w.on('message', (msg) => {
                    to.refresh();
                    if (!msg.cmd) return;
                    if (msg.cmd === processCMD) {
                        done++;
                        delete temp[msg.key]
                        const left = Object.values(temp).length;
                        emit('download.progress', msg.key, done, totalItems, left);
                        if (left < 1) {
                            clearTimeout(to);

                            emit('download.done');
                            fire();
                            res();
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
 * 
 * @param {GMLL.runtimes} runtime 
 */
export function runtime(runtime:runtimes) {
    const meta = getMeta();
    const file = join(meta.runtimes, runtime + ".json");
    if (!file) {
        throw "Cannot find runtime"
    }
    /**@type {GMLL.json.version} */
    const json = JSON.parse(readFileSync(file).toString()).files;
    var arr = [];
    const lzma = join(getRuntimes(), "lzma");
    mkdir(lzma);
    Object.keys(json).forEach(key => {
        const obj = json[key];
        var path = [getRuntimes(), runtime, ...key.split("/")]
        const FullPath = join(...path);
        const name = path.pop();
        const filePath = join(...path);
        switch (obj.type) {
            case "directory":
                mkdir(FullPath)
                break;
            case "file":
                var dload: Partial<downloadable> = {};
                if (obj.downloads.lzma) {
                    const downLoc = assetTag(lzma, obj.downloads.lzma.sha1);
                    dload.path = join(downLoc, obj.downloads.lzma.sha1);
                    mkdir(dload.path);
                    dload.url = obj.downloads.lzma.url;
                    dload.name = name + ".xz";
                    dload.unzip = { path: filePath, name: name };
                    dload.size = obj.downloads.lzma.size;
                    dload.sha1 = obj.downloads.lzma.sha1;
                } else {
                    dload.path = filePath;
                    dload.url = obj.downloads.raw.url;
                    dload.name = name;

                    dload.size = obj.downloads.raw.size;
                    dload.sha1 = obj.downloads.raw.sha1;
                }
                dload.executable = obj.executable;
                dload.key = FullPath;
                arr.push(dload);
                break;
            case "link":
                if (getOS() != "windows")
                    mklink(obj.target, FullPath)
                break;
            default:
                break;
        }
    });
    return download(arr, 5);
}

export async function assets(index: assetIndex) {
    console.trace();
    const root = getAssets();
    var findex = join(root, "indexes");
    mkdir(findex);
    findex = join(findex, index.id + ".json");
    const assetIndex = await chkLoadSave<assets>(index.url, findex, index.sha1, index.size);
    var downloader: downloadable[] = [];
    const getURL = (obj: { hash: string; size: Number; }) => "http://resources.download.minecraft.net/" + obj.hash.substring(0, 2) + "/" + obj.hash;
    if (assetIndex.map_to_resources) {
        assetIndex.objects["icons/icon_16x16.png"] = { "hash": "bdf48ef6b5d0d23bbb02e17d04865216179f510a", "size": 3665 };
        assetIndex.objects["icons/icon_32x32.png"] = { "hash": "92750c5f93c312ba9ab413d546f32190c56d6f1f", "size": 5362 };
        assetIndex.objects["icons/minecraft.icns"] = { "hash": "991b421dfd401f115241601b2b373140a8d78572", "size": 114786 };
    }
    Object.entries(assetIndex.objects).forEach(o => {
        const key = o[0];
        const obj = o[1];
        downloader.push({ key: key, path: assetTag(join(root, "objects"), obj.hash), name: obj.hash, url: getURL(obj), sha1: obj.hash, size: obj.size });

    })
    await download(downloader);

    if (assetIndex.virtual || assetIndex.map_to_resources) {
        const file = join(root, "legacy", assetIndex.virtual ? "virtual" : "resources");
        mkdir(file);

        Object.entries(assetIndex.objects).forEach(o => {
            const key = o[0];
            const obj = o[1];
            const rawPath = [file, ...key.split("/")]
            const name = rawPath.pop();
            const path = join(...rawPath);
            mkdir(path)
            copyFileSync(join(assetTag(join(root, "objects"), obj.hash), obj.hash), join(path, name));
        })
    }

}
/**
 * @param {GMLL.json.version} version 
 * @param {GMLL.get.downloadable} download_jar 
 */
export async function libraries(version: version, download_jar: downloadable) {
    const arr: Partial<downloadable>[] = [download_jar];
    const natives = getNatives();
    rmdir(natives);
    mkdir(natives);
    const index = join(getMeta().libraries, download_jar.key + ".json");

    const classPath: string[] = [];
    const OS = getOS();
    const libraries = version.libraries;
    for (var key = 0; key < libraries.length; key++) {
        /**@type {GMLL.get.downloadable} */
        var dload: Partial<downloadable> = {};
        const e = libraries[key]
        if (e.rules) {
            if (!lawyer(e.rules)) continue;
        }
        if (e.downloads) {
            if (e.downloads.classifiers && e.natives && e.natives[OS] && e.downloads.classifiers[e.natives[OS]]) {
                const art = e.downloads.classifiers[e.natives[OS]];
                const rawPath = [getlibraries(), ...art.path.split("/")];
                var dload2: Partial<downloadable> = {};

                dload2.unzip = { exclude: e.extract ? e.extract.exclude : undefined, path: natives };


                dload2.name = rawPath.pop();
                dload2.path = join(...rawPath);

                dload2.sha1 = art.sha1;
                dload2.url = art.url
                dload2.size = art.size;
                dload2.key = art.path;
                classPath.push(join(dload2.path, dload2.name));
                arr.push(dload2);
            }

            if (e.downloads.artifact) {
                if (!e.downloads.artifact.path) {
                    const namespec = e.name.split(":")
                    const path = namespec[0].replace(/\./g, "/") + "/" + namespec[1] + "/" + namespec[2] + "/" + namespec[1] + "-" + namespec[2] + ".jar";
                    e.downloads.artifact.path = path;
                }
                const rawPath = [getlibraries(), ...e.downloads.artifact.path.split("/")];
                console.log(rawPath)
                dload.name = rawPath.pop();
                dload.path = join(...rawPath);
                mkdir(dload.path);
                dload.sha1 = e.downloads.artifact.sha1;
                dload.url = e.downloads.artifact.url
                dload.size = e.downloads.artifact.size;
                dload.key = e.downloads.artifact.path;
                classPath.push(join(dload.path, dload.name));
                arr.push(dload);
            }
        } else if (e.url) {
            const namespec = e.name.split(":")
            const path = namespec[0].replace(/\./g, "/") + "/" + namespec[1] + "/" + namespec[2] + "/" + namespec[1] + "-" + namespec[2] + ".jar";
            const rawPath = [getlibraries(), ...path.split("/")];
            dload.name = rawPath.pop();
            dload.path = join(...rawPath);
            dload.url = e.url + path;
            //Maven repo
            const r = await Fetch(e.url + path + ".sha1");
            dload.sha1 = await r.text();
            classPath.push(join(dload.path, dload.name));
            arr.push(dload);
        } else {
            console.log(e)
        }

    }
    classPath.push(join(download_jar.path, download_jar.name));
    writeJSON(index, classPath);


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
            const json:{versions?:[manifest],latest?:{}} = await r.json();
            console.log(json);
            writeJSON(join(meta.index, "latest.json"), json.latest);
            writeJSON(join(meta.manifests, "vanilla.json"), json.versions);
        }
    }
    if (update.includes("fabric")) {
        const jsgame = await loadSave<[jsgameInf]>(fabricVersions, join(meta.index, "fabric_game.json"));
        const jsloader = await loadSave<[jsloaderInf]>(fabricLoader, join(meta.index, "fabric_loader.json"));
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
        writeJSON(join(meta.manifests, "fabric.json"), result);

    }
    if (update.includes("forge")) {
        var libzFolder = join(getlibraries(), ...forgiacPath);
        mkdir(libzFolder);

        var rURL2 = await Fetch(forgiacSHA);
        console.log(rURL2);
        if (rURL2.status == 200 && !compare({ key: "forgiac", name: "forgiac.jar", url: forgiacURL, path: libzFolder, sha1: await rURL2.text() })) {
            await new Promise(async e => {
                console.log("Downloading forgiac");
                const file = createWriteStream(join(libzFolder,"forgiac.jar"));
                const res = await Fetch(forgiacURL);
                res.body.pipe(file, { end: true });
                file.on("close", e);
            });
        }
    }
    if (update.includes("runtime")) {
        const meta = getMeta();
        const manifest = await loadSave(mcRuntimes, join(meta.index, "runtime.json"));
        var platform;

        switch (getOS()) {
            case ("osx"):
                platform = "mac-os"; break;
            case ("linux"):
                platform = arch() == "x64" ? "linux" : "linux-i386"; break;
            case ("windows"):
                platform = arch() == "x64" ? "windows-x64" : "windows-x86"; break;
            default: throw ("Unsupported operating system");
        }
        //Object.keys(manifest[platform]).forEach(k => 
        console.log(manifest)
        for (const key of Object.keys(manifest[platform])) {
            /**@type {GMLL.get.downloadable} */
            console.log(key);
            if (manifest[platform][key].length < 1) continue;
            var obj = manifest[platform][key][0].manifest;
            obj.key = key;
            obj.path = meta.runtimes;
            obj.name = key + ".json"
            obj.size = undefined;
            if (!compare(obj)) {
                await loadSave(obj.url, join(obj.path, obj.name));
            }
        }
    }
    
}