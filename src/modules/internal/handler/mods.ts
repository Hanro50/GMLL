import { spawn } from "child_process";
import { getAssets, getlibraries, onUnsupportedArm, getInstances, getVersions, getMeta,emit } from "../../config.js";
import { runtime } from "../../downloader.js";
import { getJavaPath } from "../../handler.js";
import { dir, file, packAsync } from "../../objects/files.js";
import instance from "../../objects/instance.js";
import version from "../../objects/version.js";
import { platform } from "os";
import { downloadableFile, versionJson, versionManifest, instancePackConfig, mcRuntimeVal, instanceMetaPaths } from "types.js";

import { assetTag, fsSanitizer, throwErr } from "../util.js";



export async function getJarModPriority(this: instance) {
    return (await this.getMetaPaths()).jarmods.getFile("priority.json").load<{ [key: string]: number }>({})
}

/**Wraps up an instance in a prepackaged format that can be easily uploaded to a server for distribution 
 * @param baseUrl The base URL the generated files will be stored within on your server. For example http\:\/\/yourawesomdomain.net\/path\/to\/files\/
 * @param save The file GMLL will generate the final files on. 
 * @param name The name that should be used to identify the generated version files
 * @param forge The path to a forge installation jar
 * @param trimMisc Gets rid of any unnecessary miscellaneous files
*/
export async function wrap(this: instance, baseUrl: string, save: dir | string, name: string = ("custom_" + this.name), forge?: { jar: file | string } | file, trimMisc: boolean = false) {
    if (typeof save == "string") save = new dir(save);
    await this.install();
    const blacklist = ["usercache.json", "realms_persistence.json", "logs", "profilekeys", "usernamecache.json"]
    const seperate = ["resourcepacks", "texturepacks", "mods", "coremods", "jarmods", "shaderpacks"]
    const dynamic = ["saves", "config"]
    const bunlde = ["saves"]
    const pack = ["config"]

    const me = this.getDir();
    const resources: downloadableFile[] = [];

    const cp = (d: dir, path: string[]) => {
        if (d.exists()) {
            d.ls().forEach(e => {
                if (typeof save == "string") save = new dir(save);
                if (e instanceof file) {
                    const f = new file(save.javaPath(), ...path, e.name)
                    e.copyTo(f.mkdir())
                    resources.push({ key: [...path, e.name].join("/"), name: e.name, path: path, url: [baseUrl, ...path, e.name].join("/"), chk: { sha1: f.getHash(), size: f.getSize() } });
                } else if (!e.islink()) {
                    const path2 = [...path, e.path[e.path.length - 1]];
                    cp(e, path2);
                }
            })
        }
    }
    seperate.forEach(e => {
        cp(me.getDir(e), [e]);
    })
    const data = save.getDir(".data").mkdir();
    for (var i = 0; i < bunlde.length; i++) {
        const e = bunlde[i]
        const ls = me.getDir(e).ls();
        for (var k = 0; k < ls.length; k++) {
            const e2 = ls[k]
            if (!e2.islink() && e2 instanceof dir && e2.exists()) {
                const name = e2.getName()
                const zip = e + "_" + k + ".zip";
                const file = data.getFile(zip)
                const err = await packAsync(e2.sysPath(), file.sysPath());
                if (err) console.error(err);
                resources.push({ dynamic: dynamic.includes(e), unzip: { file: [e] }, key: [e, name].join("/"), name: zip, path: [".data"], url: [baseUrl, ".data", zip].join("/"), chk: { sha1: file.getHash(), size: file.getSize() } });
            }
        }
    }
    for (var i = 0; i < pack.length; i++) {
        const e = pack[i]
        const directory = me.getDir(e);
        if (directory.exists() && !directory.islink()) {
            const zip = e + ".zip";
            const file = data.getFile(zip)
            const err = await packAsync(directory.sysPath(), file.sysPath());
            if (err) console.error(err);
            resources.push({ dynamic: dynamic.includes(e), unzip: { file: [] }, key: [e, name].join("/"), name: zip, path: [".data"], url: [baseUrl, ".data", zip].join("/"), chk: { sha1: file.getHash(), size: file.getSize() } });
        }
    }

    const ls2 = me.ls()
    const zip = "misc.zip";
    const mzip = data.getFile(zip).mkdir();
    const avoid = [...seperate, ...bunlde, ...blacklist, ...pack]
    if (this.assets && this.assets.objects) {
        const assetz = save.getDir("assets").mkdir();
        Object.values(this.assets.objects).forEach((e) => {
            assetTag(getAssets().getDir("objects"), e.hash).getFile(e.hash).copyTo(assetTag(assetz.getDir("objects"), e.hash).mkdir().getFile(e.hash))
        })
        const err = await packAsync(assetz.sysPath(), mzip.sysPath());
        if (err) console.error(err);
        assetz.rm();
    }
    if (!trimMisc)
        for (var k = 0; k < ls2.length; k++) {
            const e = ls2[k];
            if (!e.islink() && !avoid.includes(e.getName()) && !e.getName().startsWith(".")) {
                const err = await packAsync(e.sysPath(), mzip.sysPath());
                if (err) console.error(err);
            }
        }
    if (mzip.exists()) {
        resources.push(
            {
                unzip: { file: [] },
                key: "misc",
                name: "misc.zip",
                path: [".data"],
                url: [baseUrl, ".data", zip].join("/"),
                chk: { sha1: mzip.getHash(), size: mzip.getSize() }
            }
        );
    } else {
        console.warn("[GMLL]: No misc zip detected! If this is intended then please ignore");
    }
    const ver: Partial<versionJson> = {
        instance: {
            //      restart_Multiplier: 1,
            files: resources,
            assets: this.assets,
            meta: this.meta
        },

        id: name
    }
    const verfile = save.getDir(".meta").mkdir().getFile("version.json");
    let Fversion = this.version;
    if (forge) {
        let _forge: file;
        if (forge instanceof file) _forge = forge;
        else if (typeof forge.jar == "string") _forge = new file(forge.jar);
        else _forge = forge.jar;

        await runtime("java-runtime-beta");

        const javaPath = getJavaPath("java-runtime-beta");
        const path = save.getDir(".forgiac").rm().mkdir();
        const manifest = path.getDir("manifest").mkdir();
        const args: string[] = ["-jar", getlibraries().getFile("za", "net", "hanro50", "forgiac", "basic", "forgiac.jar").sysPath(), "--.minecraft", path.sysPath(), "--mk_manifest", manifest.sysPath(), "--installer", _forge.sysPath()];

        path.mkdir();
        emit("jvm.start", "Forgiac", path.sysPath());
        const s = spawn(javaPath.sysPath(), args, { "cwd": path.sysPath() })
        s.stdout.on('data', (chunk) => emit("jvm.stdout", "Forgiac", chunk));
        s.stderr.on('data', (chunk) => emit("jvm.stderr", "Forgiac", chunk));
        await new Promise(e => s.on('exit', e));

        const forgiman = manifest.ls()
        if (forgiman.length < 1) {
            throw "Manifest file not found?"
        }
        const forgi = forgiman[0]
        if (!(forgi instanceof file)) {
            throw "Manifest file is a directory?"
        }
        const forgePath = save.getDir("forge").mkdir();
        Fversion = forgi.toJSON<versionManifest>().id;
        _forge.copyTo(forgePath.getFile(_forge.getName()));
        ver.instance.files.push({ key: _forge.getName(), name: _forge.getName(), path: ["forge"], url: [baseUrl, "forge", _forge.getName()].join("/"), chk: { sha1: _forge.getHash(), size: _forge.getSize() } })
        ver.instance.forge = { installer: ["forge", _forge.getName()] };

        path.rm();
    }
    ver.inheritsFrom = Fversion;
    verfile.write(ver);
    const manifest: versionManifest = {
        id: name, type: "custom", sha1: verfile.getHash(), base: Fversion, url: baseUrl + "/" + ".meta/version.json", "_comment": "Drop this into gmll's manifest folder",
    }
    delete manifest._comment;
    save.getFile(".meta", "manifest.json").write(manifest);
    save.getFile(".meta", "api.json").write({ name: name, version: 1, sha: save.getFile(".meta", "manifest.json").getHash(), "_comment": "Here for future proofing incase we need to introduce a breaking change to this system." });

    let index = `<!DOCTYPE html><html><!--This is just a place holder! GMLL doesn't check this. It is merely here to look nice and serve as a directory listing-->`
    index += `<head><link rel="stylesheet" href="https://styles.hanro50.net.za/v1/main"><title>${name}</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="A GMLL minecraft modpack"></head><body><h1>${name}</h1><h2>Copy the link to this page into gmll to import this modpack!</h2><h2>File list</h2>`
    function read(f: dir, directory = []) {

        f.ls().forEach(e => {
            if (e.getName() == "index.html" || e.getName() == `manifest_${fsSanitizer(name)}.json`) return;
            if (e instanceof file) {
                const entry = ([...directory, e.getName()].join("/"));
                index += `<br><div class="element button" onclick="document.location.href='./${entry}'">${entry}</div>`
            }
            else read(e, [...directory, e.getName()])
        })
    }

    read(save);
    index += `</body></html>`
    console.log(index);
    save.getFile("index.html").write(index);
    save.getFile(`manifest_${fsSanitizer(name)}.json`).write(manifest);
    return ver;
}
/**An version of the wrap function that takes an object as a variable instead of the mess the base function takes. */
export function pack(this: instance, config: instancePackConfig) {
    if (typeof config.forgeInstallerPath == "string") config.forgeInstallerPath = new file(config.forgeInstallerPath);

    return this.wrap(config.baseDownloadLink, config.outputDir, config.modpackName, config.forgeInstallerPath, config.trimMisc)
}

export async function installForge(this: instance, forge?: file | string) {
    const forgiacURL = "https://github.com/Hanro50/Forgiac/releases/download/1.8-SNAPSHOT/basic-1.8-SNAPSHOT.jar";
    const forgiacSHA = "https://github.com/Hanro50/Forgiac/releases/download/1.8-SNAPSHOT/basic-1.8-SNAPSHOT.jar.sha1";
    const forgiacPath = ["za", "net", "hanro50", "forgiac", "basic"];
    if (typeof forge == "string") forge = new file(forge);
    let manifest = this.getDir().getDir(".manifest").mkdir();
    var libsFolder = getlibraries().getDir(...forgiacPath).mkdir();
    var rURL2 = await fetch(forgiacSHA);
    if (rURL2.status == 200) {
        await libsFolder.getFile("forgiac.jar").download(forgiacURL, { sha1: await rURL2.text() })
    }
    const fRun: mcRuntimeVal = onUnsupportedArm ? "java-runtime-arm" : "java-runtime-gamma";
    await runtime(fRun);

    const javaPath = getJavaPath(fRun);
    const path = getInstances().getDir(".forgiac");
    const logFile = path.getFile("log.txt")
    const args: string[] = ["-jar", getlibraries().getFile("za", "net", "hanro50", "forgiac", "basic", "forgiac.jar").sysPath(), " --log", logFile.sysPath(), "--virtual", getVersions().sysPath(), getlibraries().sysPath(), "--mk_manifest", manifest.sysPath()];
    if (forge) {
        args.push("--installer", forge.sysPath());
    }
    path.mkdir();
    emit("jvm.start", "Forgiac", path.sysPath());
    const s = spawn(javaPath.sysPath(), args, { "cwd": path.sysPath() })
    s.stdout.on('data', (chunk) => emit("jvm.stdout", "Forgiac", chunk));
    s.stderr.on('data', (chunk) => emit("jvm.stderr", "Forgiac", chunk));
    const err = await new Promise(e => s.on('exit', e));
    if (err != 0) {
        throwErr("Forge failed to install. Forgiac exited with an error code of " + err)
    }

    const forgiman = manifest.ls()
    if (forgiman.length < 1) {
        throw "Manifest file not found?"
    }
    const forgi = forgiman[0]
    if (!(forgi instanceof file)) {
        throw "Manifest file is a directory?"
    }
    //const forgePath = save.getDir("forge").mkdir();

    this.version = forgi.toJSON<versionManifest>().id;
    forgi.moveTo(getMeta().manifests.getFile(forgi.getName()));
    return this.version;
    // _forge.copyTo(forgePath.getFile(_forge.getName()));
    // this.version


    // await new Promise(e => s.on('exit', e));
}

export async function jarmod(metapaths: instanceMetaPaths, version: version): Promise<file> {
    const jarmods = metapaths.jarmods;
    const bin = dir.tmpdir().getDir("gmll", "bin").rm().mkdir();
    const custom = bin.getFile(`${version.name}.jar`);

    if (!jarmods || !jarmods.exists()) return;
    const lst = jarmods.ls();
    if (lst.length < 1) return;
    console.warn("[GMLL]: Jar modding is experimental atm.\nWe still don't have a way to order jars\nRecommended for modding legacy versions or mcp...");
    console.log("[GMLL]: Packing custom jar");
    const tmp = dir.tmpdir().getDir("gmll", "tmp").rm().mkdir();
    const jar = version.folder.getFile(version.name + ".jar");
    if (!jar.exists()) return;
    await jar.unzip(tmp, ["META-INF/*"]);

    let priority = { "_comment": "0 is the default, the lower the priority. The sooner a mod will be loaded. Deleting this file resets it" };
    const pFile = jarmods.getFile("priority.json");
    let fReset = false;
    if (pFile.exists())
        try { priority = pFile.toJSON(); } catch (e) { console.warn("[GMLL]: Failed to parse priorities file!"); }
    else
        fReset = true;
    lst.sort((aF, bF) => {
        const a = aF.getName();
        const b = bF.getName();
        if (priority[a] != priority[b]) {
            if (a in priority && b in priority) return priority[a] - priority[b];
            if (a in priority) return priority[a];
            if (b in priority) return 0 - priority[b];
        }
        return (a > b ? 1 : -1);
    });

    console.log("[GMLL]: Running through files");
    for (const e of lst) {
        if (e instanceof file) {
            const n = e.getName();
            console.log(n);
            if (n.endsWith(".zip") || n.endsWith(".jar")) {
                if (!(n in priority)) { priority[n] = fReset ? (Object.keys(priority).length - 1) * 10 : 0; }
                await e.unzip(tmp);
            }
        }
    }
    pFile.write(priority);
    console.log("[GMLL]: Packing jar");
    await packAsync(tmp.sysPath() + (platform() == "win32" ? "\\." : "/."), custom.sysPath());
    return custom;
}
