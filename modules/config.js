import EventEmitter from "events";
import { join } from "path";
import { mkdir } from "./internal/util.js";
let defEvents = new EventEmitter()
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

defEvents.on('minecraft.stdout', (out) => {
    console.log(("[Minecraft] " + out).trim());
});

defEvents.on('minecraft.stderr', (out) => {
    console.log(("[Minecraft] " + out).trim());
});
/**
 * @typedef {Array<GMLL.update>} updateConf
 */
var updateConf = ["fabric", "vanilla", "forge", "runtime"];
var root, assets, libraries, instances, versions, runtimes, launcher, natives
/**
 * Resets the root folder path and all of it's sub folders
 * @param {String} _root 
 */
export function resetRoot(_root) {
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

export function setRoot(_root) {
    root = _root;
}
export function setAssets(_assets) {
    assets = _assets;
}
export function setLibraries(_libraries) {
    libraries = _libraries;
}
export function setInstances(_instances) {
    instances = _instances;
}
export function setRuntimes(_runtimes) {
    runtimes = _runtimes;
}
export function setLauncher(_launcher) {
    launcher = _launcher;
}

export function setNatives(_natives) {
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


export function emit(tag, ...args) {
    defEvents.emit(tag, ...args);
}
export function setEventListener(events) {
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
/**
 * 
 * @param {GMLL.update} item 
 */
export function addUpdateConfig(item) {
    updateConf.push(item);
}
/**
 * 
 * @returns {Array<GMLL.update>}
 */
export function getUpdateConfig() {
    return updateConf;
}
export function getNatives() {
    mkdir(natives);
    return natives
}