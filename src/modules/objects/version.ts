import { existsSync, copyFileSync, readFileSync } from "fs";
import { join } from "path";
import { assets as _assets, jarTypes, manifest, version as _version } from "../..";
import { getlibraries, getVersions, isInitialized } from "../config.js";
import { assets, runtime, libraries } from "../downloader.js";
import { getManifest, getJavaPath } from "../handler.js";
import { dir, file } from "./files";
import { throwErr, classPathResolver, combine } from "../internal/util.js";

/**
 * Version data is unique. Each version of the game will generate an unique version object. 
 * Take note however. GMLL,unlike the default launcher, will store version data in the same folder as the version it is based upon. 
 * If forge still works, but you cannot find the file connected to it...this is why.
 */
export class version {
    json: _version;
    manifest: manifest;
    name: string;
    folder: dir;
    file: file;
    synced: boolean;
    override?: _assets;

    /**Gets a set version based on a given manifest or version string. Either do not have to be contained within the manifest database. */
    static async get(manifest: string | manifest): Promise<version> {
        isInitialized();
        const v = new version(manifest);
        await v.getJSON();
        return v;
    }
    /**
     * @deprecated DO NOT USE CONSTRUCTOR DIRECTLY. FOR INTERNAL USE ONLY! 
     * @see {@link get} : This is the method that should instead be used
     */
    private constructor(manifest: string | manifest) {
        this.manifest = typeof manifest == "string" ? getManifest(manifest) : manifest;
      //  console.log(this.manifest)
        this.json;
        this.name = this.manifest.base || this.manifest.id;
        this.folder = getVersions().getDir(this.name);
        this.file = this.folder.getFile(this.manifest.id + ".json");
        this.synced = true;
        this.folder.mkdir();
    }
    /**
     * @returns Gets the version json file. 
     * @see {@link json} for synchronious way to access this. The {@link get} method already calls this function and saves it accordingly. 
     */
    async getJSON(): Promise<_version> {
        const folder_old = getVersions().getDir(this.manifest.id);
        const file_old = folder_old.getFile(this.manifest.id + ".json");
        if (this.json)
            return this.json;
        if (this.file.sysPath() != file_old.sysPath() && !this.file.exists() && file_old.exists) {
            console.log("[GMLL] Cleaning up versions!")
            const data = file_old.toJSON<_version>();
            this.synced = !data.hasOwnProperty("synced") || data.synced;
            if (this.synced) {
                copyFileSync(file_old.sysPath(), this.file.sysPath());
                folder_old.rm();
            } else {
                console.log("[GMLL] Detected synced is false. Aborting sync attempted");
                const base = (new version(this.json.inheritsFrom));
                this.json = combine(await base.getJSON(), this.json);
                this.json = data
                this.name = data.id;
                this.folder = folder_old;
                this.file = file_old;
            //    console.log(this.json)
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
      //  console.log(this.json, this.manifest)
        if (this.json.inheritsFrom || this.manifest.base) {
            const base = (new version(this.json.inheritsFrom || this.manifest.base));
            this.json = combine(await base.getJSON(), this.json);
            this.folder = base.folder;
            this.name = base.name;
        }
    //    console.log(this.json)

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

    async getJar(type: jarTypes, jarFile: file) {
        if (this.synced && this.json.hasOwnProperty("downloads")) {
            const download = this.json.downloads[type];
            if (!jarFile.sha1(download.sha1) || !jarFile.size(download.size)) {
                return await jarFile.download(download.url);
            }
        }
    }

    async install() {
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
        //cp.push(join("libraries", "inject-1.0-SNAPSHOT.jar"));
        this.json.libraries.forEach(lib => {
            if (mode == "client" && lib.hasOwnProperty("clientreq") && !lib.clientreq) return;
            else if (mode == "server" && !lib.serverreq && lib.hasOwnProperty("clientreq")) return

            const p = join("libraries", ...classPathResolver(lib.name).split("/"));
            if (!cp.includes(p)) cp.push(p);
        });
        const jar = this.folder.getFile(this.name + ".jar");
        if (jar.exists())
            cp.push(jar);

        return cp;
    }
}