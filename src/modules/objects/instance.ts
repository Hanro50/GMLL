import { readFileSync } from "fs";
import { spawn } from "child_process";
import { join } from "path";
import { defJVM, fsSanitiser, mkdir, mklink, oldJVM, parseArguments, writeJSON } from "../internal/util.js";
import { cpus, type } from "os";
import {  getClientID, getLatest } from "../handler.js";
import { emit, getAssets, getInstances, getlibraries, getMeta, getNatives } from "../config.js";
import { launchArgs, user_type } from "../../index.js";
import {version} from "./version.js";
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
export interface player {
    name: string,
    uuid: string,
    type: user_type,
    demo?: boolean,
    auth_xuid?: string,
    accessToken: string
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
}

export default class instance {
    name: string;
    version: string;
    path: string;
    ram: Number;
    meta: any;
    protected type: string;
    static get(name: string) {
        const json = JSON.parse(readFileSync(join(getMeta().profiles, fsSanitiser(name + ".json"))).toString());
        return new instance(json);
    }

    /**
     * 
     * @param {GMLL.instance.options} opt 
     */
    constructor(opt: options) {

        this.version = opt && opt.version ? opt.version : getLatest().release;
        this.name = opt && opt.name ? opt.name : this.version;
        this.path = opt && opt.path ? opt.path : join(getInstances(), fsSanitiser(this.name));
        this.ram = opt && opt.ram ? opt.ram : 2;
        this.meta = opt && opt.meta ? opt.meta : undefined;

        mkdir(this.path);
    }

    async getVersion() {
        return await version.get(this.version)
    }
    save() {
        writeJSON(join(getMeta().profiles, fsSanitiser(this.name + ".json")), this);
    }

    /**
     * 
     * @param {GMLL.instance.player} player 
     * @param {{width:string,height:string}} resolution 
     * @returns 
     */
    async launch(player: player, resolution: { width: string, height: string }) {

        const version = await this.getVersion();
        await version.install();
        const cp = version.getClassPath();
        var vjson = await version.getJSON();
        var AssetRoot = getAssets();
        const AssetIndex = JSON.parse(readFileSync(join(getAssets(), "indexes", vjson.assets + ".json")).toString())

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
            auth_xuid: player.auth_xuid,
            clientid: getClientID(),
            
            version_type: vjson.type,
            auth_access_token: player.accessToken,

            natives_directory: getNatives(),
            launcher_name: process.env.launcher_name || process.env.npm_package_name || "GMLL",
            launcher_version: launcher_version,
            classpath: classPath,
            auth_session: "token:"+player.accessToken,
            game_assets: AssetRoot,

            classpath_separator: classpath_separator,
            library_directory: getlibraries()
        }
        const javaPath = version.getJavaPath();
        const rawJVMargs: launchArgs = defArgs;
        rawJVMargs.push(...(vjson.arguments ? vjson.arguments.jvm : defJVM));
        if (version.manifest.releaseTime && Date.parse(version.manifest.releaseTime) < Date.parse("2012-11-18T22:00:00+00:00")) {
            rawJVMargs.push(...oldJVM);
        }
        var jvmArgs = parseArguments(args, rawJVMargs);

        var gameArgs = vjson.arguments ? parseArguments(args, vjson.arguments.game) : "";
        gameArgs += vjson.minecraftArguments ? " " + vjson.minecraftArguments : "";

        var launchCom = jvmArgs + " " + vjson.mainClass + " " + gameArgs;

        Object.keys(args).forEach(key => {
            const regex = new RegExp(`\\\$\{${key}\}`, "g")
            launchCom = launchCom.replace(regex, args[key])
        })
        const s = spawn(javaPath, launchCom.trim().split(" "), { "cwd": this.path })
        s.stdout.on('data', (chunk) => emit("jvm.stdout", "Minecraft", chunk));
        s.stderr.on('data', (chunk) => emit("jvm.stderr", "Minecraft", chunk));
    }
}