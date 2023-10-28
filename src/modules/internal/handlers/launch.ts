import { spawn } from "child_process";
import { randomUUID } from "crypto";

import {
  getMeta,
  getAssets,
  getNatives,
  getLauncherName,
  getLauncherVersion,
  getlibraries,
  emit,
} from "../../config.js";
import { Dir, File } from "../../objects/files.js";
import type { Player, AssetIndex, LaunchArguments } from "../../../types";
import { type, cpus } from "os";
import { join } from "path";
import {
  combine,
  fsSanitizer,
  processAssets,
  getClientID,
  lawyer,
} from "../util.js";
import { download, getAgentFile } from "../../downloader.js";
import instance from "../../objects/instance.js";

/**
 * For internal use only
 */
function parseArguments(val = {}, args: LaunchArguments) {
  let out = "";
  args.forEach((e) => {
    if (typeof e == "string") out += "\u0000" + e.trim().replace(/\s/g, "");
    else if (lawyer(e.rules, val))
      out +=
        "\u0000" +
        (e.value instanceof Array ? e.value.join("\u0000") : e.value);
  });
  return out;
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

    if (version.mergeFailure()) chk.rm();

    let security = false;
    //patch download files
    const instance = version.json.instance;
    for (let i = 0; i < instance.files.length; i++) {
      instance.files[i].path = [
        this.getDir().sysPath(),
        ...instance.files[i].path,
      ];
      instance.files[i].path.forEach((e) => {
        if (e.includes("..")) security = true;
      });
      new Dir(...instance.files[i].path).mkdir();
      if (instance.files[i].unzip) {
        instance.files[i].unzip.file = [
          this.getDir().sysPath(),
          ...instance.files[i].unzip.file,
        ];
      }
    }
    if (security) {
      /**DO NOT REMOVE.
       * 1) This is here to prevent someone escaping the instance sandbox.
       * 2) This stops non standard modPacks causing issues...
       * 3) This is here to allow for future security measures
       */
      throw "Security exception!\nFound '..' in file path which is not allowed as it allows one to escape the instance folder";
    }

    await download(instance.files);
    if (!chk.exists()) {
      if (instance.meta) this.meta = combine(this.meta, instance.meta);
      if (instance.assets) this.assets = combine(instance.assets, this.assets);
      if (instance.forge) {
        const fFile = this.getDir().getFile(...instance.forge.installer);
        if (!fFile.exists()) {
          throw "Cannot find forge installer";
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
 * This essentially does an integrity check.
 * @param token The player login token
 * @param resolution Optional information defining the game's resolution
 */
export async function launch(
  this: instance,
  token: Player,
  resolution?: { width: string; height: string },
) {
  //const metaPaths = (await this.getMetaPaths());
  if (!token) {
    console.warn("[GMLL]: No token detected. Launching game in demo mode!");
    const demoFile = getMeta().index.getFile("demo.txt");
    if (!demoFile.exists()) demoFile.write(randomUUID());

    token = {
      profile: {
        id: demoFile.read(),
        demo: true,
        name: "player",
      },
      access_token: "",
    };
  }
  const version = await this.install();
  const jarModded = await instance.jarMod(await this.getMetaPaths(), version);
  const cp: string[] = version.getClassPath(undefined, jarModded);

  const versionJson = await version.getJSON();
  let assetRoot = getAssets();

  let assetsFile = this.getDir().getDir("assets");

  let AssetIndex = getAssets()
    .getFile("indexes", (versionJson.assets || "pre-1.6") + ".json")
    .toJSON<AssetIndex>();
  let assets_index_name = versionJson.assetIndex.id;
  if (this.assets.objects) {
    AssetIndex = combine(AssetIndex, this.assets);
    assets_index_name = fsSanitizer(assets_index_name + "_" + this.name);
    getAssets()
      .getFile("indexes", assets_index_name + ".json")
      .write(AssetIndex);
    processAssets(AssetIndex);
  }

  if (AssetIndex.virtual || AssetIndex.map_to_resources) {
    assetRoot = getAssets().getDir(
      "legacy",
      AssetIndex.virtual ? "virtual" : "resources",
    );
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
    version_name: versionJson.inheritsFrom || versionJson.id,
    game_directory: this.getDir().sysPath() + "/",

    assets_root: assetsFile,
    assets_index_name: assets_index_name,
    auth_uuid: token.profile.id,
    user_type: token.profile.type,
    auth_xuid: token.profile.xuid,
    clientid: getClientID(),

    version_type: versionJson.type,
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

    port: 0,
  };
  const javaPath =
    this.javaPath == "default"
      ? version.getJavaPath()
      : new File(this.javaPath);
  const rawJvmArgs: LaunchArguments = instance.defaultGameArguments;
  rawJvmArgs.push(...(versionJson.arguments?.jvm || instance.defJVM));

  const agentFile = getAgentFile();
  if (
    !this.noLegacyFix &&
    version.manifest.releaseTime &&
    Date.parse(version.manifest.releaseTime) <
      Date.parse("2014-04-14T17:29:23+00:00")
  ) {
    if (agentFile.exists())
      rawJvmArgs.push(`-javaagent:${agentFile.sysPath()}`);
    rawJvmArgs.push(...instance.oldJVM);
  }
  const jvmArgs = parseArguments(args, rawJvmArgs);

  let gameArgs = versionJson.arguments
    ? parseArguments(args, versionJson.arguments.game)
    : "";
  gameArgs += versionJson.minecraftArguments
    ? "\x00" + versionJson.minecraftArguments.replace(/\s/g, "\x00")
    : "";
  let launchCom =
    jvmArgs +
    "\x00" +
    versionJson.mainClass +
    (!gameArgs.startsWith("\x00") ? "\x00" : "") +
    gameArgs;
  Object.keys(args).forEach((key) => {
    const regex = new RegExp(`\\$\{${key}}`, "g");
    launchCom = launchCom.replace(regex, args[key]);
  });
  emit("jvm.start", "Minecraft", this.getDir().sysPath());
  const launchArgs = launchCom.trim().split("\x00");
  console.log(launchCom.split("\x00"));
  if (launchArgs[0] == "") launchArgs.shift();
  const s = spawn(javaPath.sysPath(), launchArgs, {
    cwd: join(this.getDir().sysPath()),
    env: combine(process.env, this.env),
    detached: this.detach,
  });
  s.stdout.on("data", (chunk) => emit("jvm.stdout", "Minecraft", chunk));
  s.stderr.on("data", (chunk) => emit("jvm.stderr", "Minecraft", chunk));
}
