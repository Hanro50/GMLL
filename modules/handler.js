const p = require("path");
const r = process.cwd();
const fs = require("fs");
const datafolder = p.join(r, ".minecraft");
const crypto = require("crypto");
require("./config").chkFiles();
require("./modloaders")
/**
 * @type {(input: RequestInfo, init?: RequestInit) => Promise<Response>}
 */
const FETCH = require("node-fetch");
const files = {
    minecraft: datafolder,
    instances: p.join(datafolder, "instances"),
    assets: p.join(datafolder, "assets"),
    versions: p.join(datafolder, "versions"),
    natives: p.join(datafolder, "natives"),
    launcher: p.join(datafolder, "launcher"),
    runtimes: p.join(datafolder, "runtimes")
};
module.exports.files = files;
const downloader = require("./downloader")

const launcherFiles = {
    versions: p.join(files.launcher, "versions.json"),
    latest: p.join(files.launcher, "latest.json"),
    patch: p.join(files.launcher, "patch.json"),
    config: p.join(files.launcher, "config.json")
}

module.exports.update = async () => {
    const r = await FETCH("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json");
    if (r.status != 200) { console.error("[GMLL]: Could not update version manifest!"); return; }
    const json = await r.json();
    if (fs.existsSync(launcherFiles.patch)) {
        json.versions.push(...JSON.parse(fs.readFileSync(launcherFiles.patch)))
    }
    fs.writeFileSync(launcherFiles.latest, JSON.stringify(json.latest, "\n", "\t"));
    fs.writeFileSync(launcherFiles.versions, JSON.stringify(json.versions, "\n", "\t"));
}

module.exports.fileChk = () => {
    if (!fs.existsSync(datafolder)) {
        fs.mkdirSync(datafolder);
    }
    Object.values(files).forEach(e => {
        if (!fs.existsSync(e)) {
            fs.mkdirSync(e);
        }
    })
}

module.exports.getLatest = () => {
    if (fs.existsSync(launcherFiles.latest))
        return JSON.parse(fs.readSync(launcherFiles.latest));
    else return { "release": "1.17.1", "snapshot": "21w42a" };
}
class version {
    constructor(version) {
        this.version = version.toLocaleLowerCase();
        this.files = { "json": p.join(files.versions, this.version) }
        this.getManifest();
        this.path = p.join(files.versions, this.version);
        if (!fs.existsSync(this.path)) fs.mkdirSync(this.path);
    }
    async getManifest() {
        if (!this.manifest) {
            if (!fs.existsSync(launcherFiles.versions)) { console.error("[GMLL]: Could not find version manifest!"); await update(); };
            /**@type {Array<GMLL.version>} */
            const json = JSON.parse(fs.readFileSync(launcherFiles.versions));
            this.manifest = json.find(e => e.id.toLocaleLowerCase() == this.version.toLocaleLowerCase());
        }
        return this.manifest;

    }
    async getJson() {
        await this.getManifest();
        const jsonManifest = p.join(this.path, this.version + ".json")
        if (fs.existsSync(jsonManifest)) {
            const text = fs.readFileSync(jsonManifest);
            var shasum = crypto.createHash('sha1');
            shasum.update(text);
            if (!this.manifest || !this.manifest.sha1 || shasum.digest('hex') == this.manifest.sha1) {
                return JSON.parse(text);
            }
        }
        if (!this.manifest) { console.error("[GMLL]: Version " + this.version + " does not exist!"); return; };
        const r = await FETCH(this.manifest.url);
        if (r.status != 200) { console.error("[GMLL]: Version " + this.version + " cannot be downloaded"); return; };
        const text = await r.text();
        fs.writeFileSync(jsonManifest, text)
        return JSON.parse(text);

    }
    async chkLibs() {
        await this.getManifest();
        const json = await this.getJson();
        downloader.libs(json);
    }
    async chkAssets() {
        await this.getManifest();
        const json = await this.getJson();
        const assets = json.assetIndex;
        var result;
        if (!assets) return;
        const indexes = (p.join(files.assets, "indexes"));
        if (!fs.existsSync(indexes)) fs.mkdirSync(indexes);
        const apath = p.join(indexes, assets.id + ".json");
        async function getJson() {
            const r = await FETCH(assets.url);
            if (r.status != 200) console.error("[GMLL]: Could not download an asset index with the id of " + assets.id);
            var text = await r.text();
            fs.writeFileSync(apath, text);
            result = JSON.parse(text);
        }
        if (fs.existsSync(apath)) {
            const text = fs.readFileSync(apath);
            var shasum = crypto.createHash('sha1');
            shasum.update(text);
            if (shasum.digest('hex') == assets.sha1 && text.length == assets.size) {
                result = JSON.parse(text);
            } else await getJson();
        } else await getJson();
        downloader.assets(result);
        return result;

    }
};

module.exports.version = version;
if (!fs.existsSync(launcherFiles.latest) || !fs.existsSync(launcherFiles.versions)) {
    this.fileChk();
    this.update();
}

const v = new version("1.17.1");
v.getManifest()
v.getJson().catch(console.log)
//v.chkLibs();
//v.chkAssets();
downloader.runtime()