import { cpSync, readFileSync } from "fs";
import { spawn } from "child_process";
import { join } from "path";
import { defJVM, fsSanitiser, mkdir, mklink, oldJVM, parseArguments, write, writeJSON } from "../internal/util.js";
import { cpus, type } from "os";
import { getClientID, getLatest } from "../handler.js";
import { emit, getAssets, getInstances, getLauncherVersion, getlibraries, getMeta, getNatives, resolvePath } from "../config.js";
import { launchArgs, user_type } from "../../index.js";
import { version } from "./version.js";
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
}

export default class instance {
    name: string;
    version: string;
    ram: Number;
    meta: any;
    private path: string;
    static get(name: string) {
        const json = JSON.parse(readFileSync(join(getMeta().profiles, fsSanitiser(name + ".json"))).toString());
        return new instance(json);
    }
    constructor(opt: options) {
        this.version = opt && opt.version ? opt.version : getLatest().release;
        this.name = opt && opt.name ? opt.name : this.version;
        this.path = opt && opt.path ? opt.path : join("<instance>", fsSanitiser(this.name));
        this.ram = opt && opt.ram ? opt.ram : 2;
        this.meta = opt && opt.meta ? opt.meta : undefined;

        mkdir(this.getPath());
    }

    getPath() {
        return resolvePath(this.path);
    }

    async getVersion() {
        return await version.get(this.version)
    }
    save() {
        writeJSON(join(getMeta().profiles, fsSanitiser(this.name + ".json")), this);
    }

    async launch(token: token, resolution: { width: string, height: string }) {

        const version = await this.getVersion();
        await version.install();
        const cp = version.getClassPath();
        var vjson = await version.getJSON();
        var AssetRoot = getAssets();
        const AssetIndex = JSON.parse(readFileSync(join(getAssets(), "indexes", vjson.assets + ".json")).toString())

        if (AssetIndex.virtual) AssetRoot = join(AssetRoot, "legacy", "virtual");
        if (AssetIndex.map_to_resources) {
            AssetRoot = join(AssetRoot, "legacy", "resources");
            mklink(AssetRoot, join(this.getPath(), "resources"));
            AssetRoot = join(this.getPath(), "resources");
        };

        const classpath_separator = type() == "Windows_NT" ? ";" : ":";
        const classPath = cp.join(classpath_separator)
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

            assets_root: AssetRoot,
            assets_index_name: vjson.assetIndex.id,

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
            game_assets: AssetRoot,

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
            } else if (date < Date.parse("2021-12-10T08:23:00+00:00")&&date > Date.parse("2013-09-19T15:52:37+00:00")) {
                const log4j = date < Date.parse( "2017-05-10T11:37:17+00:00") ? "log4j-fix-1.xml" : "log4j-fix-2.xml"
                cpSync(join(getMeta().index, log4j), join(this.getPath(), log4j));
                rawJVMargs.push("-Dlog4j.configurationFile=" + log4j);
            }
        }
        var jvmArgs = parseArguments(args, rawJVMargs);

        var gameArgs = vjson.arguments ? parseArguments(args, vjson.arguments.game) : "";
        gameArgs += vjson.minecraftArguments ? " " + vjson.minecraftArguments : "";

        var launchCom = jvmArgs + " " + vjson.mainClass + " " + gameArgs;

        Object.keys(args).forEach(key => {
            const regex = new RegExp(`\\\$\{${key}\}`, "g")
            launchCom = launchCom.replace(regex, args[key])
        })
        emit("jvm.start", "Minecraft", this.getPath());
        console.log(launchCom.trim().split(" "))
        const s = spawn(javaPath, launchCom.trim().split(" "), { "cwd": this.getPath() })
        s.stdout.on('data', (chunk) => emit("jvm.stdout", "Minecraft", chunk));
        s.stderr.on('data', (chunk) => emit("jvm.stderr", "Minecraft", chunk));
    }
}