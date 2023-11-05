import { Instance } from "index";
import { emit, getMeta } from "../../config.js";
import {
  VersionManifest,
  ModPackApiInfo,
  curseforgeModpack,
  DownloadableFile,
} from "../../../types";
import { fsSanitizer } from "../util.js";
import { Dir, File } from "gfsl";
import { download } from "../../downloader.js";
import { getForgeVersions } from "../../handler.js";

export async function importGmllLink(url: string): Promise<VersionManifest>;
export async function importGmllLink(
  url: string,
  name: string,
): Promise<Instance>;
export async function importGmllLink(
  url: string,
  name?: string,
): Promise<Instance | VersionManifest> {
  const r = await fetch(url + "/.meta/api.json");
  if (!r.ok) throw "Could not find the api doc";
  const v = (await r.json()) as ModPackApiInfo;
  if (v.version > 2) {
    throw "Incompatible version ID detected";
  }
  const manfile = fsSanitizer(v.name) + ".json";
  const manifest = (
    await getMeta()
      .manifests.getFile(manfile)
      .download(url + "/.meta/manifest.json", { sha1: v.sha })
  ).toJSON<VersionManifest>();
  if (!name) return manifest;
  return new Instance({ version: manifest.id, name: name }).save();
}

export async function importCurseForge(
  instance: Instance,
  urlorFile: string | File,
  forge?: string | File,
) {
  emit("debug.warn", "GMLL's support for curse modpacks is in an Alpha state!");
  emit("debug.warn", "Use GMLLs native modpack api instead if you can");
  emit("debug.warn", "Only fabric modpacks work properly atm.");
  const tmp = getMeta().scratch.getDir("curse", instance.name).mkdir();
  const metaInf = tmp.getFile("manifest.json");
  const installedFile = instance.getDir().getFile("installed.txt");
  const metaFile = getMeta().scratch.getFile("curse_meta.json");
  const metaModData: {
    [key: string]: {
      id: string;
      sha1?: string | string[];
      size?: number;
    };
  } = metaFile.exists() ? metaFile.toJSON() : {};

  if (installedFile.exists() && metaInf.exists()) {
    const inf = metaInf.toJSON<curseforgeModpack>();
    instance.version = "curse." + inf.name + "-" + inf.version;
    emit("debug.info", "Installed files found, assuming file was installed!");
    return instance;
  }
  let file: File;
  if (typeof urlorFile == "string") {
    file = instance.getDir().getFile("modpack.zip");
    await file.download(urlorFile);
  } else {
    file = urlorFile;
  }
  emit("debug.info", "Extracting achive");

  await file.unzip(tmp);
  const inf = metaInf.toJSON<curseforgeModpack>();

  emit("debug.info", "Applying overides");
  function copyFile(fToCopy: File | Dir, base: Dir) {
    if (fToCopy instanceof File) {
      const file = base.getFile(fToCopy.getName()).rm();
      fToCopy.moveTo(file);
    } else {
      fToCopy.ls().forEach((e) => copyFile(e, base.getDir(fToCopy.getName())));
    }
  }
  tmp
    .getDir(inf.overrides)
    .ls()
    .forEach((e) => copyFile(e, instance.getDir()));

  let mcVersion = inf.minecraft.version;

  if (forge) {
    mcVersion = await instance.installForge(forge);
  } else {
    if (inf.minecraft.modLoaders.length > 1)
      emit(
        "debug.warn",
        "GMLL may not support multi modloader setups are currently not recommended!",
      );

    for (const e of inf.minecraft.modLoaders) {
      const data = e.id.split("-");
      const type = data[0];
      const version = data[1];

      if (["fabric", "quilt"].includes(type)) {
        mcVersion = `${type}-loader-${version}-${inf.minecraft.version}`;
      } else if ("forge" == type) {
        const forgeVersions = await getForgeVersions();
        const forgeVersion = forgeVersions[mcVersion].find((e) =>
          e.forge.endsWith(version),
        );
        if (!forgeVersion) throw "Forge version not found!";
        await forgeVersion.install();
        mcVersion = forgeVersion.game;
      } else {
        emit(
          "debug.warn",
          "Unsupported modloader type " +
            e.id +
            "\nGMLL is not natively compatible with the method Curse uses to install forge.",
        );
      }
    }
  }
  const mods = instance.getDir().getDir("mods").mkdir();
  const fileNames = [];

  const files: DownloadableFile[] = [];

  inf.files.forEach((f) => {
    const name = `${f.projectID}-${f.fileID}`;
    fileNames.push(name);

    const meta = metaModData[name];
    let fname = name;
    if (meta && meta.id && meta.sha1 && meta.size)
      fname = meta.id + "-" + meta.sha1.slice(0, 5) + meta.size.toString(36);

    files.push({
      name: fname + ".jar",
      path: [instance.getDir().sysPath(), "mods"],
      url:
        f.downloadUrl ||
        `https://www.curseforge.com/api/v1/mods/${f.projectID}/files/${f.fileID}/download`,
      key: meta?.id || name,
      chk: meta || {},
    });
  });

  await download(files);

  instance.version = mcVersion;
  const err = (await instance.getMetaPaths()).mods.getDir("unparsable").mkdir();

  (await instance.getMods()).forEach((e) => {
    const fileName = e.path.getName();

    if (fileNames.includes(fileName)) {
      if (e.error) {
        if (e.loader == "unknown") e.path.moveTo(err.getFile(e.path.getName()));
        return;
      }
      const sha1 = e.path.getHash();
      const size = e.path.getSize();

      metaModData[fileName] = {
        sha1,
        size,
        id: e.id + "-" + e.version,
      };
      const nfile = mods.getFile(
        fsSanitizer(
          e.id + "-" + e.version + "-" + sha1.slice(0, 5) + size.toString(36),
        ) + ".jar",
      );
      e.path.moveTo(nfile);
    }
  });
  metaFile.write(metaModData);
}

export async function importModpack(
  this: Instance,
  urlorFile: string | File,
  type: "curseforge" | "gmll",
  forge?: string | File,
) {
  switch (type) {
    case "curseforge":
      await importCurseForge(this, urlorFile, forge);
      break;
    case "gmll":
      if (forge)
        emit("debug.warn", "The forge property goes unused in this mode!");
      if (typeof urlorFile == "string")
        this.version = (await importGmllLink(urlorFile)).id;
      else emit("debug.warn", "Only URLS are supported");
      break;
    default:
      emit("debug.error", "Unsupported modpack type!");
  }

  return this;
}
