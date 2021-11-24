import { existsSync, symlinkSync, unlinkSync, writeFileSync, readFileSync } from "fs";
import { spawn } from "child_process";
import { join } from "path";
import { defJVM, fsSanitiser, mkdir, mklink, oldJVM, parseArguments } from "./internal/util.js";
import { cpus, type } from "os";
import { version, getLatest } from "./versions.js";
import { emit, getAssets, getInstances, getlibraries, getMeta, getNatives } from "./config.js";
const defArgs = [
    "-Xms${ram}G",
    "-Xmx${ram}G",
    "-XX:+UnlockExperimentalVMOptions",
    "-XX:+UseG1GC",
    "-XX:G1NewSizePercent=20",
    "-XX:G1ReservePercent=20",
    "-XX:MaxGCPauseMillis=50",
    "-XX:G1HeapRegionSize=32M",
]
/**@type {GMLL.instance.instance} */
export class instance {
    static get(name) {
        const json = JSON.parse(readFileSync(join(config.metaFiles.profile, fsSanitiser(name + ".json"))));
        return new this(json);
    }
    /**
     * 
     * @param {GMLL.instance.options} opt 
     */
    constructor(opt) {
        this.version = opt && opt.version ? opt.version : getLatest().release;
        this.name = opt && opt.name ? opt.name : this.version;
        this.path = opt && opt.path ? opt.path : join(getInstances(), fsSanitiser(this.name));
        this.ram = opt && opt.ram ? opt.ram : 2;
        this.meta = opt && opt.meta ? opt.meta : undefined;

        mkdir(this.path);
    }

    getVersion() {
        return new version(this.version)
    }
    save() {
        mkdir(config.metaFiles.profile);
        writeFileSync(join(config.metaFiles.profile, fsSanitiser(this.name) + ".json"), JSON.stringify(this));
    }

    /**
     * 
     * @param {GMLL.instance.player} player 
     * @param {{width:string,height:string}} resolution 
     * @returns 
     */
    async launch(player, resolution) {

        const version = this.getVersion();
        await version.install();
        const cp = version.getLibs();
        var vjson = await version.getJSON();
        var AssetRoot = getAssets();
        const AssetIndex = JSON.parse(readFileSync(join(getAssets(), "indexes", vjson.assets + ".json")))

        if (AssetIndex.virtual) AssetRoot = join(AssetRoot, "legacy", "virtual");
        if (AssetIndex.map_to_resources) {
            AssetRoot = join(AssetRoot, "legacy", "resources");
            mklink(AssetRoot, join(this.path, "resources"));
            AssetRoot = join(this.path, "resources");
        };
        var launcher_version = "0.0.0";
        try {
            launcher_version = process.env.launcher_version || process.env.npm_package_version || require("../../package.json").version
        } catch { }
        const classpath_separator = type() == "Windows_NT" ? ";" : ":";
        const classPath = cp.join(classpath_separator)
        const args = {
            ram: this.ram,
            cores: cpus().length,

            is_demo_user: !!player.demo,
            has_custom_resolution: !!resolution,
            resolution_width: resolution ? resolution.width : "",
            resolution_height: resolution ? resolution.height : "",

            auth_player_name: player.name,
            version_name: vjson.inheritsFrom || vjson.id,
            game_directory: this.path,

            assets_root: AssetRoot,
            assets_index_name: vjson.assetIndex.id,
            auth_uuid: player.uuid,
            user_type: player.type,
            version_type: vjson.type,
            auth_access_token: player.accessToken,

            natives_directory: getNatives(),
            launcher_name: process.env.launcher_name || process.env.npm_package_name || "GMLL",
            launcher_version: launcher_version,
            classpath: classPath,
            auth_session: player.session,
            game_assets: AssetRoot,

            classpath_separator: classpath_separator,
            library_directory: getlibraries()
        }
        const javaPath = await version.getJavaPath();
        const rawJVMargs = defArgs;
        rawJVMargs.push(...(vjson.arguments ? vjson.arguments.jvm : defJVM));
        if (version.manifest.releaseTime && Date.parse(version.manifest.releaseTime) < Date.parse("2012-11-18T22:00:00+00:00")) {
            rawJVMargs.push(...oldJVM);
        }
        var jvmArgs = parseArguments(args, rawJVMargs);

        var gameArgs = vjson.arguments ? parseArguments(args, vjson.arguments.game) : "";
        gameArgs += vjson.minecraftArguments ? " " + vjson.minecraftArguments : "";

        var launchCom = jvmArgs + " " + vjson.mainClass + " " + gameArgs;

        console.log(javaPath)
        Object.keys(args).forEach(key => {
            const regex = new RegExp(`\\\$\{${key}\}`, "g")
            launchCom = launchCom.replace(regex, args[key])
        })
        console.log(javaPath + launchCom)
        const s = spawn(javaPath, launchCom.trim().split(" "), { "cwd": this.path })
        s.stdout.on('data', (chunk) => emit("minecraft.stdout", chunk));
        s.stderr.on('data', (chunk) => emit("minecraft.stderr", chunk));
      //  s.stdout.pipe(process.stdout);
       // s.stderr.pipe(process.stderr);
    }

}