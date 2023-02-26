import { spawn } from "child_process";
import { join } from "path";
import { assetTag, combine, fsSanitiser, getClientID, getCpuArch, lawyer, processAssets, throwErr } from "../internal/util.js";
import { dir, file, packAsync } from "./files.js";
import { cpus, platform, type } from "os";
import { getLatest, installForge, getJavaPath } from "../handler.js";
import { emit, getAssets, getLauncherName, getLauncherVersion, getlibraries, getMeta, getNatives, resolvePath } from "../config.js";

import version from "./version.js";

import { download, runtime } from "../downloader.js";
import { assetIndex, downloadableFile, forgeDep, instanceMetaPaths, instancePackConfig, launchArguments, launchOptions, levelDat, metaResourcePack, metaSave, modInfo, player, playerDat, playerStats, versionJson, versionManifest } from "../../types";
import { createHash, randomInt, randomUUID } from "crypto";
import { readDat } from "../nbt.js";
import { proximate } from "../internal/proxy.js";
import { Server } from "http";

/**
 * For internal use only
 */
function parseArguments(val = {}, args: launchArguments) {
    let out = ""
    args.forEach(e => {
        if (typeof e == "string")
            out += "\u0000" + e.trim().replace(/\s/g, "");
        else if (lawyer(e.rules, val))
            out += "\u0000" + (e.value instanceof Array ? e.value.join("\u0000") : e.value);
    })
    return out
}
async function jarmod(metapaths: instanceMetaPaths, version: version): Promise<file> {
    const jarmods = metapaths.jarmods;
    const bin = dir.tmpdir().getDir("gmll", "bin").rm().mkdir();
    const custom = bin.getFile(`${version.name}.jar`);

    if (!jarmods || !jarmods.exists()) return
    const lst = jarmods.ls();
    if (lst.length < 1) return;
    console.warn("Jar modding is experimental atm.\nWe still don't have a way to order jars\nRecommended for modding legacy versions or mcp...")
    console.log("Packing custom jar")
    const tmp = dir.tmpdir().getDir("gmll", "tmp").rm().mkdir()
    const jar = version.folder.getFile(version.name + ".jar");
    if (!jar.exists()) return;
    await jar.unzip(tmp, ["META-INF/*"]);

    let priority = { "_comment": "0 is the default, the lower the priority. The sooner a mod will be loaded. Deleting this file resets it" };
    const pfile = jarmods.getFile("priority.json");
    let freset = false;
    if (pfile.exists()) {
        try {
            priority = pfile.toJSON();
        } catch (e) {

        }
    } else freset = true
    lst.sort((aF, bF) => {
        const a = aF.getName();
        const b = bF.getName();
        if (priority[a] != priority[b]) {
            if (a in priority && b in priority) return priority[a] - priority[b];
            if (a in priority) return priority[a];
            if (b in priority) return 0 - priority[b];
        }
        return (a > b ? 1 : -1);
    })

    console.log("Running through files")
    for (const e of lst) {
        if (e instanceof file) {
            const n = e.getName()
            console.log(n)
            if (n.endsWith(".zip") || n.endsWith(".jar")) {
                if (!(n in priority)) {
                    priority[n] = freset ? (Object.keys(priority).length - 1) * 10 : 0;
                }
                await e.unzip(tmp);
            }
        }
    }
    pfile.write(priority);
    console.log("Packing jar")
    await packAsync(tmp.sysPath() + (platform() == "win32" ? "\\." : "/."), custom.sysPath());
    return custom;
}

/**
 * An instance is what the name intails. An instance of the game Minecraft containing Minecraft specific data.
 * This information on where the game is stored and the like. The mods installed and what not. 
 */
export default class instance {
    env: any;
    name: string;
    version: string;
    ram: number;
    meta: any;
    private path: string;
    assets: Partial<assetIndex>;
    javaPath: "default" | string;
    /**Gets a list of profiles that where saved previously */
    static getProfiles() {
        const profiles: Map<string, (launchOptions & { get: () => instance })> = new Map();
        getMeta().profiles.ls().forEach(e => {
            if (e instanceof file && e.getName().endsWith(".json")) {
                const profile = e.toJSON<launchOptions>()
                profiles.set(profile.name, { ...profile, get: () => this.get(e.getName()) })
            }
        })
        return profiles;
    }
    /**Gets a set profile based on the name of that profile */
    static get(profile: string) {
        if (!profile.endsWith(".json")) profile += ".json"
        const _file = getMeta().profiles.getFile(fsSanitiser(profile));
        const json = _file.exists() ? _file.toJSON<launchOptions>() : {};
        return new instance(json);
    }
    /**Additional arguments added for legacy versions */
    static oldJVM = [

        "-Dhttp.proxyHost=127.0.0.1", "-Dhttp.proxyPort=${port}",


        "-Djava.util.Arrays.useLegacyMergeSort=true"
    ]

    /**The default game arguments, don't mess with these unless you know what you are doing */
    static defaultGameArguments = [
        "-Xms${ram}M",
        "-Xmx${ram}M",
        "-XX:+UnlockExperimentalVMOptions",
        "-XX:+UseG1GC",
        "-XX:G1NewSizePercent=20",
        "-XX:G1ReservePercent=20",
        "-XX:MaxGCPauseMillis=50",
        "-XX:G1HeapRegionSize=32M",
        "-Dlog4j2.formatMsgNoLookups=true"
    ]
    /**Do not mess with unless you know what you're doing. Some older versions may not launch if information from this file is missing. */
    static defJVM: launchArguments = [
        { "rules": [{ "action": "allow", "os": { "name": "osx" } }], "value": ["-XstartOnFirstThread"] },
        { "rules": [{ "action": "allow", "os": { "name": "windows" } }], "value": "-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump" },
        { "rules": [{ "action": "allow", "os": { "name": "windows", "version": "^10\\." } }], "value": ["-Dos.name=Windows 10", "-Dos.version=10.0"] },
        { "rules": [{ "action": "allow", "os": { "arch": "x86" } }], "value": "-Xss1M" },
        "-Djava.library.path=${natives_directory}",
        "-Dminecraft.launcher.brand=${launcher_name}",
        "-Dminecraft.launcher.version=${launcher_version}",
        "-cp",
        "${classpath}"
    ]
    /**@param opt This parameter contains information vital to constructing the instance. That being said, GMLL will never the less pull in default values if it is emited*/
    constructor(opt: launchOptions = {}) {
        this.version = opt.version || getLatest().release;
        this.name = opt.name || this.version;
        this.path = opt.path || join("<instance>", fsSanitiser(this.name));
        this.ram = opt.ram || 2;
        this.meta = opt.meta || undefined;
        this.assets = opt.assets || {};
        this.javaPath = opt.javaPath || "default";
        this.env = opt.env || {};
        new dir(this.getPath()).mkdir();
        const MESA = "MESA_GL_VERSION_OVERRIDE"
        if (!["x64", "arm64", "ppc64"].includes(getCpuArch()) && this.ram > 1.4) {
            console.warn("[GMLL]: Setting ram limit to 1.4GB due to running on a 32-bit version of java!")
            this.ram = 1.4;
        }
        if (!(MESA in this.env) && process.platform == "linux") {
            this.env[MESA] = "4.6"
        }
    }
    /**
     * Inject custom assets into the game.
     * @param key The asset key
     * @param path The path to the asset file in questions...it must exist!
     */
    injectAsset(key: string, path: string | file) {
        if (typeof path == "string") path = new file(path);
        if (!path.exists()) throwErr("Cannot find file");
        const hash = path.getHash();
        path.copyTo(assetTag(getAssets().getDir("objects"), hash).getFile(hash));
        if (!this.assets.objects) this.assets.objects = {};
        const asset = { hash: hash, size: path.getSize(), ignore: true };
        this.assets.objects[key] = asset;
        return asset
    }
    /**Injects a set selection of images into the asset files and sets them as the icon for this instance */
    setIcon(x32?: string | file, x16?: string | file, mac?: string | file) {
        if (x32) {
            const x32Icon = this.injectAsset("icons/icon_32x32.png", x32);
            this.assets.objects["minecraft/icons/icon_32x32.png"] = x32Icon;
        }
        if (x16) {
            const x16Icon = this.injectAsset("icons/icon_16x16.png", x16);
            this.assets.objects["minecraft/icons/icon_16x16.png"] = x16Icon;
        }
        if (mac) {
            const macIcon = this.injectAsset("icons/minecraft.icns", mac);
            this.assets.objects["minecraft/icons/minecraft.icns"] = macIcon;
        }
    }
    /**
     * @returns A absolute path leading to this instance
     */
    getPath() {
        return resolvePath(this.path);
    }
    /**
       * @returns A absolute path leading to this instance in the internal format GMLL uses as a file format
       */
    getDir() {
        return new dir(this.getPath());
    }
    /**
     * 
     * @returns An object containing the version data this instance is based on
     * @see {@link install} if you want to initiate that version object first!
     */
    async getVersion() {
        return await version.get(this.version)
    }
    /**
     * Saves the instance data. Can be used to automatically get the instance again by using it's name
     * @see {@link get} for more info
     */
    save() {
        getMeta().profiles.getFile(fsSanitiser(this.name + ".json")).write(this);
        return this;
    }
    /**
     * This will tell GMLL to rerun some of the install scripts it normally skips upon a second "install" call.
     * This won't reset worlds or rewrite dynamic files. Use this if, for instance, forge failed to install. 
     */
    reinstall() {
        this.getDir().getFile(".installed.txt").rm();
    }
    /**
     * Runs the installer script without launching MC
     * @returns The instance's version object. 
     * @see {@link getVersion} if you just want the instance's version
     */
    async install() {
        //Making links
        getlibraries().linkFrom([this.getPath(), "libraries"]);
        getAssets().linkFrom([this.getPath(), "assets"]);
        const version = await this.getVersion();
        //     console.log(version.json)
        if (version.json.instance) {
            const chk = this.getDir().getFile(".installed.txt");

            if (version.mergeFailure())
                chk.rm()

            let security = false;
            //patch download files 
            const insta = version.json.instance;
            for (var i = 0; i < insta.files.length; i++) {
                insta.files[i].path = [this.getPath(), ...insta.files[i].path]
                insta.files[i].path.forEach(e => {
                    if (e.includes(".."))
                        security = true;
                })
                new dir(...insta.files[i].path).mkdir()
                if (insta.files[i].unzip) {
                    insta.files[i].unzip.file = [this.getPath(), ...insta.files[i].unzip.file]
                }
            }
            if (security) {
                /**DO NOT REMOVE. 
                 * 1) This is here to prevent someone escaping the instance sandbox. 
                 * 2) This stops non standard modpacks causing issues...
                 * 3) This is here to allow for future security measures
                 */
                throw "Security exception!\nFound '..' in file path which is not allowed as it allows one to escape the instance folder"
            }

            await download(insta.files)
            if (!chk.exists()) {
                if (insta.meta)
                    this.meta = combine(this.meta, insta.meta);
                if (insta.assets)
                    this.assets = combine(insta.assets, this.assets);
                if (insta.forge) {
                    const fFile = new file(this.getPath(), ...insta.forge.installer)
                    if (!fFile.exists()) {
                        throw "Cannot find forge installer"
                    }
                    await installForge(fFile);
                }

            }
            chk.write(Date.now().toString());
        }
        await version.install();
        return version;
    }
    /**
     * This function is used to launch the game. It also runs the install script for you. 
     * This essentially does an integraty check. 
     * @param token The player login token
     * @param resolution Optional information defining the game's resolution
     */
    async launch(token: player, resolution?: { width: string, height: string }) {
        //const metapaths = (await this.getMetaPaths());
        if (!token) {
            console.warn("[GMLL]: No token detected. Launching game in demo mode!")
            const demoFile = getMeta().index.getFile("demo.txt");
            if (!demoFile.exists()) demoFile.write(randomUUID());

            token = {
                profile: {
                    id: demoFile.read(),
                    demo: true,
                    name: "player"
                },
                access_token: ""
            }
        }
        const version = await this.install();
        let jarmoded = await jarmod(await this.getMetaPaths(), version)
        let cp: string[] = version.getClassPath(undefined, jarmoded);

        var vjson = await version.getJSON();
        var assetRoot = getAssets();

        var assetsFile = this.getDir().getDir("assets");

        let AssetIndex = getAssets().getFile("indexes", (vjson.assets || "pre-1.6") + ".json").toJSON<assetIndex>();
        let assets_index_name = vjson.assetIndex.id;
        if (this.assets.objects) {
            AssetIndex = combine(AssetIndex, this.assets);
            assets_index_name = (fsSanitiser(assets_index_name + "_" + this.name))
            getAssets().getFile("indexes", (assets_index_name + ".json")).write(AssetIndex);
            processAssets(AssetIndex);
        }


        if (AssetIndex.virtual || AssetIndex.map_to_resources) {
            assetRoot = getAssets().getDir("legacy", AssetIndex.virtual ? "virtual" : "resources");
            assetsFile = this.getDir().getFile("resources").rm();
            assetRoot.linkFrom(assetsFile);
        }

        const classpath_separator = type() == "Windows_NT" ? ";" : ":";
        const classPath = cp.join(classpath_separator);

        const args = {
            ram: Math.floor(this.ram * 1024),
            cores: cpus().length,

            is_demo_user: !!token.profile.demo,
            has_custom_resolution: !!resolution,
            resolution_width: resolution ? resolution.width : "",
            resolution_height: resolution ? resolution.height : "",

            auth_player_name: token.profile.name,
            version_name: vjson.inheritsFrom || vjson.id,
            game_directory: this.getPath(),

            assets_root: assetsFile,
            assets_index_name: assets_index_name,
            auth_uuid: token.profile.id,
            user_type: token.profile.type,
            auth_xuid: token.profile.xuid,
            clientid: getClientID(),

            version_type: vjson.type,
            auth_access_token: token.access_token,

            natives_directory: getNatives(),
            launcher_name: getLauncherName(),
            launcher_version: getLauncherVersion(),
            classpath: classPath,
            auth_session: "token:" + token.access_token,
            game_assets: assetsFile,

            classpath_separator: classpath_separator,
            library_directory: getlibraries(),
            user_properties: JSON.stringify(token.profile.properties || {}),

            port: 0
        }
        const javaPath = this.javaPath == "default" ? version.getJavaPath() : new file(this.javaPath);
        const rawJVMargs: launchArguments = instance.defaultGameArguments;

        rawJVMargs.push(...(vjson.arguments?.jvm || instance.defJVM));
        //AssetIndex.virtual || AssetIndex.map_to_resources
        //  if (version.manifest.releaseTime && Date.parse(version.manifest.releaseTime) < Date.parse("2012-11-18T22:00:00+00:00")) {
        let proxy: Server
        if (AssetIndex.virtual || AssetIndex.map_to_resources) {
            // if (this.getDir().getFile("resources").islink()) this.getDir().getFile("resources").rm();
            const px = await proximate(AssetIndex);
            args.port = px.port;
            console.log("USING PORT" + px.port)
            rawJVMargs.push(...instance.oldJVM);
            proxy = px.server;
        }
        var jvmArgs = parseArguments(args, rawJVMargs);

        let gameArgs = vjson.arguments ? parseArguments(args, vjson.arguments.game) : "";
        gameArgs += vjson.minecraftArguments ? "\x00" + vjson.minecraftArguments.replace(/\s/g, "\x00") : "";

        var launchCom = jvmArgs + "\x00" + vjson.mainClass + (!gameArgs.startsWith("\x00") ? "\x00" : "") + gameArgs;


        Object.keys(args).forEach(key => {
            const regex = new RegExp(`\\\$\{${key}\}`, "g")
            launchCom = launchCom.replace(regex, args[key])
        })
        emit("jvm.start", "Minecraft", this.getPath());
        const largsL = launchCom.trim().split("\x00");
        if (largsL[0] == '') largsL.shift();
        //console.debug(largsL)
        const s = spawn(javaPath.sysPath(), largsL, { "cwd": this.getPath(), "env": combine(process.env, this.env) })
        s.stdout.on('data', (chunk) => emit("jvm.stdout", "Minecraft", chunk));
        s.stderr.on('data', (chunk) => emit("jvm.stderr", "Minecraft", chunk));
        if (proxy) s.on("exit", () => proxy.close())

    }

    /**An version of the wrap function that takes an object as a variable instead of the mess the base function takes. */
    pack(config: instancePackConfig) {
        if (typeof config.forgeInstallerPath == "string") config.forgeInstallerPath = new file(config.forgeInstallerPath);

        return this.wrap(config.baseDownloadLink, config.outputDir, config.modpackName, config.forgeInstallerPath, config.trimMisc)
    }

    /**Wraps up an instance in a prepackaged format that can be easily uploaded to a server for distribution 
     * @param baseUrl The base URL the generated files will be stored within on your server. For example http\:\/\/yourawesomdomain.net\/path\/to\/files\/
     * @param save The file GMLL will generate the final files on. 
     * @param name The name that should be used to identify the generated version files
     * @param forge The path to a forge installation jar
     * @param trimMisc Gets rid of any unnecessary miscellaneous files
    */
    async wrap(baseUrl: string, save: dir | string, name: string = ("custom_" + this.name), forge?: { jar: file | string } | file, trimMisc: boolean = false) {
        if (typeof save == "string") save = new dir(save);
        await this.install();
        const blacklist = ["usercache.json", "realms_persistence.json", "logs", "profilekeys", "usernamecache.json"]
        const seperate = ["resourcepacks", "texturepacks", "mods", "coremods", "jarmods", "shaderpacks"]
        const dynamic = ["saves", "config"]
        const bunlde = ["saves"]
        const pack = ["config"]

        const me = new dir(this.getPath());
        const resources: downloadableFile[] = [];

        const cp = (d: dir, path: string[]) => {
            if (d.exists()) {
                d.ls().forEach(e => {
                    if (typeof save == "string") save = new dir(save);
                    if (e instanceof file) {
                        const f = new file(save.javaPath(), ...path, e.name)
                        e.copyTo(f.mkdir())
                        resources.push({ key: [...path, e.name].join("/"), name: e.name, path: path, url: [baseUrl, ...path, e.name].join("/"), chk: { sha1: f.getHash(), size: f.getSize() } });
                    } else if (!e.islink()) {
                        const path2 = [...path, e.path[e.path.length - 1]];
                        cp(e, path2);
                    }
                })
            }
        }
        seperate.forEach(e => {
            cp(me.getDir(e), [e]);
        })
        const data = save.getDir(".data").mkdir();
        for (var i = 0; i < bunlde.length; i++) {
            const e = bunlde[i]
            const ls = me.getDir(e).ls();
            for (var k = 0; k < ls.length; k++) {
                const e2 = ls[k]
                if (!e2.islink() && e2 instanceof dir && e2.exists()) {
                    const name = e2.getName()
                    const zip = e + "_" + k + ".zip";
                    const file = data.getFile(zip)
                    const err = await packAsync(e2.sysPath(), file.sysPath());
                    if (err) console.error(err);
                    resources.push({ dynamic: dynamic.includes(e), unzip: { file: [e] }, key: [e, name].join("/"), name: zip, path: [".data"], url: [baseUrl, ".data", zip].join("/"), chk: { sha1: file.getHash(), size: file.getSize() } });
                }
            }
        }
        for (var i = 0; i < pack.length; i++) {
            const e = pack[i]
            const directory = me.getDir(e);
            if (directory.exists() && !directory.islink()) {
                const zip = e + ".zip";
                const file = data.getFile(zip)
                const err = await packAsync(directory.sysPath(), file.sysPath());
                if (err) console.error(err);
                resources.push({ dynamic: dynamic.includes(e), unzip: { file: [] }, key: [e, name].join("/"), name: zip, path: [".data"], url: [baseUrl, ".data", zip].join("/"), chk: { sha1: file.getHash(), size: file.getSize() } });
            }
        }

        const ls2 = me.ls()
        const zip = "misc.zip";
        const mzip = data.getFile(zip).mkdir();
        const avoid = [...seperate, ...bunlde, ...blacklist, ...pack]
        if (this.assets && this.assets.objects) {
            const assetz = save.getDir("assets").mkdir();
            Object.values(this.assets.objects).forEach((e) => {
                assetTag(getAssets().getDir("objects"), e.hash).getFile(e.hash).copyTo(assetTag(assetz.getDir("objects"), e.hash).mkdir().getFile(e.hash))
            })
            const err = await packAsync(assetz.sysPath(), mzip.sysPath());
            if (err) console.error(err);
            assetz.rm();
        }
        if (!trimMisc)
            for (var k = 0; k < ls2.length; k++) {
                const e = ls2[k];
                if (!e.islink() && !avoid.includes(e.getName()) && !e.getName().startsWith(".")) {
                    const err = await packAsync(e.sysPath(), mzip.sysPath());
                    if (err) console.error(err);
                }
            }
        if (mzip.exists()) {
            resources.push(
                {
                    unzip: { file: [] },
                    key: "misc",
                    name: "misc.zip",
                    path: [".data"],
                    url: [baseUrl, ".data", zip].join("/"),
                    chk: { sha1: mzip.getHash(), size: mzip.getSize() }
                }
            );
        } else {
            console.warn("[GMLL]: No misc zip detected! If this is intended then please ignore");
        }
        const ver: Partial<versionJson> = {
            instance: {
                //      restart_Multiplier: 1,
                files: resources,
                assets: this.assets,
                meta: this.meta
            },

            id: name
        }
        const verfile = save.getDir(".meta").mkdir().getFile("version.json");
        let Fversion = this.version;
        if (forge) {
            let _forge: file;
            if (forge instanceof file) _forge = forge;
            else if (typeof forge.jar == "string") _forge = new file(forge.jar);
            else _forge = forge.jar;

            await runtime("java-runtime-beta");

            const javaPath = getJavaPath("java-runtime-beta");
            const path = save.getDir(".forgiac").rm().mkdir();
            const manifest = path.getDir("manifest").mkdir();
            const args: string[] = ["-jar", getlibraries().getFile("za", "net", "hanro50", "forgiac", "basic", "forgiac.jar").sysPath(), "--.minecraft", path.sysPath(), "--mk_manifest", manifest.sysPath(), "--installer", _forge.sysPath()];

            path.mkdir();
            emit("jvm.start", "Forgiac", path.sysPath());
            const s = spawn(javaPath.sysPath(), args, { "cwd": path.sysPath() })
            s.stdout.on('data', (chunk) => emit("jvm.stdout", "Forgiac", chunk));
            s.stderr.on('data', (chunk) => emit("jvm.stderr", "Forgiac", chunk));
            await new Promise(e => s.on('exit', e));

            const forgiman = manifest.ls()
            if (forgiman.length < 1) {
                throw "Manifest file not found?"
            }
            const forgi = forgiman[0]
            if (!(forgi instanceof file)) {
                throw "Manifest file is a directory?"
            }
            const forgePath = save.getDir("forge").mkdir();
            Fversion = forgi.toJSON<versionManifest>().id;
            _forge.copyTo(forgePath.getFile(_forge.getName()));
            ver.instance.files.push({ key: _forge.getName(), name: _forge.getName(), path: ["forge"], url: [baseUrl, "forge", _forge.getName()].join("/"), chk: { sha1: _forge.getHash(), size: _forge.getSize() } })
            ver.instance.forge = { installer: ["forge", _forge.getName()] };

            path.rm();
        }
        ver.inheritsFrom = Fversion;
        verfile.write(ver);

        const manifest: versionManifest = {
            id: name, type: "custom", sha1: verfile.getHash(), base: Fversion, url: baseUrl + "/" + ".meta/version.json", "_comment": "Drop this into gmll's manifest folder",
        }

        delete manifest._comment;
        save.getFile(".meta", "manifest.json").write(manifest);
        save.getFile(".meta", "api.json").write({ name: name, version: 1, sha: save.getFile(".meta", "manifest.json").getHash(), "_comment": "Here for future proofing incase we need to introduce a breaking change to this system." });

        let index = `<!DOCTYPE html><html><!--This is just a place holder! GMLL doesn't check this. It is merely here to look nice and serve as a directory listing-->`
        index += `<head><link rel="stylesheet" href="https://styles.hanro50.net.za/v1/main"><title>${name}</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="A GMLL minecraft modpack"></head><body><h1>${name}</h1><h2>Copy the link to this page into gmll to import this modpack!</h2><h2>File list</h2>`
        function read(f: dir, directory = []) {

            f.ls().forEach(e => {
                if (e.getName() == "index.html" || e.getName() == `manifest_${fsSanitiser(name)}.json`) return;
                if (e instanceof file) {
                    const entry = ([...directory, e.getName()].join("/"));
                    index += `<br><div class="element button" onclick="document.location.href='./${entry}'">${entry}</div>`
                }
                else read(e, [...directory, e.getName()])
            })
        }

        read(save);

        index += `</body></html>`
        console.log(index);
        save.getFile("index.html").write(index);
        save.getFile(`manifest_${fsSanitiser(name)}.json`).write(manifest);
        return ver;
    }
    /**
     * @returns Some low level meta paths used to obtain some key files of this instance. 
     */
    async getMetaPaths(): Promise<instanceMetaPaths> {
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
     * Gets some general information about all the world files in this instance.
     * It also decodes the level.DAT file for you and returns the decoded file as a JSON file. 
     * 
     * It also decodes the player data stored in the "playerdata" and "stats" subfolder in newer versions of the game. 
     */
    async getWorlds(): Promise<metaSave[]> {
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
    async getResourcePacks(): Promise<metaResourcePack[]> {
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

    /**
      * Gets information about mods in this instance. This includes the loader version plus some general 
      * information about the mod author and mod itself. This will also provide you the icon for a set mod if it can be obtained.\
      * 
      * Works with Legacy forge, forge, fabric, riftloader and liteloader
      */
    async getMods(): Promise<modInfo[]> {
        emit("parser.start", "mod", this);
        const meta = await this.getMetaPaths();
        let mods: modInfo[] = [];

        const tmp = dir.tmpdir().getDir("gmll", "mods", this.getDir().getName(), createHash("sha1").update(this.path).digest("hex")).rm().mkdir();
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

    async getJarModPriority() {
        return (await this.getMetaPaths()).jarmods.getFile("priority.json").load<{ [key: string]: number }>({})
    }
}
