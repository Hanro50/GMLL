import { existsSync, symlinkSync, unlinkSync, writeFileSync, readFileSync } from "fs";
import { spawn } from "child_process";
import { join } from "path";
import { getConfig, getLatest } from "./config.js";
import { getChronicle } from "./handler.js";
import { fsSanitiser, mkdir, parseArguments } from "./internal/util.js";
import { cpus, type } from "os";
const config = await getConfig();
/**
 * 
 * @param { string |{component:string}} javaPath 
 * @returns 
 */
export function getJavaPath(javaPath = "jre-legacy") {
    console.log(javaPath)
    if (typeof javaPath != "string")
        javaPath = javaPath.component;
    
    return join(config.files.runtimes, javaPath, "bin", type() == "Windows_NT" ? "java.exe" : "java")
}
const defArgs = [
    "-Xms${ram}G",
    "-Xmx${ram}G",
]
/**@type {GMLL.instance.instance} */
export default class {
    /**
     * 
     * @param {GMLL.instance.options} opt 
     */
    constructor(opt) {
        /**@type {string|{version:version}} */
        this.version = opt && opt.version ? opt.version : getLatest().release;
        this.name = opt && opt.name ? opt.name : this.version;
        this.path = opt && opt.path ? opt.path : join(config.files.instances, fsSanitiser(this.name));
        this.ram = opt && opt.ram ? opt.ram : 2;
        this.cpu = opt && opt.cpu ? opt.cpu : cpus().length;
        mkdir(this.path);
    }
    getChronicle() {
        return getChronicle(this.version)
    }
    save() {
        mkdir(config.metaFiles.profile);
        writeFileSync(join(config.metaFiles.profile, fsSanitiser(this.name + ".json")), JSON.stringify(this));
    }

    /**
     * 
     * @param {GMLL.instance.player} player 
     * @param {{width:string,height:string}} resolution 
     * @returns 
     */
    async launch(player, resolution) {
        const chronicle = this.getChronicle();
        await chronicle.setup();
        var vjson = await chronicle.getJson();

        var AssetRoot = config.files.assets
        const index = JSON.parse(readFileSync(join(config.metaFiles.assets.indexes, vjson.assets + ".json")))

        if (index.virtual) AssetRoot = config.metaFiles.assets.virtual;
        if (index.map_to_resources) { AssetRoot = config.metaFiles.assets.resources; };
        var launcher_version = "0.0.0";
        try {
            launcher_version = process.env.launcher_version || process.env.npm_package_version || require("../package.json").version
        } catch { }
        if (index.map_to_resources) {
            const res = join(this.path, "resources")
            if (existsSync(res)) unlinkSync(res);
            symlinkSync(config.metaFiles.assets.resources, res, 'dir')
        }
        const libdexpath = join(config.metaFiles.launcher.libIndex, this.version + ".json");
        if (!existsSync(libdexpath)) await chronicle.chkLibs();
        const classArr = JSON.parse(readFileSync(libdexpath));
        classArr.push(chronicle.getJar(vjson))
        const classPath = classArr.join(type() == "Windows_NT" ? ";" : ":")
        const args = {
            ram: this.ram,
            cores: this.cpu,

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

            natives_directory: join(config.files.natives, vjson.id),
            launcher_name: process.env.launcher_name || process.env.npm_package_name || "GMLL",
            launcher_version: launcher_version,
            classpath: classPath,
            auth_session: player.session,
            game_assets: AssetRoot,

            classpath_separator: type() == "Windows_NT" ? ";" : ":",
            library_directory: config.files.libraries
        }
        var javaPath = getJavaPath(vjson.javaVersion);
        var jvmArgs = parseArguments(args, defArgs) + (vjson.arguments ? parseArguments(args, vjson.arguments.jvm) : parseArguments(args));

        var gameArgs = vjson.arguments ? parseArguments(args, vjson.arguments.game) : "";
        gameArgs += vjson.minecraftArguments ? " " + vjson.minecraftArguments : "";

        var launchCom = jvmArgs + " " + vjson.mainClass + gameArgs;

        console.log(javaPath)
        Object.keys(args).forEach(key => {
            const regex = new RegExp(`\\\$\{${key}\}`, "g")
            launchCom = launchCom.replace(regex, args[key])
        })
        console.log(javaPath + launchCom)
        const s = spawn(javaPath, launchCom.trim().split(" "), { "cwd": this.path })
        s.stdout.pipe(process.stdout);
        s.stderr.pipe(process.stderr);



    }

}