import { EventEmitter } from "events";
import { join } from "path";
import { mkdir } from "./internal/util.js";
export type update = "fabric" | "vanilla" | "forge" | "runtime";

export interface Events {
    //Download
    on(e: "download.start" | "download.restart" | "download.done", f: () => void): void
    on(e: "download.setup", f: (cores: number) => void): void
    on(e: "download.progress", f: (key: string, index: Number, total: Number, left: Number) => void): void
    on(e: "download.fail", f: (key: string, type: "retry" | "fail" | "system", err: any) => void): void

    on(e: "jvm.stdout" | "jvm.stderr", f: (app:string,chunk: any) => void): void

    emit(tag: string, ...args: any): void
}
let defEvents: Events = new EventEmitter();
//Download Manager
defEvents.on('download.setup', (cores) => console.log("[GMLL]: Dividing out work to " + cores + " cores"))
defEvents.on('download.start', () => console.log("[GMLL]: Starting download"))
defEvents.on('download.restart', () => console.error("[GMLL]: It is taking to long to get update, assuming crash"))
defEvents.on('download.progress', (key, index, total, left) => console.log("[GMLL]: Done with " + index + " of " + total + " : " + left + " : " + key))
defEvents.on('download.done', () => console.log("[GMLL]: Done with download"))
defEvents.on('download.fail', (key, type, err) => {
    switch (type) {
        case ("retry"): console.log("[GMLL]: Trying to download " + key + " again"); break;
        case ("fail"): console.log("[GMLL]: Failed to download " + key); break;
        case ("system"): console.log("[GMLL]: Failed to download " + key + " due to an error"); console.trace(err); break;
    }
});

defEvents.on('jvm.stdout', (app,out) => {
    console.log(("["+app+"] " + out).trim());
});
defEvents.on('jvm.stderr', (app,out) => {
    console.log(("\x1b[31m\x1b[1m["+app+"] " + out).trim()+"\x1b[0m");
});
/**
 * @typedef {Array<GMLL.update>} updateConf
 */
var updateConf: update[] = ["fabric", "vanilla", "forge", "runtime"];
var root: string, assets: string, libraries: string, instances: string, versions: string, runtimes: string, launcher: string, natives: string
/**
 * Resets the root folder path and all of it's sub folders
 * @param {String} _root 
 */
export function resetRoot(_root: string) {
    root = _root
    assets = join(root, "assets");
    libraries = join(root, "libraries");
    instances = join(root, "instances");
    versions = join(root, "versions");
    runtimes = join(root, "runtimes");
    launcher = join(root, "launcher");
    natives = join(root, "natives");
}

resetRoot(join(process.cwd(), ".minecraft"));

export function setRoot(_root: string) {
    root = _root;
}
export function setAssets(_assets: string) {
    assets = _assets;
}
export function setLibraries(_libraries: string) {
    libraries = _libraries;
}
export function setInstances(_instances: string) {
    instances = _instances;
}
export function setRuntimes(_runtimes: string) {
    runtimes = _runtimes;
}
export function setLauncher(_launcher: string) {
    launcher = _launcher;
}

export function setNatives(_natives: string) {
    natives = _natives;
}

export function getRoot() {
    mkdir(root);
    return root;
}

export function getAssets() {
    mkdir(assets)
    return assets;
}
export function getlibraries() {
    mkdir(libraries);
    return libraries;
}
export function getInstances() {
    mkdir(instances);
    return instances;
}
export function getVersions() {
    mkdir(versions);
    return versions;
}
export function getRuntimes() {
    mkdir(runtimes);
    return runtimes;
}
export function getMeta() {
    const meta = {
        libraries: join(launcher, "libraries"),
        manifests: join(launcher, "manifests"),
        runtimes: join(launcher, "runtimes"),
        index: join(launcher, "index"),
        profiles: join(launcher, "profiles"),
        temp: join(launcher, "temp"),
        folder: launcher,
    }
    Object.values(meta).forEach(e => { mkdir(e) });

    return meta;
}


export function emit(tag: string, ...args: Array<Number | String>) {
    defEvents.emit(tag, ...args);
}
export function setEventListener(events: Events) {
    defEvents = events;
}
/**
 * 
 * @returns {GMLL.Events}
 */
export function getEventListener() {
    return defEvents;
}
export function clrUpdateConfig() {
    updateConf = [];
}

export function addUpdateConfig(item: update) {
    updateConf.push(item);
}

export function getUpdateConfig() {
    return updateConf;
}
export function getNatives() {
    mkdir(natives);
    return natives
}