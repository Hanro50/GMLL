import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { instance } from "gmll";
import { getMeta, getAssets, getNatives, getLauncherName, getLauncherVersion, getlibraries, emit } from "gmll/config";
import { dir, file } from "gmll/objects/files";
import { player, assetIndex, launchArguments } from "gmll/types";
import { type, cpus } from "os";
import { join } from "path";
import { combine, fsSanitizer, processAssets, getClientID, lawyer } from "../util.js";
import { download } from "gmll/downloader";

/**
 * For internal use only
 */
function parseArguments(val = {}, args: launchArguments) {
    let out = "";
    args.forEach(e => {
        if (typeof e == "string")
            out += "\u0000" + e.trim().replace(/\s/g, "");
        else if (lawyer(e.rules, val))
            out += "\u0000" + (e.value instanceof Array ? e.value.join("\u0000") : e.value);
    })
    return out
}
/**
 * Runs the installer script without launching MC
 * @returns The instance's version object. 
 * @see {@link getVersion} if you just want the instance's version
 */
export async function install(this: instance) {
    //Making links
    getlibraries().linkFrom(this.getDir().getDir("libraries"));
    getAssets().linkFrom(this.getDir().getDir("assets"));
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
            insta.files[i].path = [this.getDir().sysPath(), ...insta.files[i].path]
            insta.files[i].path.forEach(e => {
                if (e.includes(".."))
                    security = true;
            })
            new dir(...insta.files[i].path).mkdir()
            if (insta.files[i].unzip) {
                insta.files[i].unzip.file = [this.getDir().sysPath(), ...insta.files[i].unzip.file]
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
                const fFile = this.getDir().getFile(...insta.forge.installer)
                if (!fFile.exists()) {
                    throw "Cannot find forge installer"
                }
                await this.installForge(fFile);
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
export async function launch(this: instance, token: player, resolution?: { width: string, height: string }) {
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
    let jarmoded = await instance.jarmod(await this.getMetaPaths(), version)
    let cp: string[] = version.getClassPath(undefined, jarmoded);

    var vjson = await version.getJSON();
    var assetRoot = getAssets();

    var assetsFile = this.getDir().getDir("assets");

    let AssetIndex = getAssets().getFile("indexes", (vjson.assets || "pre-1.6") + ".json").toJSON<assetIndex>();
    let assets_index_name = vjson.assetIndex.id;
    if (this.assets.objects) {
        AssetIndex = combine(AssetIndex, this.assets);
        assets_index_name = (fsSanitizer(assets_index_name + "_" + this.name))
        getAssets().getFile("indexes", (assets_index_name + ".json")).write(AssetIndex);
        processAssets(AssetIndex);
    }


    if (AssetIndex.virtual || AssetIndex.map_to_resources) {
        assetRoot = getAssets().getDir("legacy", AssetIndex.virtual ? "virtual" : "resources");
        assetsFile = this.getDir().getFile("resources").rm();
        //  assetRoot.linkFrom(assetsFile);
    }

    const classpath_separator = type() == "Windows_NT" ? ";" : ":";
    const classPath = [...cp].join(classpath_separator);
    // const classPath = [agentPath(),...cp].join(classpath_separator);
    const args = {
        ram: Math.floor(this.ram * 1024),
        cores: cpus().length,

        is_demo_user: !!token.profile.demo,
        has_custom_resolution: !!resolution,
        resolution_width: resolution ? resolution.width : "",
        resolution_height: resolution ? resolution.height : "",

        auth_player_name: token.profile.name,
        version_name: vjson.inheritsFrom || vjson.id,
        game_directory: this.getDir().sysPath() + "/",

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
        auth_session: token.access_token,
        game_assets: assetsFile,

        classpath_separator: classpath_separator,
        library_directory: getlibraries(),
        user_properties: JSON.stringify(token.profile.properties || {}),

        port: 0
    }
    const javaPath = this.javaPath == "default" ? version.getJavaPath() : new file(this.javaPath);
    const rawJVMargs: launchArguments = instance.defaultGameArguments;
    //  rawJVMargs.push("-Dgmll.main.class=" +vjson.mainClass);
    rawJVMargs.push(...(vjson.arguments?.jvm || instance.defJVM));
    //     rawJVMargs.push(`-javaagent:${agentPath()}`);
    /**Handling the proxy service for legacy versions */
    //  let proxy: Server
    //  const legacy = this.legacyProxy;//
    //  if (!legacy.disabled && (version.manifest.releaseTime && Date.parse(version.manifest.releaseTime) < Date.parse("2014-04-14T17:29:23+00:00"))) {
    //     const px = await proximate({ index: AssetIndex, port: legacy.port, skinServer: legacy.skinServer });
    //     args.port = px.port;

    //   rawJVMargs.push(...instance.oldJVM);

    //  if (!AssetIndex.virtual && !AssetIndex.map_to_resources)
    //      
    //  proxy = px.server;
    //   console.log(rawJVMargs)
    //  }

    var jvmArgs = parseArguments(args, rawJVMargs);

    let gameArgs = vjson.arguments ? parseArguments(args, vjson.arguments.game) : "";
    gameArgs += vjson.minecraftArguments ? "\x00" + vjson.minecraftArguments.replace(/\s/g, "\x00") : "";

    // var launchCom = jvmArgs + "\x00za.net.hanro50.agenta.Main" + (!gameArgs.startsWith("\x00") ? "\x00" : "") + gameArgs;
    var launchCom = jvmArgs + "\x00" + vjson.mainClass + (!gameArgs.startsWith("\x00") ? "\x00" : "") + gameArgs;

    Object.keys(args).forEach(key => {
        const regex = new RegExp(`\\\$\{${key}\}`, "g")
        launchCom = launchCom.replace(regex, args[key])
    })
    emit("jvm.start", "Minecraft", this.getDir().sysPath());
    const largsL = launchCom.trim().split("\x00");
    if (largsL[0] == '') largsL.shift();
    const s = spawn(javaPath.sysPath(), largsL, { "cwd": join(this.getDir().sysPath()), "env": combine(process.env, this.env) })
    s.stdout.on('data', (chunk) => emit("jvm.stdout", "Minecraft", chunk));
    s.stderr.on('data', (chunk) => emit("jvm.stderr", "Minecraft", chunk));
    //  if (proxy) s.on("exit", () => proxy.close())

}