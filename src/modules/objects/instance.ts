import { spawn } from "child_process";
import { join } from "path";
import { assetTag, combine, defJVM, fsSanitiser, oldJVM, parseArguments, processAssets, throwErr } from "../internal/util.js";
import { dir, downloadable, file } from "./files.js";
import { cpus, type } from "os";
import { getClientID, getLatest } from "../handler.js";
import { emit, getAssets, getLauncherVersion, getlibraries, getMeta, getNatives, resolvePath } from "../config.js";
import { assets, launchArgs, manifest, user_type, version as version_type } from "../../index.js";
import { version } from "./version.js";

import { pack, cmd } from '7zip-min';

const defArgs = [
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
    meta?: any
    /**Asset index injection */
    assets?: assets
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
     * 
     * @returns A absolute path leading to this instance
     */
    getPath() {
        return resolvePath(this.path);
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
    }
    /**
     * Runs the installer script without launching MC
     * @returns The instance's version object. 
     * @see {@link getVersion} if you just want the instance's version
     */
    async install() {
        const version = await this.getVersion();
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
        getlibraries().link([this.getPath(), "libraries"]);
        const version = await this.install();

        const cp = version.getClassPath();
        var vjson = await version.getJSON();
        var assetRoot = getAssets();

        var assetsFile = "assets";
        assetRoot.link([this.getPath(), assetsFile]);
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
            assetsFile = "resources"
            assetRoot.link([this.getPath(), assetsFile]);
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
            launcher_name: process.env.launcher_name || process.env.npm_package_name || "GMLL",
            launcher_version: getLauncherVersion(),
            classpath: classPath,
            auth_session: "token:" + token.access_token,
            game_assets: assetsFile,

            classpath_separator: classpath_separator,
            library_directory: getlibraries(),
            user_properties: JSON.stringify(token.profile.properties || {})

        }
        const javaPath = version.getJavaPath();
        const rawJVMargs: launchArgs = defArgs;
        rawJVMargs.push(...(vjson.arguments ? vjson.arguments.jvm : defJVM));
        if (version.manifest.releaseTime) {
            const date = Date.parse(version.manifest.releaseTime);
            if (date < Date.parse("2012-11-18T22:00:00+00:00")) {
                rawJVMargs.push(...oldJVM);

            }/* else if (date < Date.parse("2021-12-10T08:23:00+00:00")&&date > Date.parse("2013-09-19T15:52:37+00:00")) {
                const log4j = date < Date.parse( "2017-05-10T11:37:17+00:00") ? "log4j-fix-1.xml" : "log4j-fix-2.xml"
                cpSync(join(getMeta().index, log4j), join(this.getPath(), log4j));
                rawJVMargs.push("-Dlog4j.configurationFile=" + log4j);
            }*/
        }
        var jvmArgs = parseArguments(args, rawJVMargs);

        let gameArgs = vjson.arguments ? parseArguments(args, vjson.arguments.game) : "";
        gameArgs += vjson.minecraftArguments ? " " + vjson.minecraftArguments : "";

        var launchCom = jvmArgs + " " +/* "za.net.hanro50.inject.App"+*/ vjson.mainClass + (!gameArgs.startsWith(" ") ? " " : "") + gameArgs;
        console.log(gameArgs)

        Object.keys(args).forEach(key => {
            const regex = new RegExp(`\\\$\{${key}\}`, "g")
            launchCom = launchCom.replace(regex, args[key])
        })
        emit("jvm.start", "Minecraft", this.getPath());
        //console.log(version.json.libraries)
        // console.log(launchCom.trim().split(" "))
        // console.log(javaPath + " " + launchCom)
        const s = spawn(javaPath.sysPath(), launchCom.trim().split(" "), { "cwd": this.getPath() })
        s.stdout.on('data', (chunk) => emit("jvm.stdout", "Minecraft", chunk));
        s.stderr.on('data', (chunk) => emit("jvm.stderr", "Minecraft", chunk));
    }
    /**Wraps up an instance in a prepackaged format that can be easily uploaded to a server for distribution 
     * @param baseUrl The base URL the generated files will be stored within on your server. For example http\:\/\/yourawesomdomain.net\/path\/to\/files\/
     * @param save The file GMLL will generate the final files on. 
     * @param name The name that should be used to identify the generated version files
    */
    async wrap(baseUrl: string, save: dir, name: string = ("custom_" + this.name)) {
        const seperate = ["resourcepacks", "texturepacks", "mods", "coremods", "shaderpacks"]
        const bunlde = ["saves"]
        const blacklist = ["usercache.json", "realms_persistence.json", "logs"]
        const me = new dir(this.getPath());
        const resources: downloadable[] = [];
        const packAsync = (pathToDirOrFile: string, pathToArchive: string) => new Promise<Error | null>(res => pack(pathToDirOrFile, pathToArchive, res));

        const cp = (d: dir, path: string[]) => {
            console.log(d.exists())
            if (d.exists()) {
                d.ls().forEach(e => {
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
        console.log(1)
        for (var i = 0; i < bunlde.length; i++) {
            console.log(2)
            const e = bunlde[i]
            const ls = me.getDir(e).ls();
            for (var k = 0; k < ls.length; k++) {
                console.log(3)
                const e2 = ls[k]
                if (!e2.islink() && e2 instanceof dir) {
                    console.log(4)
                    const name = e2.getName()
                    const zip = e + "_" + k + ".zip";
                    const file = data.getFile(zip)
                    const err = await packAsync(e2.sysPath(), file.sysPath());
                    if (err) console.log(err);
                    resources.push({ dynamic: e == "saves", unzip: { file: [e, name] }, key: [e, name].join("/"), name: zip, path: [".data"], url: [baseUrl, ".data", zip].join("/"), chk: { sha1: file.getHash(), size: file.getSize() } });
                }
            }
        }

        const ls2 = me.ls()
        const zip = "misc.zip";
        const mzip = data.getFile(zip).mkdir();
        const avoid = [...seperate, ...bunlde, ...blacklist]
        if (this.assets) {
            const assetz = me.getDir("assets").mkdir();
            Object.values(this.assets.objects).forEach((e) => {
                assetTag(getAssets().getDir("objects"), e.hash).getFile(e.hash).copyto(assetTag(assetz.getDir("objects"), e.hash).mkdir().getFile(e.hash))
            })
            const err = await packAsync(assetz.sysPath(), mzip.sysPath());
            if (err) console.log(err);
            assetz.rm();
        }

        for (var k = 0; k < ls2.length; k++) {
            const e = ls2[k];
            console.log(e.getName() + ":" + e.islink())
            if (!e.islink() && !avoid.includes(e.getName()) && !e.getName().startsWith(".")) {
                const err = await packAsync(e.sysPath(), mzip.sysPath());
                if (err) console.log(err);

            }
        }
        resources.push({ unzip: { file: mzip.path }, key: "misc", name: "misc.zip", path: [".data", zip], url: [baseUrl, ".data", zip].join("/"), chk: { sha1: mzip.getHash(), size: mzip.getSize() } });

        const ver: Partial<version_type> = {
            instance: {
                restart_Multiplier: 1,
                files: resources,
                assets: this.assets
            },
            inheritsFrom: this.version,
            id: name
        }
        const verfile = save.getDir(".meta").mkdir().getFile("version.json");
        verfile.write(ver);

        const manifest: manifest = {
            id: name, type: "custom", sha1: verfile.getHash(), base: this.version, url: baseUrl + "/" + ".meta/version.json", "_comment": "Drop this into gmll's manifest folder",
        }
        save.getFile("manifest_" + fsSanitiser(name) + ".json").write(manifest);
        delete manifest._comment;
        save.getFile(".meta", "manifest.json").write(manifest);
        //save.getFile(".meta", "manifest.json.sha1").write(save.getFile(".meta", "manifest.json").getHash())
        save.getFile(".meta", "api.json").write({ name: name, version: 1, sha: save.getFile(".meta", "manifest.json").getHash(), "_comment": "Here for future proofing incase we need to introduce a breaking change to this system." });
        return ver;
    }
}