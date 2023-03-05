import { createHash, randomInt } from "crypto";
import { instance } from "gmll";
import { emit } from "gmll/config";
import { readDat } from "gmll/nbt";
import { dir, file } from "gmll/objects/files";
import { modInfo, forgeDep, playerDat, playerStats, levelDat, metaSave, instanceMetaPaths, metaResourcePack } from "gmll/types";
import { join } from "path";


/**
     * @returns Some low level meta paths used to obtain some key files of this instance. 
     */
export async function getMetaPaths(this:instance): Promise<instanceMetaPaths> {
    const version = await this.getVersion();
    const p = this.getDir();
    return {
        mods: p.getDir("mods"),
        jarmods: p.getDir("jarmods"),
        saves: p.getDir("saves"),
        resourcePacks: (p.getDir(Date.parse(version.json.releaseTime) >= Date.parse("2013-06-13T15:32:23+00:00") ? "resourcepacks" : "texturepacks")),
        coremods: p.getDir("coremods"),
        configs: p.getDir("config")
    }
}
/**
  * Gets information about mods in this instance. This includes the loader version plus some general 
  * information about the mod author and mod itself. This will also provide you the icon for a set mod if it can be obtained.\
  * 
  * Works with Legacy forge, forge, fabric, riftloader and liteloader
  */
export async function getMods(this:instance): Promise<modInfo[]> {
    emit("parser.start", "mod", this);
    const meta = await this.getMetaPaths();
    let mods: modInfo[] = [];

    const tmp = dir.tmpdir().getDir("gmll", "mods", this.getDir().getName(), createHash("sha1").update(this.getDir().sysPath()).digest("hex")).rm().mkdir();
    async function readMod(file: file, type: "mod" | "coremod" | "jarmod", prefix?: string): Promise<void> {
        let name = file.getName();
        try {
            name = name.slice(0, name.lastIndexOf("."));
            const fname = prefix ? join(prefix, name) : name;
            const d = tmp.getDir(fname).mkdir();
            await file.extract(d, ["mcmod.info", "fabric.mod.json", "litemod.json", "riftmod.json", "META-INF/mods.toml", "META-INF/MANIFEST.MF"]);
            let rfile: file;
            async function getIcon(jarPath: string) {
                if (!jarPath || jarPath.length < 1) return null
                file.extract(d, [jarPath]);
                const fjar = jarPath.split("/");
                console.log(fjar)
                const flogo = d.getFile(...fjar)
                if (flogo.exists()) return `data:image/png;base64,${flogo.toBase64()}`
                return null
            }
            //Legacy forge
            if ((rfile = d.getFile("mcmod.info")).exists()) {
                type minfo = [{ "modid": string, "name": string, "mcversion": string, "description": string, "version": string, "credits": string, "authorsList"?: string[], "authors"?: string[], "logoFile": string, "url": string, "updateUrl": string, "parent": string, "screenshots": string[], "dependencies": string[] }]
                let minfos = rfile.toJSON<minfo>();
                for (let minfo of minfos) {
                    let icon = await getIcon(minfo.logoFile);
                    mods.push({
                        id: minfo.modid,
                        authors: minfo.authorsList ? minfo.authorsList : minfo.authors,
                        loader: "forge",
                        name: minfo.name ? (prefix ? join(prefix, minfo.name) : minfo.name) : name,
                        version: minfo.version,
                        path: file,
                        depends: minfo.dependencies,
                        screenshots: minfo.screenshots,
                        parent: minfo.parent,
                        updateUrl: minfo.updateUrl,
                        url: minfo.url,
                        description: minfo.description,
                        credits: minfo.credits,
                        mcversion: minfo.mcversion,
                        icon, type
                    })
                }
                return
            }
            //Fabric and rift
            if ((rfile = d.getFile("fabric.mod.json")).exists() || (rfile = d.getFile("riftmod.json")).exists()) {
                type finfo = { "schemaVersion": number, "id": string, "version": string, "name": string, "description": string, "authors": string[], "contact": { "homepage": string, "sources": string }, "license": string, "icon": string, "environment": string, "entrypoints": { "main": string[], "client": string[] }, "mixins": string[], "depends": { [key: string]: string }, "suggests": { [key: string]: string } }
                let minfo = rfile.toJSON<finfo>();
                let icon = await getIcon(minfo.icon);
                mods.push({
                    id: minfo.id,
                    authors: minfo.authors,
                    loader: rfile.getName().endsWith("fabric.mod.json") ? "fabric" : "riftMod",
                    name: minfo.name ? (prefix ? join(prefix, minfo.name) : minfo.name) : name,
                    version: minfo.version,
                    path: file,
                    depends: minfo.depends,
                    description: minfo.description,
                    url: minfo.contact?.homepage,
                    source: minfo.contact?.sources,
                    licence: minfo.license,
                    icon, type
                })
                return
            }
            //LiteLoader
            if ((rfile = d.getFile("litemod.json")).exists()) {
                type liteInf = { name: string, displayName: string, version: string, author: string, mcversion: string, revision: string, description: string, url: string }
                let minfo = rfile.toJSON<liteInf>();
                mods.push({
                    id: minfo.name,
                    name: minfo.name ? (prefix ? join(prefix, minfo.name) : minfo.name) : name,
                    authors: [minfo.author],
                    version: minfo.version || minfo.revision || "unknown",
                    loader: "liteLoader",
                    description: minfo.description,
                    type, path: file
                })
                return
            }
            //Modern forge
            if ((rfile = d.getFile("META-INF", "mods.toml")).exists()) {
                let mfinal: modInfo = {
                    type,
                    id: "unknown",
                    authors: [],
                    version: "unknown",
                    loader: "forge",
                    name: name,
                    path: file,
                    depends: [] as forgeDep[]
                };
                let dep: forgeDep = {
                    modId: "",
                    mandatory: false,
                    versionRange: "",
                    ordering: "",
                    side: ""
                };
                let lines = rfile.read().split("\n");

                let inmodHeader = false
                let independency = false

                let state1Map = new Map();
                state1Map.set("license", (val: string) => mfinal.licence = val)
                state1Map.set("credits", (val: string) => mfinal.credits = val)
                state1Map.set("logoFile", async (val: string) => mfinal.icon = await getIcon(val))
                let state2Map = new Map();
                state2Map.set("modId", (val: string) => mfinal.id = val)
                state2Map.set("version", (val: string) => mfinal.version = val)
                state2Map.set("displayURL", (val: string) => mfinal.url = val)
                state2Map.set("updateJSONURL", (val: string) => mfinal.updateUrl = val)
                state2Map.set("credits", (val: string) => mfinal.credits = val)
                state2Map.set("authors", (val: string) => { try { mfinal.authors = val.startsWith("[") ? JSON.parse(val) : [val]; } catch { mfinal.authors = [val] } })
                state2Map.set("description", (val: string) => mfinal.description = val)

                let state3Map = new Map();
                state3Map.set("modId", (val: string) => dep.modId = val)
                state3Map.set("mandatory", (val: string) => dep.mandatory = Boolean(val))
                state3Map.set("versionRange", (val: string) => dep.versionRange = val)
                state3Map.set("ordering", (val: string) => dep.ordering = val)
                state3Map.set("side", (val: string) => dep.side = val)
                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i];
                    line = line.includes("#") ? line.slice(0, line.indexOf("#")) : line;
                    if (line.length < 1) continue;
                    if (line.includes("=")) {
                        const raw = line.split("=")
                        if (raw[1].includes("'''")) {
                            raw[1] = raw[1].slice(3);
                            while (!lines[++i].includes("'''") && i < lines.length) raw[1] += lines[i] + "\n"
                            raw[i] += lines[i].slice(0, lines[i].indexOf("'''"))
                        }
                        raw[1] = raw[1].trim()
                        if (raw[1].startsWith("\"")) raw[1] = raw[1].slice(1);
                        if (raw[1].endsWith("\"")) raw[1] = raw[1].slice(0, raw[1].length - 1);
                        //console.log(raw[1])
                        raw[0] = raw[0].trim();
                        if (state1Map.has(raw[0])) { await state1Map.get(raw[0])(raw[1]); continue; }
                        if (independency && state3Map.has(raw[0])) { await state3Map.get(raw[0])(raw[1]); continue; }
                        if (inmodHeader && state2Map.has(raw[0])) { await state2Map.get(raw[0])(raw[1]); continue; }

                    } else if (line.startsWith("[[mods")) {
                        inmodHeader = true;
                    } else if (line.startsWith("[[dependencies")) {
                        inmodHeader = false;
                        if (independency) {
                            if (!(mfinal.depends instanceof Array)) mfinal.depends = [];
                            mfinal.depends.push(dep)
                            dep = { modId: "", mandatory: false, versionRange: "", ordering: "", side: "" };
                        } else {
                            mfinal.depends = [];
                        }
                        independency = true;
                    }
                }
                if (mfinal.depends instanceof Array) {
                    mfinal.depends.push(dep)
                }
                mods.push(mfinal);
                return
            }
            //Unknown modloader
            if ((rfile = d.getFile("META-INF", "MANIFEST.MF")).exists()) {
                let mfinal: modInfo = {
                    type,
                    id: "unknown",
                    authors: [],
                    version: "unknown",
                    loader: "unknown",
                    name: name,
                    path: file,
                    depends: [] as forgeDep[]
                };

                let lines = rfile.read().split("\n");
                let state1Map = new Map();
                state1Map.set("Manifest-Version", (val: string) => mfinal.version = val)

                state1Map.set("Specification-Title", (val: string) => mfinal.name = val)
                state1Map.set("Specification-Vendor", (val: string) => { if (!mfinal.authors.includes(val)) mfinal.authors.push(val) })
                state1Map.set("Specification-Version", (val: string) => mfinal.version = val)

                state1Map.set("Implementation-Title", (val: string) => mfinal.name = val)
                state1Map.set("Implementation-Version", (val: string) => mfinal.version = val)
                state1Map.set("Implementation-Vendor", (val: string) => { if (!mfinal.authors.includes(val)) mfinal.authors.push(val) })

                state1Map.set("Automatic-Module-Name", (val: string) => mfinal.id = val)

                state1Map.set("Fabric-Minecraft-Version", (val: string) => mfinal.mcversion = val)
                state1Map.set("Fabric-Loom-Version", () => mfinal.loader = "fabric")

                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i];
                    if (line.length < 1) continue;
                    if (!line.includes(":")) continue;
                    const raw = line.split(":")
                    raw[1] = raw[1].trim()
                    if (raw[1].startsWith("\"")) raw[1] = raw[1].slice(1);
                    if (raw[1].endsWith("\"")) raw[1] = raw[1].slice(0, raw[1].length - 1);

                    raw[0] = raw[0].trim();
                    if (state1Map.has(raw[0])) { await state1Map.get(raw[0])(raw[1]); continue; }
                }
                mods.push(mfinal);
                return
            }
            emit('parser.fail', 'mod', "Possibly missing mod data!", file);
            // console.warn(`[GMLL]: Could not parse mod -> ${name}\n[GMLL]: Possibly missing mod data!`)
        } catch (err) {
            emit('parser.fail', 'mod', err, file);

        }

        mods.push({
            id: "unknown",
            authors: [],
            version: "unknown",
            loader: "unknown",
            name: name,
            path: file,
            type,
            error: true
        });
    }
    let c = 0;
    let n = 0;
    async function loop(d: dir, type: "mod" | "coremod" | "jarmod") {
        let l = d.ls();
        c += l.length
        for (const e of l) {
            emit('parser.progress', e.sysPath(), ++n, c, c - n, this);
            if (!(e instanceof file)) {
                for (const e2 of e.ls())
                    if (e2 instanceof file) await readMod(e2, type)
            } else {
                await readMod(e, type)
            }
        }
    }
    await loop(meta.mods, "mod")
    await loop(meta.coremods, "coremod")
    await loop(meta.jarmods, "jarmod")
    emit("parser.done", "mods", this);
    return mods
}


/**
 * Gets some general information about all the world files in this instance.
 * It also decodes the level.DAT file for you and returns the decoded file as a JSON file. 
 * 
 * It also decodes the player data stored in the "playerdata" and "stats" subfolder in newer versions of the game. 
 */
export async function getWorlds(this:instance): Promise<metaSave[]> {
    emit("parser.start", "save file", this);
    console.log("[GMLL]: Getting level data. This may take a while.")
    const meta = await this.getMetaPaths();
    let saves: metaSave[] = [];
    if (!meta.saves.exists()) return saves
    const l = meta.saves.ls()
    let c = l.length;
    let n = 0;
    for (const e of l) {
        try {
            emit('parser.progress', e.sysPath(), ++n, c, c - n, this);
            if (e instanceof file) return;
            const DAT = e.getFile("level.dat");
            const IMG = e.getFile("icon.png");
            const PDAT = e.getDir("playerdata");
            const PSTAT = e.getDir("stats");
            let icon = undefined;
            if (!DAT.exists()) return;
            if (IMG.exists()) icon = IMG.sysPath();
            const level = await readDat<levelDat>(DAT);
            let players: metaSave["players"] = {};
            if (PDAT.exists()) {
                for (const plr of PDAT.ls()) {
                    if (plr instanceof file && plr.name.endsWith(".dat")) {
                        try {
                            const nm = plr.name.substring(0, plr.name.length - 4);
                            const PD = await readDat<playerDat>(plr);
                            let stats = undefined;
                            const statefile = PSTAT.getFile(`${nm}.json`);
                            if (statefile.exists())
                                stats = statefile.toJSON<playerStats>();
                            players[nm] = { "data": PD, stats };
                        } catch (e) {
                            console.warn("[GMLL]: Failed to parse player data!")
                        }
                    }
                }
            } else {
                players["Player"] = { "data": level.Data.Player };
            }

            saves.push({ players, name: level.Data?.LevelName || e.getName(), level, path: e, icon })
        } catch (err) {
            emit('parser.fail', 'save file', err, file);
        }
    }
    emit("parser.done", "save file", this);
    return saves;
}


/**
 * Gets information about the installed resource and texture packs of this instance. 
 * This includes information like the pack icon, name, description, legal documents and credits. 
 */
export async function getResourcePacks(this:instance): Promise<metaResourcePack[]> {
    emit("parser.start", "resource/texture pack", this);
    const meta = await this.getMetaPaths();
    let packs: metaResourcePack[] = [];
    if (!meta.resourcePacks.exists()) return packs
    const l = meta.resourcePacks.ls()
    const tmp = dir.tmpdir().getDir("gmll", "resources", this.getDir().getName(), createHash("sha1").update(this.path).digest("hex")).rm().mkdir();
    function readPackData(d: dir, source: file | dir): metaResourcePack {

        let icon = null;
        const i = d.getFile("pack.png");
        if (i.exists()) {
            icon = `data:image/png;base64,${i.toBase64()}`
        }
        let pack = d.getFile("pack.mcmeta");
        let name = d.getName().replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, ' ');
        let description = "A Minecraft resourcepack/texturepack"
        let format = null;
        if (!pack.exists()) pack = d.getFile("pack.txt")
        if (pack.exists()) {
            try {
                const p = pack.toJSON<{ pack: { pack_format: number, description: string, name: string } }>().pack;
                if (p.name) name = p.name;
                if (p.description) description = p.description;
                if (p.pack_format) format = p.pack_format;
            } catch {
                const r = pack.read().split("\n")
                description = r[randomInt(0, Math.min(r.length, 200))]
            }
        }
        let lfile = d.getFile("licence.txt");
        if (!lfile.exists()) lfile = d.getFile("license.txt");
        if (!lfile.exists()) lfile = d.getFile("terms of use.txt");
        let license = lfile.exists() ? lfile.read() : null
        const lcred = d.getFile("credits.txt");
        let credits = lcred.exists() ? lcred.read() : null

        return { credits, license, name, description, format, icon, path: source }
    }
    let c = l.length;
    let n = 0;
    for (const e of l) {
        emit('parser.progress', e.sysPath(), ++n, c, c - n, this);
        try {
            if (e instanceof file) {
                const name = e.getName();
                const d = tmp.getDir(name.slice(0, name.lastIndexOf(".")))
                await e.unzip(d, ["*/*", "*/"]);
                packs.push(readPackData(d, e))
            } else {
                packs.push(readPackData(e, e))
            }
        } catch (err) {
            emit('parser.fail', 'resource/texture pack', err, file);
        }
    }
    emit("parser.done", "resource/texture pack", this);
    return packs
}
