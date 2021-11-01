import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream, statSync } from "fs";
import { createHash } from "crypto";
import { getConfig, getVersions } from "./config.js";
import FETCH from "node-fetch";
import { libs, assets as assetDownloader, runtime } from "./downloader.js";
import { mkdir } from "./internal/util.js"
const config = await getConfig();

class chronicle {
    constructor(version) {
        this.version = version.toLocaleLowerCase();
        this.files = { "json": join(config.files.versions, this.version) }
        this.manifest = getVersions().find(e => e.id.toLocaleLowerCase() == this.version) || {};
        this.path = join(config.files.versions, this.version);
        mkdir(this.path);
    }
    /**
     * 
     * @returns {Promise<GMLL.version.structure>}
     */
    async getJson() {
        const jsonManifest = join(this.path, this.version + ".json")
        if (existsSync(jsonManifest)) {
            const text = readFileSync(jsonManifest);
            var shasum = createHash('sha1');
            shasum.update(text);
            if (!this.manifest || !this.manifest.sha1 || shasum.digest('hex') == this.manifest.sha1) {
                return JSON.parse(text);
            }
        }
        if (!this.manifest) { console.error("[GMLL]: Version " + this.version + " does not exist!"); return; };
        const r = await FETCH(this.manifest.url);
        if (r.status != 200) { console.error("[GMLL]: Version " + this.version + " cannot be downloaded"); return; };
        const text = await r.text();
        writeFileSync(jsonManifest, text)
        return JSON.parse(text);

    }
    async chkLibs() {

        const json = await this.getJson();
        await libs(json);
    }
    async chkAssets() {

        const json = await this.getJson();
        const assets = json.assetIndex;
        var result;
        if (!assets) return;
        const indexes = (join(config.files.assets, "indexes"));
        if (!existsSync(indexes)) mkdirSync(indexes);
        const apath = join(indexes, assets.id + ".json");
        async function getJson() {
            const r = await FETCH(assets.url);
            if (r.status != 200) console.error("[GMLL]: Could not download an asset index with the id of " + assets.id);
            var text = await r.text();
            writeFileSync(apath, text);
            result = JSON.parse(text);
        }
        if (existsSync(apath)) {
            const text = readFileSync(apath);
            var shasum = createHash('sha1');
            shasum.update(text);
            if (shasum.digest('hex') == assets.sha1 && text.length == assets.size) {
                result = JSON.parse(text);
            } else await getJson();
        } else await getJson();
        await assetDownloader(result);
        return result;
    }
    async install(type) {
        const json = await this.getJson();
        /**@type {GMLL.version.downloadable} */
        var client = json.downloads[type];
        const apath = this.getJar(json);
        if (existsSync(apath)) {
            if (statSync(apath).size == client.size && createHash('sha1').update(readFileSync(apath)).digest('hex') == client.sha1) {
                return;
            }
            else {
                console.log(statSync(apath).size + "vs" + client.size)
                console.log(createHash('sha1').update(readFileSync(apath)).digest('hex') + "vs" + client.sha1)

            }
        }
        const file = createWriteStream(apath);

        console.log(apath)
        const r = await FETCH(client.url);

        console.log("Downloading client Jar");
        await new Promise(res => { r.body.pipe(file); r.body.on('close', res) });
    }
    /**
     * 
     * @param {GMLL.version.structure} json 
     * @returns 
     */
    getJar(json = { id: this.version }) {
        const ID = (json.inheritsFrom || json.id);
        return join(config.files.versions, ID, ID + ".jar");
    }
    /**
     * @param {GMLL.jarTypes} type 
     */
    async setup(type = "client") {
        await this.install(type);
        await runtime();
        await this.chkLibs();
        await this.chkAssets();


    }
};

/**
 * 
 * @param {string} version 
 * @returns {chronicle}
 */
export function getChronicle(version) {
    return new chronicle(version);
}


