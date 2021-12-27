import { EventEmitter } from "events";
import { tmpdir } from "os";
import { join } from "path";
import { manifests } from "./downloader.js";
import { dir } from "./objects/files.js";
import { getErr, mkdir, throwErr } from "./internal/util.js";
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
        case ("fail"): console.log(getErr("Failed to download " + key)); break;
        case ("system"): console.log(getErr("Failed to download " + key + " due to an error \n" + err)); break;
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
var updateConf: update[] = ["fabric", "vanilla", "forge", "runtime"];

var files: { root: dir, assets: dir, libraries: dir, instances: dir, versions: dir, runtimes: dir, launcher: dir, natives: dir }
/**
 * Resets the root folder path and all of it's sub folders
 * @param {String} _root 
 */
export function setRoot(_root: string, absolutePath = false) {
    if (!absolutePath)
        _root = join(process.cwd(), _root);
    initialized = false;
    files = {
        root: new dir(_root),
        assets: new dir(_root, "assets"),
        libraries: new dir(_root, "libraries"),
        instances: new dir(_root, "instances"),
        versions: new dir(_root, "versions"),
        runtimes: new dir(_root, "runtimes"),
        launcher: new dir(_root, "launcher"),
        natives: new dir(_root, "natives")
    }
}

setRoot(".minecraft");

export function setAssets(_assets: dir) {
   files.assets.mkdir();
    files.assets = _assets;
}
export function setLibraries(_libraries: dir) {
    files.libraries.mkdir();
    files.libraries = _libraries;
}
export function setInstances(_instances: dir) {
    files.instances.mkdir();
    files.instances = _instances;
}
export function setRuntimes(_runtimes: dir) {
    files.runtimes.mkdir();
    files.runtimes = _runtimes;
}
export async function setLauncher(_launcher: dir) {
    initialized = false;
    files.launcher = _launcher;
    await initialize();
}

export function setNatives(_natives: dir) {
    _natives.mkdir();
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
        manifests: files.launcher.getDir("manifests"),
        runtimes: files.launcher.getDir("runtimes"),
        index: files.launcher.getDir("index"),
        profiles: files.launcher.getDir("profiles"),
        //  temp: join(tmpdir(), "GMLL"),
        folder: files.launcher,
    }
    return meta;
}

export function getNatives() {
    files.natives.mkdir();
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
        replace(/\<assets\>/g, getAssets().sysPath()).
        replace(/\<instance\>/g, getInstances().sysPath()).
        replace(/\<libraries\>/g, getlibraries().sysPath()).
        replace(/\<runtimes\>/g, getRuntimes().sysPath()).
        replace(/\<versions\>/g, getVersions().sysPath());
}

export function setLauncherVersion(_version: string = "0.0.0") {
    version = _version;
}
export function getLauncherVersion() {
    return version || "0.0.0";
}
