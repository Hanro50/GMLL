import { existsSync, copyFileSync, readFileSync } from "fs";
import { join } from "path";
import { jarTypes, manifest, version as _version } from "../..";
import { getlibraries, getVersions, isInitialized } from "../config.js";
import { assets, runtime, libraries } from "../downloader.js";
import { getManifest, getJavaPath } from "../handler.js";
import { chkFileDownload2, throwErr, rmdir, mkdir, chkFileDownload, classPathResolver } from "../internal/util.js";

function combine(ob1: any, ob2: any) {
    Object.keys(ob2).forEach(e => {
        if (!ob1[e]) {
            ob1[e] = ob2[e]
        }
        else if (typeof ob1[e] == typeof ob2[e]) {
            if (ob1[e] instanceof Array) {
                let f = []

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
    synced: boolean;


    static async get(manifest: string | manifest): Promise<version> {
        isInitialized();
        const v = new version(manifest);
        await v.getJSON();
        return v;
    }

    private constructor(manifest: string | manifest) {
        this.manifest = typeof manifest == "string" ? getManifest(manifest) : manifest;
        console.log(this.manifest)
        this.json;
        this.name = this.manifest.base || this.manifest.id;
        this.folder = join(getVersions(), this.name);
        this.file = join(this.folder, this.manifest.id + ".json");
        this.synced = true;
        mkdir(this.folder);
    }

    async getJSON(): Promise<_version> {
        const folder_old = join(getVersions(), this.manifest.id);
        const file_old = join(folder_old, this.manifest.id + ".json");
        if (this.json)
            return this.json;
        if (this.file != file_old && !existsSync(this.file) && existsSync(file_old)) {
            console.log("[GMLL] Cleaning up versions!")
            const data = JSON.parse(readFileSync(file_old).toString());
            this.synced = !data.hasOwnProperty("synced") || data.synced;
            if (this.synced) {
                copyFileSync(file_old, this.file);
                rmdir(folder_old);
            } else {
                console.log("[GMLL] Detected synced is false. Aborting sync attempted");
                const base = (new version(this.json.inheritsFrom));
                this.json = combine(await base.getJSON(), this.json);
                this.json = data
                this.name = data.id;
                this.folder = folder_old;
                this.file = file_old;
                console.log(this.json)
                return this.json;
            }
        }
        if (this.manifest.url) {
            const f = (await chkFileDownload2(this.manifest.url, this.manifest.id + ".json", this.folder, this.manifest.sha1)).toString();

            this.json = JSON.parse(f);
        } else if (existsSync(this.file)) {
            this.json = JSON.parse(readFileSync(this.file).toString());
        } else {
            throwErr(this.manifest.type == "unknown"
                ? "Unknown version, please check spelling of given version ID"
                : "Version json is missing for this version!");
        }

        if (this.json.inheritsFrom || this.manifest.base) {
            const base = (new version(this.json.inheritsFrom|| this.manifest.base));
            this.json = combine(await base.getJSON(), this.json);
            this.folder = base.folder;
            this.name = base.name;
        }
        console.log(this.json)

        return this.json;
    }

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

    async getJar(type: jarTypes, jarpath: string, jarname: string) {
        if (this.synced && this.json.hasOwnProperty("downloads")) {
            const download = this.json.downloads[type];
            return await chkFileDownload({ key: this.manifest.id, name: jarname, path: jarpath, url: download.url, size: download.size, sha1: download.sha1 })
        }
    }
    async install() {
        await this.getAssets();
        await this.getLibs();
        await this.getJar("client", this.folder, this.name + ".jar");
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

            const p = join("libraries", ...classPathResolver(lib.name).split("/"));
            if (!cp.includes(p)) cp.push(p);
        });
        const jar = join(this.folder, this.name + ".jar");
        if (existsSync(jar))
            cp.push(jar);

        return cp;
    }
}