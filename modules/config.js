import { existsSync, readSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import EventEmitter from 'events';
import { join } from "path";
import Fetch from "node-fetch";
import { mkdir } from "./internal/util.js";
/**@type {GMLL.config.metafiles} */
var metaFiles;
const defEvents = new EventEmitter()
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
})

let datafolder = join(process.cwd(), ".minecraft");
/**@type {GMLL.config} */
const defConfig = {
    files: {
        minecraft: datafolder,
        instances: join(datafolder, "instances"),
        assets: join(datafolder, "assets"),
        versions: join(datafolder, "versions"),
        natives: join(datafolder, "natives"),
        launcher: join(datafolder, "launcher"),
        runtimes: join(datafolder, "runtimes"),
        libraries: join(datafolder, "libraries"),

    },
    update: ["fabric", "vanilla", "files", "runtime"],
    events: defEvents,
}
/**@type {GMLL.config.impl} */
var mainConfig;
/**
 * 
 * @param {GMLL.config?} config
 */
export async function setConfig(config) {
    if (config) {
        if (!config.files || typeof config.files != Array) {
            mainConfig = defConfig.files;
        } else {
            mainConfig.files = {};
            Object.keys(defConfig).forEach(e => {
                mainConfig.files[e] = config.files[e] || defConfig.files[e];
            })
        }
        mainConfig.update = config.update || defConfig.update;
        mainConfig.events = config.events || defConfig.events;
    } else {
        mainConfig = defConfig;
    }
    await reload()
}
export async function reload() {
    metaFiles = {
        profile: join(mainConfig.files.launcher, "profile"),
        version: {
            folder: join(mainConfig.files.launcher, "manifest"),
            latest: join(mainConfig.files.launcher, "manifest", "latest.json"),
            vanilla: join(mainConfig.files.launcher, "manifest", "vanilla.json"),
            fabric: join(mainConfig.files.launcher, "manifest", "fabric.json"),
            forge: join(mainConfig.files.launcher, "manifest", "forge.json"),
        },
        launcher: {
            runtime: join(mainConfig.files.launcher, "runtime.json"),
            instances: join(mainConfig.files.launcher, "instances.json"),
            libIndex: join(mainConfig.files.launcher, "libraries"),
            profiles: join(datafolder, "launcher", "profile")
        },
        assets: {
            resources: join(mainConfig.files.assets, "legacy", "resources"),
            virtual: join(mainConfig.files.assets, "legacy", "virtual"),
            indexes: join(mainConfig.files.assets, "indexes")
        }
    }
    Object.keys(mainConfig.files).forEach(e => {
        mkdir(mainConfig.files[e]);
    })

    writeFileSync(join(mainConfig.files.minecraft, "launcher_profiles.json"), JSON.stringify({ "clientToken": "Dummy file!", "launcherVersion": { "format": 21, "profilesFormat": 2 }, "profiles": {}, "settings": {} }))
    mkdir(metaFiles.version.folder);
    if (mainConfig.update.includes("vanilla")) {
        const r = await Fetch("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json");
        if (r.status == 200) {
            const json = await r.json();

            writeFileSync(metaFiles.version.latest, JSON.stringify(json.latest, "\n", "\t"));
            writeFileSync(metaFiles.version.vanilla, JSON.stringify(json.versions, "\n", "\t"));
        }
    }
    if (mainConfig.update.includes("fabric")) {
        const rg = await Fetch("https://meta.fabricmc.net/v2/versions/game/");
        const rg2 = await Fetch("https://meta.fabricmc.net/v2/versions/loader/");
        if (rg2.status == 200 && rg.status == 200) {
            /**@type {Array} */
            const jsgame = await rg.json();
            const jsloader = await rg2.json();
            const result = [];
            jsgame.forEach(game => {
                const version = game.version;
                jsloader.forEach(l => {
                    result.push(
                        {
                            id: "fabric-loader-" + l.version + "-" + version,
                            base: version,
                            stable: l.stable,
                            type: "fabric",
                            url: "https://meta.fabricmc.net/v2/versions/loader/" + version + "/" + l.version + "/profile/json"
                        })
                })
            })
            writeFileSync(metaFiles.version.fabric, JSON.stringify(result, "\n", "\t"));
        }
    }//forge
    if (mainConfig.update.includes("runtime")) {
        const r = await Fetch("https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json");
        if (r.status == 200) {
            var data = await r.json();
            writeFileSync(metaFiles.launcher.runtime, JSON.stringify(data, "\n", "\t"));
        }
    }
}
export async function getConfig() {
    if (!mainConfig) {
        await setConfig()
    }
    return { ...mainConfig, metaFiles };
}
/**
 * 
 * @returns {{ "release": string, "snapshot": string }};
 */
export function getLatest() {
    if (existsSync(metaFiles.launcher.latest))
        return JSON.parse(readSync(metaFiles.launcher.latest));
    else return { "release": "1.17.1", "snapshot": "21w42a" };
}
/**
 * @returns {Array<GMLL.manifests.version>}
 */
export function getVersions() {
    var versionManifest = [];

    readdirSync(metaFiles.version.folder).forEach(e => {
        if (e.endsWith("json")) {
            var v = JSON.parse(readFileSync(join(metaFiles.version.folder, e)));
            if (v instanceof Array)
                versionManifest.push(...v);
        }
    })
    return versionManifest;
}

export function getRuntime() {
    if (existsSync(metaFiles.launcher.runtime))
        return JSON.parse(readFileSync(metaFiles.launcher.runtime));
    return {
        "gamecore": { "java-runtime-alpha": [], "jre-legacy": [], "minecraft-java-exe": [] },
        "linux": { "java-runtime-alpha": [], "jre-legacy": [], "minecraft-java-exe": [] },
        "linux-i386": { "java-runtime-alpha": [], "jre-legacy": [], "minecraft-java-exe": [] },
        "mac-os": { "java-runtime-alpha": [], "jre-legacy": [], "minecraft-java-exe": [] },
        "windows-x64": { "java-runtime-alpha": [], "jre-legacy": [], "minecraft-java-exe": [] },
        "windows-x86": { "java-runtime-alpha": [], "jre-legacy": [], "minecraft-java-exe": [] }
    }
}