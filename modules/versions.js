import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { getMeta, getRuntimes, getVersions } from "./config.js";
import { assets, libraries, runtime } from "./downloader.js";
import { chkLoadSave, getOS, mkdir } from "./internal/util.js";
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
    /**
     * 
     * @param {string | GMLL.json.manifest} manifest 
     */
    constructor(manifest) {
        /**@type {GMLL.json.manifest} */
        this.manifest = typeof manifest == "string" ? getManifest(manifest) : manifest;
        /**@type {GMLL.json.version} */
        this.json;
        this.name = this.manifest.base || this.manifest.id;
        this.folder = join(getVersions(), this.name);
        mkdir(this.folder);
        this.file = join(this.folder, this.manifest.id + ".json");
    }
    /**
     * 
     * @returns {Promise<GMLL.json.version>}
     */
    async getJSON() {
        if (this.json)
            return this.json;
        if (this.manifest.url) {
            this.json = await chkLoadSave(this.manifest.url, this.file, this.manifest.sha1);
        } else if (existsSync(this.file)) {
            this.json = JSON.parse(readFileSync(this.file));
        } else {
            throw this.manifest.type == "unknown"
                ? "Unknown version, please check spelling of given version ID"
                : "Version json is missing for this version!"
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
        return join(getRuntimes(), json.javaVersion ? json.javaVersion.component : "jre-legacy", "bin", getOS() == "windows" ? "java.exe" : "java");
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
        return JSON.parse(readFileSync(join(getMeta().libraries, this.manifest.id+".json")));
    }
}

/**
 * @returns {Array<GMLL.json.manifest>}
 */
export function getManifests() {
    var versionManifest = [];
    const root = getMeta().manifests
    readdirSync(root).forEach(e => {
        if (e.endsWith("json")) {
            var v = JSON.parse(readFileSync(join(root, e)));
            if (v instanceof Array)
                versionManifest.push(...v);
        }
    })
    return versionManifest;
}

/**
 * 
 * @param {GMLL.json.manifest} version 
 * @returns 
 */
export function getManifest(version) {
    const manifests = getManifests();
    const v = version.toLocaleLowerCase().trim();
    return manifests.find(e => e.id.toLocaleLowerCase().trim() == v) || { id: version, type: "unknown" };
}

/**
 * 
 * @returns {{ "release": string, "snapshot": string }};
 */
export function getLatest() {
    const file = join(getMeta().index, "latest.json");
    if (existsSync(file))
        return JSON.parse(readFileSync(file));
    else return { "release": "1.17.1", "snapshot": "21w42a" };
}