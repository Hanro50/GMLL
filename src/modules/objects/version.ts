import { copyFileSync } from "fs";
import { join } from "path";

import { getlibraries, getMeta, getVersions, isInitialized, onUnsupportedArm } from "../config.js";
import { runtime, libraries, assets } from "../downloader.js";
import { getManifest, getJavaPath } from "../handler.js";
import { dir, file } from "./files";
import { throwErr, classPathResolver, combine, lawyer } from "../internal/util.js";
import {  mcJarTypeVal, versionManifest, versionJson, artifact } from "../../types.js";

/**
 * Version data is unique. Each version of the game will generate an unique version object. 
 * Take note however. GMLL,unlike the default launcher, will store version data in the same folder as the version it is based upon. 
 * If forge still works, but you cannot find the file connected to it...this is why.
 */
export default class version {
    json: versionJson;
    manifest: versionManifest;
    name: string;
    folder: dir;
    file: file;
    synced: boolean;
    override?: artifact;
    private _mergeFailure: boolean;
    /**Gets a set version based on a given manifest or version string. Either do not have to be contained within the manifest database. */
    static async get(manifest: string | versionManifest): Promise<version> {
        isInitialized();
        const v = new this(manifest);
        await v.getJSON();
        return v;
    }
    /**
     *  DO NOT USE CONSTRUCTOR DIRECTLY. FOR INTERNAL USE ONLY! 
     * @see {@link get} : This is the method that should instead be used
     */
    private constructor(manifest: string | versionManifest) {

        this.manifest = typeof manifest == "string" ? getManifest(manifest) : manifest;
        if (onUnsupportedArm && Date.parse(this.manifest.releaseTime) < Date.parse("2022-05-12T15:36:11+00:00")) {
            console.trace(manifest)
            throw "Only 1.19 and up is supported on arm based Windows and Linux devices atm."
        }
        //  console.log(this.manifest)
        this.json;
        this.name = this.manifest.base || this.manifest.id;
        this.folder = getVersions().getDir(this.name);
        this.file = this.folder.getFile(this.manifest.id + ".json");
        this.synced = true;
        this.folder.mkdir();


    }
    mergeFailure() {
        return this._mergeFailure;
    }
    /**
     * @returns Gets the version json file. 
     * @see {@link json} for synchronious way to access this. The {@link get} method already calls this function and saves it accordingly. 
     */
    async getJSON(): Promise<versionJson> {


        const folder_old = getVersions().getDir(this.manifest.id);
        const file_old = folder_old.getFile(this.manifest.id + ".json");
        if (this.json && !this._mergeFailure)
            return this.json;
        this._mergeFailure = false;
        if (this.file.sysPath() != file_old.sysPath() && !this.file.exists() && file_old.exists()) {
            console.log("[GMLL]: Cleaning up versions!")
            this.json = file_old.toJSON<versionJson>();
            this.synced = !this.json.hasOwnProperty("synced") || this.json.synced;
            if (this.synced) {
                copyFileSync(file_old.sysPath(), this.file.sysPath());
                folder_old.rm();
            } else {
                try {
                    console.log("[GMLL]: Detected synced is false. Aborting sync attempted");
                    const base = (new version(this.json.inheritsFrom));
                    this.json = combine(await base.getJSON(), this.json);
                    this.json = this.json
                    this.name = this.json.id;
                    this.folder = folder_old;
                    this.file = file_old;
                } catch (e) {
                    console.warn("[GMLL]: Dependency merge failed.");
                    this._mergeFailure = true;
                }
                if (onUnsupportedArm) { this.json = combine(this.json, getMeta().index.getFile("arm-patch.json").toJSON()) }
                return this.json;
            }
        }
        if (this.manifest.url) {
            this.json = (await this.folder.getFile(this.manifest.id + ".json").download(this.manifest.url, { sha1: this.manifest.sha1 })).toJSON();
        } else if (this.file.exists()) {
            this.json = this.file.toJSON();
        } else {
            throwErr(this.manifest.type == "unknown"
                ? "Unknown version, please check spelling of given version ID"
                : "Version json is missing for this version!");
        }
        if (this.json.inheritsFrom || this.manifest.base) {
            try {
                const base = (new version(this.json.inheritsFrom || this.manifest.base));
                this.json = combine(await base.getJSON(), this.json);
                this.folder = base.folder;
                this.name = base.name;
            } catch (e) {
                console.warn("[GMLL]: Dependency merge failed.");
                this._mergeFailure = true;
            }
        }
        if (onUnsupportedArm) { this.json = combine(this.json, getMeta().index.getFile("arm-patch.json").toJSON()) }
        return this.json;
    }
    /**
     * Installs the asset files for a set version
     */
    async getAssets() {
        if (!this.json.assetIndex) {
            const base = await (new version("1.0")).getJSON();
            this.json.assetIndex = base.assetIndex;
        }
        await assets(this.json.assetIndex);

    }
    async getRuntime() {
        const jre = this.json.javaVersion ? this.json.javaVersion.component : "jre-legacy";
        await runtime(jre);
        return jre;
    }
    async getLibs() {
        await libraries(this.json);
    }
    async getJar(type: mcJarTypeVal, jarFile: file) {
        if (this.synced && this.json.hasOwnProperty("downloads")) {
            const download = this.json.downloads[type];
            if (!jarFile.sha1(download.sha1) || !jarFile.size(download.size)) {
                return await jarFile.download(download.url);
            }
        }
    }
    async install() {

        if (this._mergeFailure) {
            this._mergeFailure = false;
            console.log("[GMLL]: Correcting earlier dependency merge failure.");
            delete this.json;
            this.json = await this.getJSON();
        }
        await this.getAssets();
        await this.getLibs();
        await this.getJar("client", this.folder.getFile(this.name + ".jar"));
        await this.getRuntime();
    }
    getJavaPath() {
        return getJavaPath(this.json.javaVersion ? this.json.javaVersion.component : "jre-legacy");
    }
    getClassPath(mode: "client" | "server" = "client") {
        const cp = [];
        this.json.libraries.forEach(lib => {
            if (mode == "client" && lib.hasOwnProperty("clientreq") && !lib.clientreq) return;
            else if (mode == "server" && !lib.serverreq && lib.hasOwnProperty("clientreq")) return
            if (lib.rules && !lawyer(lib.rules)) { return }

            const p = join("libraries", ...classPathResolver(lib.name).split("/"));
            const p2 = getlibraries().getDir("..").getFile(p);
            if (!p2.exists()) {
                console.error(p + " does not exist. Removing to avoid possible error");
            }
            else if (!cp.includes(p)) cp.push(p);
        });
        const jar = this.folder.getFile(this.name + ".jar");
        if (jar.exists())
            cp.push(jar);

        return cp;
    }
}