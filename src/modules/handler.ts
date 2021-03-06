/**The internal java and version manifest handler for GMLL */

import { emit, getInstances, getlibraries, getMeta, getRuntimes, getVersions, isInitialized, onUnsupportedArm } from "./config.js";
import { runtime } from "./downloader.js";
import { fsSanitiser, getOS, throwErr } from "./internal/util.js";
import { spawn } from "child_process";
import { file } from "./objects/files.js";
import fetch from "node-fetch";
import instance from "./objects/instance.js";
import type { modpackApiInfo, versionManifest, mcRuntimeVal } from "../types.js";


/**
 * Compiles all manifest objects GMLL knows about into a giant array. This will include almost all fabric versions and any installed version of forge.
 * GMLL can still launch a version if it is not within this folder, although it is not recommended
 * @returns a list of Manifest files GMLL knows definitely exist. 
 */
export function getManifests(): versionManifest[] {
    isInitialized();
    var versionManifest = [];
    const root = getMeta().manifests
    root.ls().forEach(e => {
        if (e.sysPath().endsWith("json") && e instanceof file) {
            var v = e.toJSON<versionManifest | versionManifest[]>();
            if (v instanceof Array)
                versionManifest.push(...v);
            else
                versionManifest.push(v);
        }
    })
    return versionManifest;
}

function findManifest(version: string, manifests: versionManifest[]) {
    const v = version.toLocaleLowerCase().trim();
    const manifest = manifests.find(e => { try { return e.id.toLocaleLowerCase().trim() == v } catch { return false; } }) || { id: version, type: "unknown" };
    if (manifest.base) {
        const man2 = findManifest(manifest.base, manifests);
        manifest.releaseTime = man2.releaseTime;
        manifest.time = man2.time;
        manifest.complianceLevel = man2.complianceLevel;
    }
    return manifest;
}
/**Gets a specific version manifest based on the version ID provided
 * @param version the version ID
 * @returns a version manifest. It will be of type "unknown" if the specific manifest is not in the manifest database. 
 */
export function getManifest(version: string) {
    isInitialized();
    const manifests = getManifests();
    return findManifest(version, manifests);
}

/**Gets the latest release and snapshot builds.*/
export function getLatest(): { "release": string, "snapshot": string } {
    isInitialized();
    const file = getMeta().index.getFile("latest.json");
    if (file.exists())
        return file.toJSON();
    else return { "release": "1.17.1", "snapshot": "21w42a" };
}

/**Installs a provided version of forge from a provided installer. Only works with forge*/
export async function installForge(forgeInstallerJar?: file | string): Promise<void> {
    if (typeof forgeInstallerJar == "string") forgeInstallerJar = new file(forgeInstallerJar);
    isInitialized();

    const frun: mcRuntimeVal = onUnsupportedArm ? "java-runtime-arm" : "java-runtime-gamma";
    await runtime(frun);

    const javaPath = getJavaPath(frun);
    const path = getInstances().getDir(".forgiac");
    const logFile = path.getFile("log.txt")
    const args: string[] = ["-jar", getlibraries().getFile("za", "net", "hanro50", "forgiac", "basic", "forgiac.jar").sysPath(), " --log", logFile.sysPath(), "--virtual", getVersions().sysPath(), getlibraries().sysPath(), "--mk_manifest", getMeta().manifests.sysPath()];
    if (forgeInstallerJar) {
        args.push("--installer", forgeInstallerJar.sysPath());
    }
    //  console.log(args)
    path.mkdir();
    emit("jvm.start", "Forgiac", path.sysPath());
    const s = spawn(javaPath.sysPath(), args, { "cwd": path.sysPath() })
    s.stdout.on('data', (chunk) => emit("jvm.stdout", "Forgiac", chunk));
    s.stderr.on('data', (chunk) => emit("jvm.stderr", "Forgiac", chunk));
    const err = await new Promise(e => s.on('exit', e));
    if (err != 0) {
        throwErr("Forge failed to install. Forgiac exited with an error code of " + err)
    }
}
/**
 * Imports a modpack off the internet compatible with GMLL via a link.
 * See the {@link instance.wrap()  wrapper function} to generate the files to upload to your web server to make this work  
 * @param url the afformentioned link. 
 */
export async function importLink(url: string): Promise<versionManifest>;
export async function importLink(url: string, name: string): Promise<instance>;
export async function importLink(url: string, name?: string): Promise<instance | versionManifest> {
    const r = await fetch(url + "/.meta/api.json");
    if (!r.ok)
        throw "Could not find the api doc";
    const v = await r.json() as modpackApiInfo;
    if (v.version != 1) {
        throw "Incompatible version ID detected";
    }
    const manfile = fsSanitiser(v.name) + ".json"
    const manifest = (await getMeta().manifests.getFile(manfile).download(url + "/.meta/manifest.json", { sha1: v.sha })).toJSON<versionManifest>();
    // console.log(manfile)
    if (!name) return manifest;
    return new instance({ version: manifest.id, name: name }).save();
}

/**
 * Gets the path to an installed version of Java. GMLL manages these versions and they're not provided by the system. 
 * @param java the name of the Java runtime. Based on the names Mojang gave them.
 * @returns The location of the hava executable. 
 */
export function getJavaPath(java: mcRuntimeVal = "jre-legacy") {
    return getRuntimes().getFile(java, "bin", getOS() == "windows" ? "java.exe" : "java");
}