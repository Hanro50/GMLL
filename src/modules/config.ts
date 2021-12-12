import { EventEmitter } from "events";
import { tmpdir } from "os";
import { join } from "path";
import { manifests } from "./downloader.js";
import { mkdir, throwErr } from "./internal/util.js";
export type update = "fabric" | "vanilla" | "forge" | "runtime";
let initialized = false;
var version = "0.0.0";
const startUpCalls: Array<() => void | Promise<void>> = [];
export function isInitialized() {
    if (!initialized) {
        throwErr("GMLL is not initialized!\nPlease run \"init()\" or wait for the manifest files to redownload when changing the launcher directory.\nThis error is here to prevent unexpected errors")
    }
}
export interface Events {

    /**
     * start=>Used when the downloader starts up
     * restart=>Used when the downloader has detected a timeout and decides to reset so it can try again
     * done=>Fired when everything is wrapped up.
    */
    on(e: "download.start" | "download.restart" | "download.done", f: () => void): void
    /**Used to give setup information. Useful for progress bars. */
    on(e: "download.setup", f: (cores: number) => void): void
    /**Fired when a file has been downloaded and saved to disk */
    on(e: "download.progress", f: (key: string, index: Number, total: Number, left: Number) => void): void
    /**Fired when GMLL needs to restart a download */
    on(e: "download.fail", f: (key: string, type: "retry" | "fail" | "system", err: any) => void): void
    /**The events fired when GMLL has to spin up an instance of the JVM. 
     * @param app The name of the Java app currently running. (Forgiac|Minecraft)
     * @param cwd The directory the app is running within.
     */
    on(e: "jvm.start", f: (app: string, cwd: string) => void): void
    /**Console feedback from a JVM App.
    * @param app The name of the Java app currently running. (Forgiac|Minecraft)
    * @param chunk The aforementioned feedback
    */
    on(e: "jvm.stdout" | "jvm.stderr", f: (app: string, chunk: any) => void): void

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
defEvents.on('jvm.start', (app, cwd) => {
    console.log(("[GMLL]: starting app <" + app + "> in directory <" + cwd + ">").trim());
});
defEvents.on('jvm.stdout', (app, out) => {
    console.log(("[" + app + "] " + out).trim());
});
defEvents.on('jvm.stderr', (app, out) => {
    console.log(("\x1b[31m\x1b[1m[" + app + "] " + out).trim() + "\x1b[0m");
});
/**
 * @typedef {Array<GMLL.update>} updateConf
 */
var updateConf: update[] = ["fabric", "vanilla", "forge", "runtime"];

var files: { root: string, assets: string, libraries: string, instances: string, versions: string, runtimes: string, launcher: string, natives: string }
/**
 * Resets the root folder path and all of it's sub folders
 * @param {String} _root 
 */
export function setRoot(_root: string, absolutePath = false) {
    if (!absolutePath)
        _root = join(process.cwd(), _root);
    initialized = false;
    files = {
        root: _root,
        assets: join(_root, "assets"),
        libraries: join(_root, "libraries"),
        instances: join(_root, "instances"),
        versions: join(_root, "versions"),
        runtimes: join(_root, "runtimes"),
        launcher: join(_root, "launcher"),
        natives: join(_root, "natives")
    }
}

setRoot(".minecraft");

export function setAssets(_assets: string) {
    mkdir(files.assets);
    files.assets = _assets;
}
export function setLibraries(_libraries: string) {
    mkdir(files.libraries);
    files.libraries = _libraries;
}
export function setInstances(_instances: string) {
    mkdir(files.instances);
    files.instances = _instances;
}
export function setRuntimes(_runtimes: string) {
    mkdir(files.runtimes);
    files.runtimes = _runtimes;
}
export async function setLauncher(_launcher: string) {
    initialized = false;
    files.launcher = _launcher;
    await initialize();
}

export function setNatives(_natives: string) {
    mkdir(_natives);
    files.natives = _natives;
}

export function getRoot() {
    return files.root;
}

export function getAssets() {
    return files.assets;
}
export function getlibraries() {
    return files.libraries;
}
export function getInstances() {
    return files.instances;
}
export function getVersions() {
    return files.versions;
}
export function getRuntimes() {
    return files.runtimes;
}
export function getMeta() {
    const meta = {
        manifests: join(files.launcher, "manifests"),
        runtimes: join(files.launcher, "runtimes"),
        index: join(files.launcher, "index"),
        profiles: join(files.launcher, "profiles"),
        temp: join(tmpdir(), "GMLL"),
        folder: files.launcher,
    }
    return meta;
}

export function getNatives() {
    mkdir(files.natives);
    return files.natives
}
export function emit(tag: string, ...args: Array<Number | String>) {
    defEvents.emit(tag, ...args);
}
/**Replaces the current event Listener */
export function setEventListener(events: Events) {
    defEvents = events;
}
/**Gets the current even Listener */
export function getEventListener() {
    return defEvents;
}
/** Clears all settings*/
export function clrUpdateConfig() {
    updateConf = [];
}
/**Adds a setting to the list of things GMLL should update*/
export function addUpdateConfig(item: update) {
    updateConf.push(item);
}
/**Gets the current list of things GMLL will update upon initialization */
export function getUpdateConfig() {
    return updateConf;
}
/**Used for GMLL plugins. */
export function initializationListener(func: () => void | Promise<void>) {
    startUpCalls.push(func)
}

/**Does the basic pre flight checks. */
export async function initialize() {
    Object.values(files).forEach(e => { mkdir(e) });
    Object.values(getMeta()).forEach(e => { mkdir(e) });
    await manifests();

    for (var i = 0; i < startUpCalls.length; i++) {
        await startUpCalls[i]();
    }
    initialized = true;
}
/**Used to resolve relative files in GMLL */
export function resolvePath(file: string) {//
    return file.
        replace(/\<assets\>/g, getAssets()).
        replace(/\<instance\>/g, getInstances()).
        replace(/\<libraries\>/g, getlibraries()).
        replace(/\<runtimes\>/g, getRuntimes()).
        replace(/\<versions\>/g, getVersions());
}

export function setLauncherVersion(_version: string = "0.0.0") {
    version = _version;
}
export function getLauncherVersion() {
    return version || "0.0.0";
}
