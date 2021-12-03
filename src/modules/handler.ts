import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { emit, getInstances, getlibraries, getMeta, getRuntimes, getVersions, isInitialised } from "./config.js";
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
/**
 * @returns {Array<GMLL.json.manifest>}
 */
export function getManifests(): manifest[] {
    isInitialised();
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

/**
 * 
 * @param {GMLL.json.manifest} version 
 * @returns 
 */
export function getManifest(version: string) {
    isInitialised();
    const manifests = getManifests();
    const v = version.toLocaleLowerCase().trim();
    return manifests.find(e => { try { return e.id.toLocaleLowerCase().trim() == v } catch { return false; } }) || { id: version, type: "unknown" };
}

/**
 * 
 * @returns {{ "release": string, "snapshot": string }};
 */
export function getLatest() {
    isInitialised();
    const file = join(getMeta().index, "latest.json");
    if (existsSync(file))
        return JSON.parse(readFileSync(file).toString());
    else return { "release": "1.17.1", "snapshot": "21w42a" };
}

export function getClientID() {
    isInitialised();
    const path = join("some files");
    var data: string;
    if (!existsSync(path)) {
        data = stringify({
            Date: Date.now(),
            UUID: randomUUID(),
            network: createHash('sha256').update(stringify(networkInterfaces())).digest("base64"),
            user: createHash('sha256').update(stringify(userInfo())).digest("base64"),
            provider: "MSMC",
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
    const s = spawn(javaPath, args, { "cwd": path })
    s.stdout.on('data', (chunk) => emit("jvm.stdout", "Forgiac", chunk));
    s.stderr.on('data', (chunk) => emit("jvm.stderr", "Forgiac", chunk));
    console.log(await new Promise(e => s.on('exit', e)));

    return await new Promise(exit => s.on("exit", exit));
}