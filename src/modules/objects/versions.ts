import { copyFileSync, existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { getMeta, getRuntimes, getVersions, isInitialised } from "../config.js";
import { assets, libraries, manifests, runtime } from "../downloader.js";
import { chkLoadSave, getOS, mkdir, rmdir, throwErr } from "../internal/util.js";
import {manifest, version as _version, runtimes } from "../../index.js";


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

function combine(ob1, ob2) {
    Object.keys(ob2).forEach(e => {
        if (!ob1[e]) {
            ob1[e] = ob2[e]
        }
        else if (typeof ob1[e] == typeof ob2[e]) {
            if (ob1[e] instanceof Array) {
                ob1[e] = [...ob2[e], ...ob1[e]]
            }
            else if (typeof ob1[e] == "string") {
                ob1[e] = ob2[e];
            }
            else if (ob1[e] instanceof Object) {
                ob1[e] = combine(ob1[e], ob2[e]);
            }
        } else {
            ob1[e] = ob2[e];
        }
    })
    return ob1;
}

export class version {
    json: _version;
    manifest: manifest;
    name: string;
    folder: string;
    file: string;
 
    /**
     * 
     * @param {string | GMLL.json.manifest} manifest 
     */
     constructor(manifest: string | manifest) {
        isInitialised();
        /**@type {GMLL.json.manifest} */
        this.manifest = typeof manifest == "string" ? getManifest(manifest) : manifest;
        /**@type {GMLL.json.version} */
        this.json;
        this.name = this.manifest.base || this.manifest.id;
        this.folder = join(getVersions(), this.name);
        this.file = join(this.folder, this.manifest.id + ".json");
    
    }

    /**
     * 
     * @returns {Promise<GMLL.json.version>}
     */
    async getJSON(): Promise<_version> {
        const folder_old = join(getVersions(), this.manifest.id);
        const file_old = join(folder_old, this.manifest.id + ".json");
        if (this.json)
            return this.json;
        if (this.file != file_old && !existsSync(this.file) && existsSync(file_old)) {
            console.log("[GMLL] Cleaning up versions!")
            copyFileSync(file_old, this.file);
            rmdir(folder_old);
        }
        if (this.manifest.url) {
            mkdir(this.folder);
            this.json = await chkLoadSave<_version>(this.manifest.url, this.file, this.manifest.sha1);
        } else if (existsSync(this.file)) {
            this.json = JSON.parse(readFileSync(this.file).toString());
        } else {
            throwErr( this.manifest.type == "unknown"
                ? "Unknown version, please check spelling of given version ID"
                : "Version json is missing for this version!");
        }
        if (this.json.inheritsFrom) {
            const base = (new version(this.json.inheritsFrom));
            this.json = combine(await base.getJSON(), this.json);
            this.folder = base.folder;
            this.name = base.name;
        }


        return this.json;
    }

    async getAssets() {
        const json = await this.getJSON();
        await assets(json.assetIndex);
    }
    /**
     * @param {GMLL.jarTypes} type 
     */
    async getJar(type, jarpath, jarname) {
        const json = await this.getJSON();
        const download = json.downloads[type];
        await libraries(json, { key: this.manifest.id, name: jarname, path: jarpath, url: download.url, size: download.size, sha1: download.sha1 });
    }

    async getJavaPath() {
        const json = await this.getJSON();
        return getJavaPath(json.javaVersion ? json.javaVersion.component : "jre-legacy");
    }
    /**
     * 
     * @returns {Promise<GMLL.runtimes>}
     */
    async getRuntime() {
        const json = await this.getJSON();
        const jre = json.javaVersion ? json.javaVersion.component : "jre-legacy";
        await runtime(jre);
        return jre;
    }

    async install() {
        await this.getJSON();
        await this.getAssets();
        await this.getJar("client", this.folder, this.name + ".jar");
        await this.getRuntime();
    }
    /**
     * @returns {string[]}
     */
    getLibs() {
        return JSON.parse(readFileSync(join(getMeta().libraries, this.manifest.id + ".json")).toString());
    }
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
    return manifests.find(e => { try { return e.id.toLocaleLowerCase().trim() == v } catch {return false; } }) || { id: version, type: "unknown" };
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