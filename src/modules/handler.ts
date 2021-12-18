import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { emit, getInstances, getlibraries, getMeta, getRuntimes, getVersions, isInitialized } from "./config.js";
import { runtime } from "./downloader.js";
import { getOS, mkdir, stringify } from "./internal/util.js";
import { manifest, version as _version, runtimes } from "../index.js";
import { randomUUID, createHash } from "crypto";
import { networkInterfaces, userInfo } from "os";
import { spawn } from "child_process";


export interface options {
    /**The name of the instance */
    name?: string,
    /**The version of the game to load */
    version?: string,
    /**The installation path */
    path?: string,
    /**Ram in GB */
    ram?: Number,
    /**Custom data your launcher can use */
    meta?: any
}

export function getJavaPath(java: runtimes = "jre-legacy") {
    return join(getRuntimes(), java, "bin", getOS() == "windows" ? "java.exe" : "java");
}

export function getManifests(): manifest[] {
    isInitialized();
    var versionManifest = [];
    const root = getMeta().manifests
    readdirSync(root).forEach(e => {
        if (e.endsWith("json")) {
            var v = JSON.parse(readFileSync(join(root, e)).toString());
            if (v instanceof Array)
                versionManifest.push(...v);
            else
                versionManifest.push(v);
        }
    })
    return versionManifest;
}

function findManifest(version: string, manifests: manifest[]) {
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

export function getManifest(version: string) {
    isInitialized();
    const manifests = getManifests();
    return findManifest(version, manifests);
}

/**
 * 
 * @returns {{ "release": string, "snapshot": string }};
 */
export function getLatest() {
    isInitialized();
    const file = join(getMeta().index, "latest.json");
    if (existsSync(file))
        return JSON.parse(readFileSync(file).toString());
    else return { "release": "1.17.1", "snapshot": "21w42a" };
}

export function getClientID() {
    isInitialized();
    const path = join(getMeta().index, "ID.txt");
    var data: string;
    if (!existsSync(path)) {
        data = stringify({
            Date: Date.now(),
            UUID: randomUUID(),
            network: createHash('sha256').update(stringify(networkInterfaces())).digest("base64"),
            user: createHash('sha256').update(stringify(userInfo())).digest("base64"),
            provider: "GMLL",
        });
        data = createHash('sha512').update(data).digest("base64");
        writeFileSync(path, data);
    } else {
        data = readFileSync(path).toString();
    }
    return data;
}

/**
 * @param {String | String[] | null} file
 */
export async function installForge(file: string | string[] | null) {
    await runtime("java-runtime-beta");

    const javaPath = getJavaPath("java-runtime-beta");
    const path = join(getInstances(), ".forgiac");
    const logFile = join(path, "log.txt")
    const args: string[] = ["-jar", join(getlibraries(), "za", "net", "hanro50", "forgiac", "basic", "forgiac.jar"), " --log", logFile, "--virtual", getVersions(), getlibraries(), "--mk_manifest", getMeta().manifests];
    if (file) {
        file = (file instanceof Array ? join(...file) : file);
        args.push("--installer", file);
    }

    mkdir(path);
    emit("jvm.start", "Forgiac", path);
    const s = spawn(javaPath, args, { "cwd": path })
    s.stdout.on('data', (chunk) => emit("jvm.stdout", "Forgiac", chunk));
    s.stderr.on('data', (chunk) => emit("jvm.stderr", "Forgiac", chunk));
    await new Promise(e => s.on('exit', e));

    return await new Promise(exit => s.on("exit", exit));
}