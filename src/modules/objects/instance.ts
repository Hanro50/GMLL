import { spawn } from "child_process";
import { join } from "path";
import { assetTag, combine, fsSanitiser, lawyer, processAssets, throwErr } from "../internal/util.js";
import { dir, downloadable, file } from "./files.js";
import { cpus, type } from "os";
import { getClientID, getJavaPath, getLatest, installForge } from "../handler.js";
import { emit, getAssets, getInstances, getLauncherName, getLauncherVersion, getlibraries, getMeta, getNatives, resolvePath } from "../config.js";
import { assets, launchArgs, manifest, user_type, version as version_type } from "../../index.js";
import { version } from "./version.js";

import { pack, cmd } from '7zip-min';
import { download, runtime } from "../downloader.js";

/**
 * For internal use only
 */
function parseArguments(val = {}, args: launchArgs = defJVM) {
    let out = ""
    args.forEach(e => {
        if (typeof e == "string")
            out += " " + e.trim().replace(/\s/g, "");
        else if (lawyer(e.rules, val))
            out += " " + (e.value instanceof Array ? e.value.join("\t") : e.value);
    })
    return out
}

export let defJVM: launchArgs = [
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

export let defaultGameArguments = [
    "-Xms${ram}G",
    "-Xmx${ram}G",
    "-XX:+UnlockExperimentalVMOptions",
    "-XX:+UseG1GC",
    "-XX:G1NewSizePercent=20",
    "-XX:G1ReservePercent=20",
    "-XX:MaxGCPauseMillis=50",
    "-XX:G1HeapRegionSize=32M",
    "-Dlog4j2.formatMsgNoLookups=true"
]
export interface token {
    profile: {
        id: string,
        name: string,
        xuid?: string,
        type?: user_type,
        demo?: boolean,
        properties?: {
            //We're still reverse engineering what this property is used for...
            //This likely does not work anymore...
            twitch_access_token: string
        }
    },
    access_token?: string
}

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
    meta?: any,
    /**Asset index injection */
    assets?: assets,
    /**Define a custom java path. 
     * @warning It is recommended to let GMLL handle this for you. It is solely changable to achieve parody with the vanilla launcher. 
     * Changing this can easily break older versions of forge, cause grathical corruption, crash legacy versions of minecraft, cause issues with arm Macs and a whole host of random BS.  
     * If brought up in the support channels for GMLL, you'll be asked to set this to it's default value if we see that you have changed it.
     */
    javaPath?: "default" | string;
}
/**
 * An instance is what the name intails. An instance of the game Minecraft containing Minecraft specific data.
 * This information on where the game is stored and the like. The mods installed and what not. 
 */
export default class instance {
    name: string;
    version: string;
    ram: Number;
    meta: any;
    private path: string;
    assets: Partial<assets>;
    javaPath: "default" | string;
    static get(name: string) {

        const json = new file(getMeta().profiles.toString(), fsSanitiser(name + ".json")).toJSON<options>();
        return new instance(json);
    }
    /**
     * 
     * @param opt This parameter contains information vital to constructing the instance. That being said, GMLL will never the less pull in default values if it is emited
     */
    constructor(opt?: options) {
        this.version = opt && opt.version ? opt.version : getLatest().release;
        this.name = opt && opt.name ? opt.name : this.version;
        this.path = opt && opt.path ? opt.path : join("<instance>", fsSanitiser(this.name));
        this.ram = opt && opt.ram ? opt.ram : 2;
        this.meta = opt && opt.meta ? opt.meta : undefined;
        this.assets = opt && opt.assets ? opt.assets : {};
        this.javaPath = opt && opt.javaPath ? opt.javaPath : "default";
        new dir(this.getPath()).mkdir();
    }
    /**
     * Inject custom assets into the game.
     * @param key The asset key
     * @param path The path to the asset file in questions...it must exist!
     */
    injectAsset(key: string, path: string | file) {
        if (typeof path == "string") {
            path = new file(path);
        }
        if (!path.exists()) throwErr("Cannot find file");
        const hash = path.getHash();
        path.copyto(assetTag(getAssets().getDir("objects"), hash).getFile(hash));
        if (!this.assets.objects) this.assets.objects = {};
        const asset = { hash: hash, size: path.getSize(), ignore: true };
        this.assets.objects[key] = asset;
        return asset
    }

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

            await download(insta.files, insta.restart_Multiplier || 1)
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
    async launch(token: token, resolution?: { width: string, height: string }) {

        const version = await this.install();

        const cp = version.getClassPath();
        var vjson = await version.getJSON();
        var assetRoot = getAssets();

        var assetsFile = this.getDir().getDir("assets");

        let AssetIndex = getAssets().getFile("indexes", (vjson.assets || "pre-1.6") + ".json").toJSON<assets>();
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
            ram: this.ram,
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
            user_properties: JSON.stringify(token.profile.properties || {})

        }
        const javaPath = this.javaPath == "default" ? version.getJavaPath() : new file(this.javaPath);
        const rawJVMargs: launchArgs = defaultGameArguments;
        rawJVMargs.push(...(vjson.arguments?.jvm || defJVM));
        var jvmArgs = parseArguments(args, rawJVMargs);

        let gameArgs = vjson.arguments ? parseArguments(args, vjson.arguments.game) : "";
        gameArgs += vjson.minecraftArguments ? " " + vjson.minecraftArguments : "";

        var launchCom = jvmArgs + " " + vjson.mainClass + (!gameArgs.startsWith(" ") ? " " : "") + gameArgs;


        Object.keys(args).forEach(key => {
            const regex = new RegExp(`\\\$\{${key}\}`, "g")
            launchCom = launchCom.replace(regex, args[key])
        })
        emit("jvm.start", "Minecraft", this.getPath());
        //   console.log(launchCom)
        const s = spawn(javaPath.sysPath(), launchCom.trim().split(" "), { "cwd": this.getPath() })
        s.stdout.on('data', (chunk) => emit("jvm.stdout", "Minecraft", chunk));
        s.stderr.on('data', (chunk) => emit("jvm.stderr", "Minecraft", chunk));
    }
    /**Wraps up an instance in a prepackaged format that can be easily uploaded to a server for distribution 
     * @param baseUrl The base URL the generated files will be stored within on your server. For example http\:\/\/yourawesomdomain.net\/path\/to\/files\/
     * @param save The file GMLL will generate the final files on. 
     * @param name The name that should be used to identify the generated version files
    */
    async wrap(baseUrl: string, save: dir | string, name: string = ("custom_" + this.name), forge?: { jar: file | string }) {
        if (typeof save == "string") save = new dir(save);
        await this.install();
        const seperate = ["resourcepacks", "texturepacks", "mods", "coremods", "shaderpacks"]
        const bunlde = ["saves"]
        const blacklist = ["usercache.json", "realms_persistence.json", "logs"]
        const me = new dir(this.getPath());
        const resources: downloadable[] = [];
        const packAsync = (pathToDirOrFile: string, pathToArchive: string) => new Promise<Error | null>(res => pack(pathToDirOrFile, pathToArchive, res));

        const cp = (d: dir, path: string[]) => {
            //  console.log(d.exists())
            if (d.exists()) {
                d.ls().forEach(e => {
                    if (typeof save == "string") save = new dir(save);
                    if (e instanceof file) {
                        const f = new file(save.javaPath(), ...path, e.name)
                        e.copyto(f.mkdir())
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
        //  console.log(1)
        for (var i = 0; i < bunlde.length; i++) {
            //    console.log(2)
            const e = bunlde[i]
            const ls = me.getDir(e).ls();
            for (var k = 0; k < ls.length; k++) {
                //  console.log(3)
                const e2 = ls[k]
                if (!e2.islink() && e2 instanceof dir && e2.exists()) {
                    //   console.log(4)
                    const name = e2.getName()
                    const zip = e + "_" + k + ".zip";
                    const file = data.getFile(zip)
                    const err = await packAsync(e2.sysPath(), file.sysPath());
                    if (err) console.error(err);
                    resources.push({ dynamic: e == "saves", unzip: { file: [e] }, key: [e, name].join("/"), name: zip, path: [".data"], url: [baseUrl, ".data", zip].join("/"), chk: { sha1: file.getHash(), size: file.getSize() } });
                }
            }
        }

        const ls2 = me.ls()
        const zip = "misc.zip";
        const mzip = data.getFile(zip).mkdir();
        const avoid = [...seperate, ...bunlde, ...blacklist]
        if (this.assets) {
            const assetz = save.getDir("assets").mkdir();
            Object.values(this.assets.objects).forEach((e) => {
                assetTag(getAssets().getDir("objects"), e.hash).getFile(e.hash).copyto(assetTag(assetz.getDir("objects"), e.hash).mkdir().getFile(e.hash))
            })
           // console.log(assetz.sysPath())
            const err = await packAsync(assetz.sysPath(), mzip.sysPath());
            if (err) console.error(err);
            assetz.rm();
        }

        for (var k = 0; k < ls2.length; k++) {
            const e = ls2[k];
           // console.log(e.getName() + ":" + e.islink())
            if (!e.islink() && !avoid.includes(e.getName()) && !e.getName().startsWith(".")) {
                const err = await packAsync(e.sysPath(), mzip.sysPath());
                if (err) console.error(err);

            }
        }
        resources.push({ unzip: { file: [] }, key: "misc", name: "misc.zip", path: [".data"], url: [baseUrl, ".data", zip].join("/"), chk: { sha1: mzip.getHash(), size: mzip.getSize() } });
        const ver: Partial<version_type> = {
            instance: {
                restart_Multiplier: 1,
                files: resources,
                assets: this.assets,
                meta: this.meta
            },

            id: name
        }
        const verfile = save.getDir(".meta").mkdir().getFile("version.json");
        let Fversion = this.version;
        if (forge) {
            if (typeof forge.jar == "string") forge.jar = new file(forge.jar);

            await runtime("java-runtime-beta");

            const javaPath = getJavaPath("java-runtime-beta");
            const path = save.getDir(".forgiac").rm().mkdir();
            const manifest = path.getDir("manifest").mkdir();
            const args: string[] = ["-jar", getlibraries().getFile("za", "net", "hanro50", "forgiac", "basic", "forgiac.jar").sysPath(), "--.minecraft", path.sysPath(), "--mk_manifest", manifest.sysPath(), "--installer", forge.jar.sysPath()];

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
            Fversion = forgi.toJSON<manifest>().id;
            forge.jar.copyto(forgePath.getFile(forge.jar.getName()));
            ver.instance.files.push({ key: forge.jar.getName(), name: forge.jar.getName(), path: ["forge"], url: [baseUrl, "forge", forge.jar.getName()].join("/"), chk: { sha1: forge.jar.getHash(), size: forge.jar.getSize() } })
            ver.instance.forge = { installer: ["forge", forge.jar.getName()] };

            path.rm();
        }
        ver.inheritsFrom = Fversion;
        verfile.write(ver);

        const manifest: manifest = {
            id: name, type: "custom", sha1: verfile.getHash(), base: Fversion, url: baseUrl + "/" + ".meta/version.json", "_comment": "Drop this into gmll's manifest folder",
        }
        save.getFile("manifest_" + fsSanitiser(name) + ".json").write(manifest);
        delete manifest._comment;
        save.getFile(".meta", "manifest.json").write(manifest);
        save.getFile(".meta", "api.json").write({ name: name, version: 1, sha: save.getFile(".meta", "manifest.json").getHash(), "_comment": "Here for future proofing incase we need to introduce a breaking change to this system." });
        return ver;
    }
}