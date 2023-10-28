import { createHash, randomInt } from "crypto";
import Instance from "../../objects/instance.js";

import type {
  ModInfo,
  ForgeDep,
  PlayerDat,
  PlayerStats,
  LevelDat,
  MetaSave,
  InstanceMetaPaths,
  MetaResourcePack,
} from "../../../types";
import { join } from "path";
import { readDat } from "../../nbt.js";
import { Dir, File } from "../../objects/files.js";
import { emit } from "../../config.js";

/**
 * @returns Some low level meta paths used to obtain some key files of this instance.
 */
export async function getMetaPaths(this: Instance): Promise<InstanceMetaPaths> {
  const version = await this.getVersion();
  const p = this.getDir();
  return {
    mods: p.getDir("mods"),
    jarMods: p.getDir("jarmods"),
    saves: p.getDir("saves"),
    resourcePacks: p.getDir(
      Date.parse(version.json.releaseTime) >=
        Date.parse("2013-06-13T15:32:23+00:00")
        ? "resourcepacks"
        : "texturepacks",
    ),
    coreMods: p.getDir("coremods"),
    configs: p.getDir("config"),
  };
}
async function getIcon(file: File, d: Dir, jarPath: string) {
  if (!jarPath || jarPath.length < 1) return null;
  file.extract(d, [jarPath]);
  const jarFile = jarPath.split("/");
  console.log(jarFile);
  const logoFile = d.getFile(...jarFile);
  if (logoFile.exists()) return `data:image/png;base64,${logoFile.toBase64()}`;
  return null;
}
/**
 * Gets information about mods in this instance. This includes the loader version plus some general
 * information about the mod author and mod itself. This will also provide you the icon for a set mod if it can be obtained.\
 *
 * Works with Legacy forge, forge, fabric, riftLoader and liteLoader
 */
export async function getMods(this: Instance): Promise<ModInfo[]> {
  emit("parser.start", "mod", this);
  const meta = await this.getMetaPaths();
  const mods: ModInfo[] = [];

  const tmp = Dir.tmpdir()
    .getDir(
      "gmll",
      "mods",
      this.getDir().getName(),
      createHash("sha1").update(this.getDir().sysPath()).digest("hex"),
    )
    .rm()
    .mkdir();
  async function readMod(
    file: File,
    type: "mod" | "coremod" | "jarmod",
    prefix?: string,
  ): Promise<void> {
    let name = file.getName();
    try {
      name = name.slice(0, name.lastIndexOf("."));
      const fname = prefix ? join(prefix, name) : name;
      const d = tmp.getDir(fname).mkdir();
      await file.extract(d, [
        "pack.mcmeta",
        "mcmod.info",
        "fabric.mod.json",
        "litemod.json",
        "riftmod.json",
        "quilt.mod.json",
        "META-INF/mods.toml",
        "META-INF/MANIFEST.MF",
      ]);
      let metaFile: File;

      //Legacy forge
      if ((metaFile = d.getFile("mcmod.info")).exists()) {
        type mcInfo = [
          {
            modid: string;
            name: string;
            mcversion: string;
            description: string;
            version: string;
            credits: string;
            authorsList?: string[];
            authors?: string[];
            logoFile: string;
            url: string;
            updateUrl: string;
            parent: string;
            screenshots: string[];
            dependencies: string[];
          },
        ];
        const mcInfoJson = metaFile.toJSON<mcInfo>();
        for (const mcInfoVal of mcInfoJson) {
          const icon = await getIcon(file, d, mcInfoVal.logoFile);
          mods.push({
            id: mcInfoVal.modid,
            authors: mcInfoVal.authorsList
              ? mcInfoVal.authorsList
              : mcInfoVal.authors,
            loader: "forge",
            name: mcInfoVal.name
              ? prefix
                ? join(prefix, mcInfoVal.name)
                : mcInfoVal.name
              : name,
            version: mcInfoVal.version,
            path: file,
            depends: mcInfoVal.dependencies,
            screenshots: mcInfoVal.screenshots,
            parent: mcInfoVal.parent,
            updateUrl: mcInfoVal.updateUrl,
            url: mcInfoVal.url,
            description: mcInfoVal.description,
            credits: mcInfoVal.credits,
            mcversion: mcInfoVal.mcversion,
            icon,
            type,
          });
        }
        return;
      }
      //Quilt mods
      if ((metaFile = d.getFile("quilt.mod.json")).exists()) {
        type quiltMod = {
          schema_version: 1;
          quilt_loader: {
            group: string;
            id: string;
            version: string;
            metadata?: {
              name: string;
              description?: string;
              contributors?: {
                [key: string]: string;
              };
              contact?: {
                email: string;
                homepage: string;
                issues: string;
                sources: string;
              };
              license: string;
              icon: string;
            };
            intermediate_mappings: string;
            depends?: [
              | {
                  id: string;
                  versions: string;
                  optional?: boolean;
                }
              | string,
            ];
            provides?: [
              | {
                  id: string;
                  versions: string;
                }
              | string,
            ];
            jars?: [string];
          };
        };
        const metaInfo = metaFile.toJSON<quiltMod>();
        let icon: string;
        if (metaInfo.quilt_loader.metadata.icon)
          icon = await getIcon(file, d, metaInfo.quilt_loader.metadata.icon);

        const authors = [];
        if (metaInfo.quilt_loader.metadata?.contributors?.authors) {
          authors.push(
            ...Object.keys(metaInfo.quilt_loader.metadata.contributors.authors),
          );
        }
        const depends:
          | {
              [key: string]: string;
            }
          | Array<ForgeDep | string> = [];
        if (metaInfo.quilt_loader.depends) {
          metaInfo.quilt_loader.depends.forEach((e) => {
            if (typeof e == "string") depends.push(e);
            else {
              depends.push({
                modId: e.id,
                mandatory: !e.optional,
                versionRange: e.versions,
                side: "both",
              });
            }
          });
        }

        mods.push({
          id: metaInfo.quilt_loader.id,
          authors: authors, //
          loader: "quilt",
          name: metaInfo.quilt_loader.metadata?.name
            ? prefix
              ? join(prefix, metaInfo.quilt_loader.metadata?.name)
              : metaInfo.quilt_loader.metadata?.name
            : name,
          version: metaInfo.quilt_loader.version,
          path: file,
          depends: depends, // metaInfo.quilt_loader.depends,
          description: metaInfo.quilt_loader.metadata?.description,
          url: metaInfo.quilt_loader.metadata?.contact?.homepage,
          source: metaInfo.quilt_loader.metadata?.contact?.sources,
          licence: metaInfo.quilt_loader.metadata?.license,
          icon,
          type,
        });
        return;
      }
      //Fabric and rift
      if (
        (metaFile = d.getFile("fabric.mod.json")).exists() ||
        (metaFile = d.getFile("riftmod.json")).exists()
      ) {
        type fabricMod = {
          schemaVersion: number;
          id: string;
          version: string;
          name: string;
          description: string;
          authors: string[];
          contact: { homepage: string; sources: string };
          license: string;
          icon: string;
          environment: string;
          entrypoints: { main: string[]; client: string[] };
          mixins: string[];
          depends: { [key: string]: string };
          suggests: { [key: string]: string };
        };
        let metaInfo: fabricMod;
        try {
          metaInfo = metaFile.toJSON<fabricMod>();
        } catch {
          try {
            metaInfo = JSON.parse(metaFile.read().replaceAll("\n", ""));
          } catch {
            try {
              metaInfo = JSON.parse(
                metaFile.read().replace(/("description":[^"]"[^"]*",)/g, ""),
              );
            } catch (err) {
              emit("parser.fail", "mod", err, file);
              mods.push({
                id: "unknown",
                authors: [],
                version: "unknown",
                loader: metaFile.getName().endsWith("fabric.mod.json")
                  ? "fabric"
                  : "riftMod",
                name: name,
                path: file,
                type,
                error: true,
              });
              return;
            }
          }
        }
        const icon = await getIcon(file, d, metaInfo.icon);
        mods.push({
          id: metaInfo.id,
          authors: metaInfo.authors,
          loader: metaFile.getName().endsWith("fabric.mod.json")
            ? "fabric"
            : "riftMod",
          name: metaInfo.name
            ? prefix
              ? join(prefix, metaInfo.name)
              : metaInfo.name
            : name,
          version: metaInfo.version,
          path: file,
          depends: metaInfo.depends,
          description: metaInfo.description,
          url: metaInfo.contact?.homepage,
          source: metaInfo.contact?.sources,
          licence: metaInfo.license,
          icon,
          type,
        });
        return;
      }
      //LiteLoader
      if ((metaFile = d.getFile("litemod.json")).exists()) {
        type liteInf = {
          name: string;
          displayName: string;
          version: string;
          author: string;
          mcversion: string;
          revision: string;
          description: string;
          url: string;
        };
        const lintInfJson = metaFile.toJSON<liteInf>();
        mods.push({
          id: lintInfJson.name,
          name: lintInfJson.name
            ? prefix
              ? join(prefix, lintInfJson.name)
              : lintInfJson.name
            : name,
          authors: [lintInfJson.author],
          version: lintInfJson.version || lintInfJson.revision || "unknown",
          loader: "liteLoader",
          description: lintInfJson.description,
          type,
          path: file,
        });
        return;
      }
      //Modern forge
      if ((metaFile = d.getFile("META-INF", "mods.toml")).exists()) {
        const modInfoJson: ModInfo = {
          type,
          id: "unknown",
          authors: [],
          version: "unknown",
          loader: "forge",
          name: name,
          path: file,
          depends: [] as ForgeDep[],
        };
        let dep: ForgeDep = {
          modId: "",
          mandatory: false,
          versionRange: "",
          ordering: "",
          side: "",
        };
        const lines = metaFile.read().split("\n");

        let inModHeader = false;
        let independency = false;

        const state1Map = new Map();
        state1Map.set("license", (val: string) => (modInfoJson.licence = val));
        state1Map.set("credits", (val: string) => (modInfoJson.credits = val));
        state1Map.set(
          "logoFile",
          async (val: string) =>
            (modInfoJson.icon = await getIcon(file, d, val)),
        );
        const state2Map = new Map();
        state2Map.set("modId", (val: string) => (modInfoJson.id = val));
        state2Map.set("version", (val: string) => (modInfoJson.version = val));
        state2Map.set("displayURL", (val: string) => (modInfoJson.url = val));
        state2Map.set(
          "updateJSONURL",
          (val: string) => (modInfoJson.updateUrl = val),
        );
        state2Map.set("credits", (val: string) => (modInfoJson.credits = val));
        state2Map.set("authors", (val: string) => {
          try {
            modInfoJson.authors = val.startsWith("[") ? JSON.parse(val) : [val];
          } catch {
            modInfoJson.authors = [val];
          }
        });
        state2Map.set(
          "description",
          (val: string) => (modInfoJson.description = val),
        );

        const state3Map = new Map();
        state3Map.set("modId", (val: string) => (dep.modId = val));
        state3Map.set(
          "mandatory",
          (val: string) => (dep.mandatory = Boolean(val)),
        );
        state3Map.set(
          "versionRange",
          (val: string) => (dep.versionRange = val),
        );
        state3Map.set("ordering", (val: string) => (dep.ordering = val));
        state3Map.set("side", (val: string) => (dep.side = val));
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
          line = line.includes("#") ? line.slice(0, line.indexOf("#")) : line;
          if (line.length < 1) continue;
          if (line.includes("=")) {
            const raw = line.split("=");
            if (raw[1].includes("'''")) {
              raw[1] = raw[1].slice(3);
              while (!lines[++i].includes("'''") && i < lines.length)
                raw[1] += lines[i] + "\n";
              raw[i] += lines[i].slice(0, lines[i].indexOf("'''"));
            }
            raw[1] = raw[1].trim();
            if (raw[1].startsWith('"')) raw[1] = raw[1].slice(1);
            if (raw[1].endsWith('"'))
              raw[1] = raw[1].slice(0, raw[1].length - 1);
            //console.log(raw[1])
            raw[0] = raw[0].trim();
            if (state1Map.has(raw[0])) {
              await state1Map.get(raw[0])(raw[1]);
              continue;
            }
            if (independency && state3Map.has(raw[0])) {
              await state3Map.get(raw[0])(raw[1]);
              continue;
            }
            if (inModHeader && state2Map.has(raw[0])) {
              await state2Map.get(raw[0])(raw[1]);
              continue;
            }
          } else if (line.startsWith("[[mods")) {
            inModHeader = true;
          } else if (line.startsWith("[[dependencies")) {
            inModHeader = false;
            if (independency) {
              if (!(modInfoJson.depends instanceof Array))
                modInfoJson.depends = [];
              modInfoJson.depends.push(dep);
              dep = {
                modId: "",
                mandatory: false,
                versionRange: "",
                ordering: "",
                side: "",
              };
            } else {
              modInfoJson.depends = [];
            }
            independency = true;
          }
        }
        if (modInfoJson.depends instanceof Array) {
          modInfoJson.depends.push(dep);
        }
        mods.push(modInfoJson);
        return;
      }
      //Unknown modloader
      if ((metaFile = d.getFile("META-INF", "MANIFEST.MF")).exists()) {
        const metaInfFinal: ModInfo = {
          type,
          id: "unknown",
          authors: [],
          version: "unknown",
          loader: "unknown",
          name: name,
          path: file,
          depends: [] as ForgeDep[],
        };

        const lines = metaFile.read().split("\n");
        const state1Map = new Map();
        state1Map.set(
          "Manifest-Version",
          (val: string) => (metaInfFinal.version = val),
        );

        state1Map.set(
          "Specification-Title",
          (val: string) => (metaInfFinal.name = val),
        );
        state1Map.set("Specification-Vendor", (val: string) => {
          if (!metaInfFinal.authors.includes(val))
            metaInfFinal.authors.push(val);
        });
        state1Map.set(
          "Specification-Version",
          (val: string) => (metaInfFinal.version = val),
        );

        state1Map.set(
          "Implementation-Title",
          (val: string) => (metaInfFinal.name = val),
        );
        state1Map.set(
          "Implementation-Version",
          (val: string) => (metaInfFinal.version = val),
        );
        state1Map.set("Implementation-Vendor", (val: string) => {
          if (!metaInfFinal.authors.includes(val))
            metaInfFinal.authors.push(val);
        });

        state1Map.set(
          "Automatic-Module-Name",
          (val: string) => (metaInfFinal.id = val),
        );

        state1Map.set(
          "Fabric-Minecraft-Version",
          (val: string) => (metaInfFinal.mcversion = val),
        );
        state1Map.set(
          "Fabric-Loom-Version",
          () => (metaInfFinal.loader = "fabric"),
        );

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.length < 1) continue;
          if (!line.includes(":")) continue;
          const raw = line.split(":");
          raw[1] = raw[1].trim();
          if (raw[1].startsWith('"')) raw[1] = raw[1].slice(1);
          if (raw[1].endsWith('"')) raw[1] = raw[1].slice(0, raw[1].length - 1);

          raw[0] = raw[0].trim();
          if (state1Map.has(raw[0])) {
            await state1Map.get(raw[0])(raw[1]);
            continue;
          }
        }
        mods.push(metaInfFinal);
        return;
      }
      if ((metaFile = d.getFile("pack.mcmeta")).exists()) {
        let description = "";
        let format = 0;
        let name = d
          .getName()
          .replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, " ");
        let icon = undefined;
        try {
          const p = metaFile.toJSON<{
            pack: { pack_format: number; description: string; name: string };
          }>().pack;
          if (p.name) name = p.name;
          if (p.description) description = p.description;
          if (p.pack_format) format = p.pack_format;
        } catch {
          const r = metaFile.read().split("\n");
          description = r[randomInt(0, Math.min(r.length, 200))];
        }

        try {
          icon = getIcon(file, d, "pack.png");
        } catch {}
        mods.push({
          id: "unknown",
          authors: [],
          version: `pack_format (${format}`,
          loader: "unknown",
          name: name,
          icon,
          path: file,
          description,
          type,
          error: false,
        });
        return;
      }
      emit("parser.fail", "mod", "Possibly missing mod data!", file);
      // console.warn(`[GMLL]: Could not parse mod -> ${name}\n[GMLL]: Possibly missing mod data!`)
    } catch (err) {
      emit("parser.fail", "mod", err, file);
    }

    mods.push({
      id: "unknown",
      authors: [],
      version: "unknown",
      loader: "unknown",
      name: name,
      path: file,
      type,
      error: true,
    });
  }
  let c = 0;
  let n = 0;
  async function loop(d: Dir, type: "mod" | "coremod" | "jarmod") {
    const l = d.ls();
    c += l.length;
    for (const e of l) {
      emit("parser.progress", e.sysPath(), ++n, c, c - n, this);
      if (!(e instanceof File)) {
        for (const e2 of e.ls())
          if (e2 instanceof File) await readMod(e2, type);
      } else {
        await readMod(e, type);
      }
    }
  }
  await loop(meta.mods, "mod");
  await loop(meta.coreMods, "coremod");
  await loop(meta.jarMods, "jarmod");
  emit("parser.done", "mods", this);
  return mods;
}

/**
 * Gets some general information about all the world files in this instance.
 * It also decodes the level.DAT file for you and returns the decoded file as a JSON file.
 *
 * It also decodes the player data stored in the "playerdata" and "stats" subfolder in newer versions of the game.
 */
export async function getWorlds(this: Instance): Promise<MetaSave[]> {
  emit("parser.start", "save file", this);
  console.log("[GMLL]: Getting level data. This may take a while.");
  const meta = await this.getMetaPaths();
  const saves: MetaSave[] = [];
  if (!meta.saves.exists()) return saves;
  const l = meta.saves.ls();
  const c = l.length;
  let n = 0;
  for (const e of l) {
    try {
      emit("parser.progress", e.sysPath(), ++n, c, c - n, this);
      if (e instanceof File) return;
      const DAT = e.getFile("level.dat");
      const IMG = e.getFile("icon.png");
      const PLAYERDATA = e.getDir("playerdata");
      const PLAYERSTATS = e.getDir("stats");
      let icon = undefined;
      if (!DAT.exists()) return;
      if (IMG.exists()) icon = IMG.sysPath();
      const level = await readDat<LevelDat>(DAT);
      const players: MetaSave["players"] = {};
      if (PLAYERDATA.exists()) {
        for (const plr of PLAYERDATA.ls()) {
          if (plr instanceof File && plr.name.endsWith(".dat")) {
            try {
              const nm = plr.name.substring(0, plr.name.length - 4);
              const PD = await readDat<PlayerDat>(plr);
              let stats = undefined;
              const statefile = PLAYERSTATS.getFile(`${nm}.json`);
              if (statefile.exists()) stats = statefile.toJSON<PlayerStats>();
              players[nm] = { data: PD, stats };
            } catch (e) {
              console.warn("[GMLL]: Failed to parse player data!");
            }
          }
        }
      } else {
        players["Player"] = { data: level.Data.Player };
      }

      saves.push({
        players,
        name: level.Data?.LevelName || e.getName(),
        level,
        path: e,
        icon,
      });
    } catch (err) {
      emit("parser.fail", "save file", err, File);
    }
  }
  emit("parser.done", "save file", this);
  return saves;
}

/**
 * Gets information about the installed resource and texture packs of this instance.
 * This includes information like the pack icon, name, description, legal documents and credits.
 */
export async function getResourcePacks(
  this: Instance,
): Promise<MetaResourcePack[]> {
  emit("parser.start", "resource/texture pack", this);
  const meta = await this.getMetaPaths();
  const packs: MetaResourcePack[] = [];
  if (!meta.resourcePacks.exists()) return packs;
  const l = meta.resourcePacks.ls();
  const tmp = Dir.tmpdir()
    .getDir(
      "gmll",
      "resources",
      this.getDir().getName(),
      createHash("sha1").update(this.path).digest("hex"),
    )
    .rm()
    .mkdir();
  function readPackData(d: Dir, source: File | Dir): MetaResourcePack {
    let icon = null;
    const i = d.getFile("pack.png");
    if (i.exists()) {
      icon = `data:image/png;base64,${i.toBase64()}`;
    }
    let pack = d.getFile("pack.mcmeta");
    let name = d
      .getName()
      .replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, " ");
    let description = "A Minecraft resourcePack/texturePack";
    let format = null;
    if (!pack.exists()) pack = d.getFile("pack.txt");
    if (pack.exists()) {
      try {
        const p = pack.toJSON<{
          pack: { pack_format: number; description: string; name: string };
        }>().pack;
        if (p.name) name = p.name;
        if (p.description) description = p.description;
        if (p.pack_format) format = p.pack_format;
      } catch {
        const r = pack.read().split("\n");
        description = r[randomInt(0, Math.min(r.length, 200))];
      }
    }
    let licenseFile = d.getFile("licence.txt");
    if (!licenseFile.exists()) licenseFile = d.getFile("license.txt");
    if (!licenseFile.exists()) licenseFile = d.getFile("terms of use.txt");
    const license = licenseFile.exists() ? licenseFile.read() : null;
    const creditsFile = d.getFile("credits.txt");
    const credits = creditsFile.exists() ? creditsFile.read() : null;

    return { credits, license, name, description, format, icon, path: source };
  }
  const c = l.length;
  let n = 0;
  for (const e of l) {
    emit("parser.progress", e.sysPath(), ++n, c, c - n, this);
    try {
      if (e instanceof File) {
        const name = e.getName();
        const d = tmp.getDir(name.slice(0, name.lastIndexOf(".")));
        await e.unzip(d, ["*/*", "*/"]);
        packs.push(readPackData(d, e));
      } else {
        packs.push(readPackData(e, e));
      }
    } catch (err) {
      emit("parser.fail", "resource/texture pack", err, File);
    }
  }
  emit("parser.done", "resource/texture pack", this);
  return packs;
}
