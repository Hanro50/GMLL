import { Dir, File, packAsync } from "gfsl";
import { platform } from "os";
import type {
  DownloadableFile,
  ForgeVersion,
  InstanceMetaPaths,
  InstancePackConfig,
  VersionJson,
  VersionManifest,
} from "../../../types";
import { emit, getAssets } from "../../config.js";
import {
  getForgeVersions as _getForgeVersions,
  installForge as _installForge,
} from "../../handler.js";
import Instance from "../../objects/instance.js";
import Version from "../../objects/version.js";

import { assetTag, fsSanitizer } from "../util.js";
/**Gets the load order of minecraft jars in jar mod loader. */
export async function getJarModPriority(this: Instance) {
  return (await this.getMetaPaths()).jarMods
    .getFile("priority.json")
    .load<{ [key: string]: number }>({});
}

/**Wraps up an instance in a prepackaged format that can be easily uploaded to a server for distribution
 * @param baseUrl The base URL the generated files will be stored within on your server. For example http\:\/\/yourawesomdomain.net\/path\/to\/files\/
 * @param save The file GMLL will generate the final files on.
 * @param name The name that should be used to identify the generated version files
 * @param forge The path to a forge installation jar
 * @param trimMisc Gets rid of any unnecessary miscellaneous files

 */
export async function pack(this: Instance, config: InstancePackConfig) {
  let modpackVersion = 1;
  const saveDir =
    typeof config.outputDir == "string"
      ? new Dir(config.outputDir)
      : config.outputDir;
  const baseDownloadLink = config.baseDownloadLink;
  const trimMisc = config.trimMisc;

  let _forge = config.forgeInstallerPath;
  if (_forge) {
    _forge =
      config.forgeInstallerPath instanceof File
        ? config.forgeInstallerPath
        : new File(config.forgeInstallerPath);
  }
  const forge = _forge as File;
  const modpackName = config.modpackName || this.getName();

  await this.install();
  const blacklist = [
    "usercache.json",
    "realms_persistence.json",
    "logs",
    "profilekeys",
    "usernamecache.json",
  ];
  const separate = [
    "resourcepacks",
    "texturepacks",
    "mods",
    "coremods",
    "jarmods",
    "shaderpacks",
  ];
  const dynamic = ["saves", "config"];
  const bundle = ["saves"];
  const pack = ["config"];

  const me = this.getDir();
  const resources: DownloadableFile[] = [];

  const cp = (d: Dir, path: string[]) => {
    if (d.exists()) {
      d.ls().forEach((e) => {
        if (!e.exists()) return;
        if (e instanceof File) {
          const f = new File(saveDir.javaPath(), ...path, e.name);
          e.copyTo(f.mkdir());
          resources.push({
            key: [...path, e.name].join("/"),
            name: e.name,
            path: path,
            url: [baseDownloadLink, ...path, e.name].join("/"),
            chk: { sha1: f.getHash(), size: f.getSize() },
          });
        } else if (!e.isLink()) {
          const path2 = [...path, e.path[e.path.length - 1]];
          cp(e, path2);
        }
      });
    }
  };
  separate.forEach((e) => cp(me.getDir(e), [e]));
  const data = saveDir.getDir(".data").mkdir();
  for (let i = 0; i < bundle.length; i++) {
    const e = bundle[i];
    const ls = me.getDir(e).ls();
    for (let k = 0; k < ls.length; k++) {
      const e2 = ls[k];
      if (!e2.isLink() && e2 instanceof Dir && e2.exists()) {
        const name = e2.getName();
        const zip = e + "_" + k + ".zip";
        const file = data.getFile(zip);
        await packAsync(e2.sysPath(), file.sysPath());

        resources.push({
          dynamic: dynamic.includes(e),
          unzip: { file: [e] },
          key: [e, name].join("/"),
          name: zip,
          path: [".data"],
          url: [baseDownloadLink, ".data", zip].join("/"),
          chk: { sha1: file.getHash(), size: file.getSize() },
        });
      }
    }
  }
  for (let i = 0; i < pack.length; i++) {
    const e = pack[i];
    const directory = me.getDir(e);
    if (directory.exists() && !directory.isLink()) {
      const zip = e + ".zip";
      const file = data.getFile(zip);
      await packAsync(directory.sysPath(), file.sysPath());

      resources.push({
        dynamic: dynamic.includes(e),
        unzip: { file: [] },
        key: [e, modpackName].join("/"),
        name: zip,
        path: [".data"],
        url: [baseDownloadLink, ".data", zip].join("/"),
        chk: { sha1: file.getHash(), size: file.getSize() },
      });
    }
  }

  const ls2 = me.ls();
  const zip = "misc.zip";
  const miscZip = data.getFile(zip).mkdir();
  const avoid = [...separate, ...bundle, ...blacklist, ...pack];
  if (this.assets && this.assets.objects) {
    const assetDir = saveDir.getDir("assets").mkdir();
    Object.values(this.assets.objects).forEach((e) => {
      assetTag(getAssets().getDir("objects"), e.hash)
        .getFile(e.hash)
        .copyTo(
          assetTag(assetDir.getDir("objects"), e.hash).mkdir().getFile(e.hash),
        );
    });
    await packAsync(assetDir.sysPath(), miscZip.sysPath());

    assetDir.rm();
  }
  if (!trimMisc)
    for (let k = 0; k < ls2.length; k++) {
      const e = ls2[k];
      if (
        !e.isLink() &&
        !avoid.includes(e.getName()) &&
        !e.getName().startsWith(".")
      )
        await packAsync(e.sysPath(), miscZip.sysPath());
    }
  if (miscZip.exists()) {
    resources.push({
      unzip: { file: [] },
      key: "misc",
      name: "misc.zip",
      path: [".data"],
      url: [baseDownloadLink, ".data", zip].join("/"),
      chk: { sha1: miscZip.getHash(), size: miscZip.getSize() },
    });
  } else {
    emit(
      "debug.warn",
      "No misc zip detected! If this is intended then please ignore",
    );
  }
  const ver: Partial<VersionJson> = {
    instance: {
      //      restart_Multiplier: 1,
      files: resources,
      assets: this.assets,
      meta: this.meta,
    },

    id: modpackName,
  };
  const versionFile = saveDir.getDir(".meta").mkdir().getFile("version.json");
  let finalVersion = this.version;
  if (config.forgeVersion) {
    if (modpackVersion == 1) modpackVersion = 2;
    const forge = _installForge(config.forgeVersion);
    finalVersion = forge.id;
    ver.instance.forge = config.forgeVersion;
  } else if (forge) {
    const path = saveDir.getDir(".forgiac").rm().mkdir();
    const _manifest = await _installForge(forge, [
      "--.minecraft",
      path.sysPath(),
    ]);
    const forgePath = saveDir.getDir("forge").mkdir();
    finalVersion = _manifest.id;
    forge.copyTo(forgePath.getFile(forge.getName()));
    ver.instance.files.push({
      key: forge.getName(),
      name: forge.getName(),
      path: ["forge"],
      url: [baseDownloadLink, "forge", forge.getName()].join("/"),
      chk: { sha1: forge.getHash(), size: forge.getSize() },
    });
    ver.instance.forge = { installer: ["forge", forge.getName()] };

    path.rm();
  }
  ver.inheritsFrom = finalVersion;
  versionFile.write(ver);
  const manifest: VersionManifest = {
    id: modpackName,
    type: "custom",
    sha1: versionFile.getHash(),
    base: finalVersion,
    url: baseDownloadLink + "/" + ".meta/version.json",
    _comment: "Drop this into gmll's manifest folder",
  };
  delete manifest._comment;
  saveDir.getFile(".meta", "manifest.json").write(manifest);
  saveDir.getFile(".meta", "api.json").write({
    name: modpackName,
    version: 1,
    sha: saveDir.getFile(".meta", "manifest.json").getHash(),
    _comment:
      "Here for future proofing incase we need to introduce a breaking change to this system.",
  });

  let index = `<!DOCTYPE html><html><!--This is just a place holder! GMLL doesn't check this. It is merely here to look nice and serve as a directory listing-->`;
  index += `<head><link rel="stylesheet" href="https://styles.hanro50.net.za/v1/main"><title>${modpackName}</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="A GMLL minecraft modpack"></head><body><h1>${modpackName}</h1><h2>Copy the link to this page into gmll to import this modpack!</h2><h2>File list</h2>`;
  function read(f: Dir, directory = []) {
    f.ls().forEach((e) => {
      if (
        e.getName() == "index.html" ||
        e.getName() == `manifest_${fsSanitizer(modpackName)}.json`
      )
        return;
      if (e instanceof File) {
        const entry = [...directory, e.getName()].join("/");
        index += `&nbsp;<br><div class="element button" onclick="document.location.href='./${entry}'">${entry}</div>`;
      } else read(e, [...directory, e.getName()]);
    });
  }
  read(saveDir);
  index += `</body></html>`;
  saveDir.getFile("index.html").write(index);
  saveDir.getFile(`manifest_${fsSanitizer(modpackName)}.json`).write(manifest);
  return ver;
}
/**An version of the wrap function that takes an object as a variable instead of the mess the base function takes. */
export function wrap(
  this: Instance,
  baseUrl: string,
  save: Dir | string = new Dir(),
  modpackName: string = "custom_" + this.name,
  forge?: { jar: File | string } | File,
  trimMisc = false,
) {
  const forgeInstallerPath = "jar" in forge ? forge.jar : forge;

  return this.pack({
    baseDownloadLink: baseUrl,
    outputDir: save,
    forgeInstallerPath,
    modpackName,
    trimMisc,
  });
}
/**Install forge in this instance. */
export async function installForge(
  this: Instance,
  forge: File | string | ForgeVersion,
) {
  const manifest = await _installForge(forge);
  this.version = manifest.id;
  return manifest;
}

export async function getForgeVersions(this: Instance) {
  const data = (await _getForgeVersions())[this.version];
  return data.map((e) => {
    const forge = e;
    forge.install = () => this.installForge(forge);
    return forge;
  });
}

/**
 * Used to modify minecraft's jar file (Low level)

 * @param metaPaths
 * @param version
 * @returns
 */
export async function jarMod(
  metaPaths: InstanceMetaPaths,
  version: Version,
): Promise<File> {
  const jarMods = metaPaths.jarMods;
  const bin = Dir.tmpdir().getDir("gmll", "bin").rm().mkdir();
  const custom = bin.getFile(`${version.name}.jar`);

  if (!jarMods || !jarMods.exists()) return;
  const lst = jarMods.ls();
  if (lst.length < 1) return;
  emit(
    "debug.warn",
    "Jar modding is experimental atm.\nWe still don't have a way to order jars\nRecommended for modding legacy versions or mcp...",
  );
  emit("debug.info", "Packing custom jar");
  const tmp = Dir.tmpdir().getDir("gmll", "tmp").rm().mkdir();
  const jar = version.folder.getFile(version.name + ".jar");
  if (!jar.exists()) return;
  await jar.unzip(tmp, { exclude: ["META-INF/*"] });

  let priority = {
    _comment:
      "0 is the default, the lower the priority. The sooner a mod will be loaded. Deleting this file resets it",
  };
  const pFile = jarMods.getFile("priority.json");
  let fReset = false;
  if (pFile.exists())
    try {
      priority = pFile.toJSON();
    } catch (e) {
      emit("debug.warn", "Failed to parse priorities file!");
    }
  else fReset = true;
  lst.sort((aF, bF) => {
    const a = aF.getName();
    const b = bF.getName();
    if (priority[a] != priority[b]) {
      if (a in priority && b in priority) return priority[a] - priority[b];
      if (a in priority) return priority[a];
      if (b in priority) return 0 - priority[b];
    }
    return a > b ? 1 : -1;
  });

  emit("debug.info", "Running through files");
  for (const e of lst) {
    if (e instanceof File) {
      const n = e.getName();
      if (n.endsWith(".zip") || n.endsWith(".jar")) {
        if (!(n in priority)) {
          priority[n] = fReset ? (Object.keys(priority).length - 1) * 10 : 0;
        }
        await e.unzip(tmp);
      }
    }
  }
  pFile.write(priority);
  emit("debug.info", "Packing jar");
  await packAsync(
    tmp.sysPath() + (platform() == "win32" ? "\\." : "/."),
    custom.sysPath(),
  );
  return custom;
}
