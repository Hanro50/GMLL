import { EventEmitter } from "events";
import { manifests } from "./downloader.js";
import { dir, file } from "./objects/files.js";
import { getErr, throwErr } from "./internal/util.js";
import packagePath from "./internal/root.cjs";
export type update = "fabric" | "vanilla" | "forge" | "runtime";
let initialized = false;
let version = (new file(packagePath, "..", "..", "package.json").toJSON<{ version: string }>().version || "0.0.0");
let launcherName = "GMLL";
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

var files: { assets: dir, libraries: dir, instances: dir, versions: dir, runtimes: dir, launcher: dir, natives: dir }
/**
 * Resets the root folder path and all of it's sub folders
 * @param {String} _root Essentially where you want to create a new .minecraft folder
 */
export function setRoot(_root: dir | string) {
    if (typeof _root == "string") _root = new dir(_root);
    initialized = false;
    files = {
        assets: _root.getDir("assets"),
        libraries: _root.getDir("libraries"),
        instances: _root.getDir("instances"),
        versions: _root.getDir("versions"),
        runtimes: _root.getDir("runtimes"),
        launcher: _root.getDir("launcher"),
        natives: _root.getDir("natives")
    }
}

setRoot(new dir(".minecraft"));
/**
 * The location of the asset directory. Used to store textures, music and sounds. 
 * @param _assets The location you want the asset directory to be at
 */
export function setAssets(_assets: dir | string) {
    if (typeof _assets == "string") _assets = new dir(_assets);
    files.assets = _assets;
    files.assets.mkdir();
}
/**
 * Used to store dependencies various versions of Minecraft and modloaders need in order to function.  
 * @param _libraries The location you want the library directory to be at
 */
export function setLibraries(_libraries: dir | string) {
    if (typeof _libraries == "string") _libraries = new dir(_libraries);
    files.libraries = _libraries;
    files.libraries.mkdir();
}
/**
 * The default location to store new instances at.  
 * @param _instances The location you want the instance directory to be at
 */
export function setInstances(_instances: dir | string) {
    if (typeof _instances == "string") _instances = new dir(_instances);
    files.instances = _instances;
    files.instances.mkdir();
}
/**
 * Used to store version.json files and client jars GMLL uses to download the dependencies a 
 * set version of minecraft or a set modeloader needs inorder to function properly
 * @param _versions The location you want the version directory to be at
 */
export function setVersions(_versions: dir | string) {
    if (typeof _versions == "string") _versions = new dir(_versions);
    files.versions = _versions;
    files.versions.mkdir();
}
/**
 * Runtimes are the various different versions of Java minecraft needs to function. 
 * Java 8 for pre-1.17 builds of the game 
 * Java 16 for 1.17
 * Java 17 for 1.18+ 
 * @param _runtimes The location you want the runtime directory to be at
 */
export function setRuntimes(_runtimes: dir | string) {
    if (typeof _runtimes == "string") _runtimes = new dir(_runtimes);
    files.runtimes = _runtimes;
    files.runtimes.mkdir();
}
/**
 * GMLL uses this folder to store meta data GMLL uses to control and manage minecraft. 
 * @param _launcher   The location you want the meta directory to be at
 */
export async function setLauncher(_launcher: dir | string) {
    if (typeof _launcher == "string") _launcher = new dir(_launcher);
    initialized = false;
    files.launcher = _launcher;
    await initialize();
}
/**
 * Natives are binary blobs and DLL files various minecraft versions use to function. 
 * Essentially used to access functionality outside the scope of what the Java JVM provides 
 * @param _natives The location you want the bin directory to be at
 */
export function setNatives(_natives: dir | string) {
    if (typeof _natives == "string") _natives = new dir(_natives);
    files.natives = _natives;
    _natives.mkdir();
}
/**
 * Gets the root of the asset database. 
 * @see the {@link setAssets set} method for more info 
 */
export function getAssets() {
    return files.assets;
}
/**
 * Get the location of the library files. 
 * @see the {@link setLibraries set} method for more info 
 */
export function getlibraries() {
    return files.libraries;
}
/**
 * Use to get the instance directory  
 * @see the {@link setInstances set} method for more info 
 */
export function getInstances() {
    return files.instances;
}
/**
 * Use to get the version directory 
 * @see the {@link setVersions set} method for more info 
 */
export function getVersions() {
    return files.versions;
}
/**
 * Used to get the runtime directory 
 * @see the {@link setRuntimes set} method for more info 
 */
export function getRuntimes() {
    return files.runtimes;
}
/**
 * Returns a set of directories GMLL uses to store meta data. 
 * Mostly used for version manifests and runtime manifests that act as pointers to help GMLL to locate other files stored on Mojang's servers.
 * It also stores miscellaneous files GMLL uses to optimize the retrieval of certian pieces of information needed for GMLL to function properly 
 */
export function getMeta() {
    const meta = {
        manifests: files.launcher.getDir("manifests"),
        runtimes: files.launcher.getDir("runtimes"),
        index: files.launcher.getDir("index"),
        profiles: files.launcher.getDir("profiles")
    }
    return meta;
}
/**
 * Used to get the bin directory 
 * @see the {@link setNatives set} method for more info 
 */
export function getNatives() {
    files.natives.mkdir();
    return files.natives
}
/**
 * For internal use only 
 */
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
    Object.values(files).forEach(e => { e.mkdir() });
    Object.values(getMeta()).forEach(e => { e.mkdir() });
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
/**
 * Used to set the reported launcher name reported by GMLL to Minecraft
 * @param _version Any version string
 */
export function setLauncherName(_name: string = "GMLL") {
    launcherName = _name;
}
/**
 * Used to get the currently reported launcher name reported by GMLL to Minecraft
 */
export function getLauncherName() {
    return launcherName || "GMLL";
}

/**
 * Used to set the reported launcher version reported by GMLL to Minecraft
 * @param _version Any version string
 */
export function setLauncherVersion(_version: string = "0.0.0") {
    version = _version;
}
/**
 * Used to get the currently reported launcher version reported by GMLL to Minecraft
 */
export function getLauncherVersion() {
    return version || "0.0.0";
}
