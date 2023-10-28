import {
  lawyer,
  getOS,
  assetTag,
  throwErr,
  classPathResolver,
  getErr,
  processAssets,
  getCpuArch,
  combine,
} from "./internal/util.js";
import { resolve } from "path";
import {
  emit,
  getAssets,
  getlibraries,
  getMeta,
  getNatives,
  getRepositories,
  getRuntimes,
  getUpdateConfig,
  onUnsupportedArm,
  getMultiCoreMode,
  spawnDownloadWorker,
} from "./config.js";
import { cpus } from "os";
import nFetch from "node-fetch";
import { Dir, download7zip, File, packAsync } from "gfsl";
import { readlinkSync } from "fs";
import type {
  DownloadableFile,
  RuntimeManifestEntry,
  RuntimeManifest,
  MCRuntimeVal,
  VersionJson,
  AssetIndex,
  Artifact,
  MojangResourceManifest,
  MojangResourceFile,
  VanillaManifestJson,
} from "../types";
import { Worker } from "worker_threads";
import {
  check,
  expand,
  processFile,
  toDownloadable,
} from "./internal/downloadable.js";
const assetURL = "https://resources.download.minecraft.net/";
const processCMD = "download.progress";
const failCMD = "download.fail";
const getCMD = "download.get";
const postCMD = "download.post";
/**
 * Download function. Can be used for downloading modpacks and launcher updates.
 * Checks sha1 hashes and can use multiple cores to download files rapidly.
 * Untested on Intel's new CPUs, use at own risk and report to me if it breaks.
 *
 * -Hanro50
 *
 * @param obj The objects that will be downloaded
 */
export function download(obj: Partial<DownloadableFile>[]): Promise<void> {
  emit("download.started");
  obj.sort((a, b) => {
    return (b.chk.size || Number.MAX_VALUE) - (a.chk.size || Number.MAX_VALUE);
  });
  const temp = {};
  const unzip: { [key: string]: Partial<DownloadableFile> } = {};
  obj.forEach((e) => {
    switch (check(e)) {
      case 0:
        temp[e.key] = e;
        break;
      case 1:
        unzip[e.key] = e;
        break;
    }
  });
  const totalItems = Object.values(temp).length;
  const _zips: Promise<void>[] = [];
  Object.values(unzip).forEach((json) => {
    _zips.push(expand(new File(...json.path, json.name), json, getMeta().bin));
  });

  if (totalItems <= 0) {
    console.log(totalItems);
    emit("download.done");
    return new Promise((e) => Promise.all(_zips).then(() => e()));
  }
  console.log(totalItems);
  return new Promise<void>(async (res) => {
    await Promise.all(_zips);
    const numCPUs = Math.max(cpus().length, 2);
    const multiCoreMode = getMultiCoreMode();
    let done = 0;
    if (multiCoreMode) {
      let todo = 0;
      const workers: Worker[] = [];
      const fire = () => workers.forEach((w) => w.terminate());
      try {
        emit("download.setup", numCPUs);

        const data = Object.values(temp) as DownloadableFile[];

        for (let i3 = 0; i3 < numCPUs; i3++) {
          const w = await spawnDownloadWorker({
            workerData: {
              processCMD,
              failCMD,
              getCMD,
              postCMD,
              zipDir: getMeta().bin.path,
            },
          });
          workers.push(w);
          w.on("message", (msg) => {
            switch (msg.cmd) {
              case processCMD: {
                done++;
                delete temp[msg.key];
                const left = Object.values(temp).length;
                emit("download.progress", msg.key, done, totalItems, left);

                if (left < 1) {
                  //   active = false;
                  //     clearTimeout(to);
                  emit("download.done");
                  fire();
                  return res();
                }
              }
              case getCMD:
                w.postMessage({
                  cmd: postCMD,
                  data: data[todo],
                });
                todo++;
                break;
              case failCMD:
                emit(msg.cmd, msg.key, msg.type, msg.err);
                break;
              default:
                return;
            }
          });
        }

        return;
      } catch (e) {
        console.error("[gmll]: " + e);
        fire();
      }
    }

    if (multiCoreMode)
      console.warn(
        "[GMLL]: The main downloader encountered an error, using single threaded fallback!",
      );
    emit("download.setup", 1);

    const data = Object.values(temp) as DownloadableFile[];
    const fallback = async (o: DownloadableFile, retry = 0) => {
      try {
        await processFile(o, getMeta().bin);
        return o;
      } catch (e) {
        console.trace(e);
        if (retry <= 3) {
          retry++;
          emit(failCMD, o.key, "retry", e.err);
          await fallback(o, retry);
          return o;
        }
        console.error("[GMLL]: procedural failure : " + new Dir(...o.path));
        emit(failCMD, o.key, "system", e.err);
      }
      return o;
    };
    const lf = async (o: DownloadableFile) => {
      if (!o) return;
      done++;
      delete temp[o.key];
      const left = Object.values(temp).length;
      emit("download.progress", o.key, done, totalItems, left);
    };

    for (let i3 = 0; i3 < data.length; i3 += 100) {
      const lst = [];
      for (let i2 = 0; i2 < 100 && i3 + i2 < data.length; i2++)
        lst.push(
          fallback(data[i3 + i2])
            .then(lf)
            .catch(console.trace),
        );
      await Promise.all(lst);
      console.log("TICK!");
    }
    emit("download.done");
    return res();
  });
}

/**
 * Installs a set version of Java locally.
 * @param runtime the name of the Java runtime. Based on the names Mojang gave them.
 * @returns This is an async function!
 */
export function runtime(runtime: MCRuntimeVal) {
  const meta = getMeta();
  const cFile = meta.runtimes.getFile(runtime + ".json");
  if (!cFile.exists()) {
    throwErr("Cannot find runtime");
  }
  return mojangRFDownloader(
    cFile.toJSON<MojangResourceManifest>(),
    getRuntimes().getDir(runtime),
  );
}
/**
 * Did you know you can use this file to download dungeons?
 * (We prefer not to be sued...so no more details then that)
 *
 * This can decode Mojang's resource file format and download it.
 * @see {@link encodeMRF} if you want to encode a file into this crazy format.
 */
export function mojangRFDownloader(
  file: MojangResourceManifest,
  baseFile: Dir,
  lzma?: Dir,
) {
  if (!lzma) lzma = getMeta().lzma;

  lzma.mkdir();
  const json = file.files;
  const arr = [];

  Object.keys(json).forEach((key) => {
    const obj = json[key];
    let _file = baseFile.getFile(...key.split("/"));
    const _dir = baseFile.getDir(...key.split("/"));
    const name = key.split("/").pop();
    switch (obj.type) {
      case "directory":
        _dir.mkdir();
        break;
      case "file":
        let chk: { size: number; sha1: string }, url: string;
        const opt: {
          executable?: boolean | string;
          unzip?: { file: Dir; exclude?: string[] };
        } = { executable: obj.executable };
        if (obj.downloads.lzma) {
          opt.unzip = { file: _file.dir() };
          opt.executable = _file.javaPath();
          const downLoc = assetTag(lzma, obj.downloads.lzma.sha1);
          _file = downLoc.getFile(obj.downloads.lzma.sha1, name + ".xz");
          _file.mkdir();

          url = obj.downloads.lzma.url;
          chk = {
            size: obj.downloads.lzma.size,
            sha1: obj.downloads.lzma.sha1,
          };
        } else {
          url = obj.downloads.raw.url;
          chk = {
            size: obj.downloads.raw.size,
            sha1: obj.downloads.raw.sha1,
          };
        }
        arr.push(toDownloadable(_file, url, key, chk, opt));
        break;
      case "link":
        _file.mkdir();
        if (getOS() != "windows") {
          _file.rm();

          _file.linkTo(resolve(..._file.path, obj.target));
        }
    }
  });
  return download(arr);
}

/**Install a set version's assets based on a provided asset index from that version.
 * It is best to let GMLL handle this for you. See the version object instead.
 */
export async function assets(index: Artifact) {
  const root = getAssets();
  const indexes = root.getDir("indexes").mkdir();
  const file = indexes.getFile(index.id + ".json");
  const assetIndex = (
    await file.download(index.url, { sha1: index.sha1, size: index.size })
  ).toJSON<AssetIndex>();
  const downloader: DownloadableFile[] = [];
  const getURL = (obj: { hash: string; size: number }) =>
    assetURL + obj.hash.substring(0, 2) + "/" + obj.hash;

  if (assetIndex.map_to_resources) {
    const addIn = (
      path: string | number,
      sck: { hash: string; size: number },
    ) => {
      if (!assetIndex[path]) {
        assetIndex.objects[path] = sck;
      }
    };
    addIn("icons/icon_16x16.png", {
      hash: "bdf48ef6b5d0d23bbb02e17d04865216179f510a",
      size: 3665,
    });
    addIn("icons/icon_32x32.png", {
      hash: "92750c5f93c312ba9ab413d546f32190c56d6f1f",
      size: 5362,
    });
    addIn("icons/minecraft.icns", {
      hash: "991b421dfd401f115241601b2b373140a8d78572",
      size: 114786,
    });

    addIn("minecraft/icons/icon_16x16.png", {
      hash: "bdf48ef6b5d0d23bbb02e17d04865216179f510a",
      size: 3665,
    });
    addIn("minecraft/icons/icon_32x32.png", {
      hash: "92750c5f93c312ba9ab413d546f32190c56d6f1f",
      size: 5362,
    });
    addIn("minecraft/icons/minecraft.icns", {
      hash: "991b421dfd401f115241601b2b373140a8d78572",
      size: 114786,
    });
  }

  Object.entries(assetIndex.objects).forEach((o) => {
    const key = o[0];
    const obj = o[1];
    if (!obj.ignore)
      downloader.push(
        toDownloadable(
          assetTag(root.getDir("objects"), obj.hash).getFile(obj.hash),
          getURL(obj),
          key,
          { sha1: obj.hash, size: obj.size },
        ),
      );
  });
  await download(downloader);
  processAssets(assetIndex);
}
/**Installs the lib files from a set version */
export async function libraries(version: VersionJson) {
  const arr: Partial<DownloadableFile>[] = [];
  const natives = getNatives();
  natives.rm();
  natives.mkdir();

  const OS = getOS();
  const libraries = version.libraries;
  for (let key = 0; key < libraries.length; key++) {
    let finalDownload: File;
    const e = libraries[key];
    if (e.rules) {
      if (!lawyer(e.rules)) continue;
    }
    if (e.downloads) {
      if (
        e.downloads.classifiers &&
        e.natives &&
        e.natives[OS] &&
        e.downloads.classifiers[e.natives[OS]]
      ) {
        const art = e.downloads.classifiers[e.natives[OS]];
        const subDownload = getlibraries().getFile(art.path);
        arr.push(
          toDownloadable(
            subDownload,
            art.url,
            art.path,
            { sha1: art.sha1, size: art.size },
            {
              unzip: {
                file: natives,
                exclude: e.extract ? e.extract.exclude : undefined,
              },
            },
          ),
        );
      }

      if (e.downloads.artifact) {
        if (!e.downloads.artifact.path) {
          const namespec = e.name.split(":");
          const path =
            namespec[0].replace(/\./g, "/") +
            "/" +
            namespec[1] +
            "/" +
            namespec[2] +
            "/" +
            namespec[1] +
            "-" +
            namespec[2] +
            ".jar";
          e.downloads.artifact.path = path;
        }
        finalDownload = getlibraries().getFile(e.downloads.artifact.path);
        finalDownload.mkdir();
        arr.push(
          toDownloadable(
            finalDownload,
            e.downloads.artifact.url,
            e.downloads.artifact.path,
            {
              sha1: e.downloads.artifact.sha1,
              size: e.downloads.artifact.size,
            },
          ),
        );
      }
    } else {
      if (!e.url) e.url = "https://libraries.minecraft.net/";
      const path = classPathResolver(e.name);
      const file = getlibraries().getFile(path);
      let sha1: string | string[];

      //Maven repo
      for (let i = 0; i < 3; i++) {
        try {
          if (e.checksums) {
            sha1 = e.checksums;
          } else {
            const r = await nFetch(e.url + path + ".sha1");
            if (r.ok) sha1 = await r.text();
            else continue;
          }
          break;
        } catch (e) {
          console.error(getErr(e));
        }
      }
      arr.push(toDownloadable(file, e.url + path, path, { sha1: sha1 }));
    }
  }
  return await download(arr);
}
export async function getRuntimeIndexes(manifest: RuntimeManifest) {
  const runtimes = getMeta().runtimes.mkdir();
  let platform:
    | "gamecore"
    | "linux"
    | "linux-i386"
    | "mac-os"
    | "mac-os-arm64"
    | "windows-x64"
    | "windows-x86"
    | "linux-arm64"
    | "linux-arm32"
    | "windows-arm64";
  switch (getOS()) {
    case "windows":
      if (onUnsupportedArm && "windows-arm64" in manifest) {
        platform = "windows-arm64";
        console.warn(
          "[GMLL]: Loading intel fallback for Windows on arm. Please contact GMLL's developer if this bugs out.",
        );
        for (const key of Object.keys(manifest[platform]))
          if (manifest[platform][key].length < 1)
            manifest[platform][key] = manifest["windows-x86"][key];
        break;
      }
      platform = getCpuArch() == "x64" ? "windows-x64" : "windows-x86";
      break;
    case "linux":
      if (
        onUnsupportedArm &&
        ("linux-arm32" in manifest || "linux-arm64" in manifest)
      ) {
        platform = getCpuArch() == "arm" ? "linux-arm32" : "linux-arm64";
        break;
      }
      platform = getCpuArch() == "x64" ? "linux" : "linux-i386";
      break;

    case "osx":
      if (getCpuArch() == "arm64") {
        platform = "mac-os-arm64";
        //Intel fallback for m1
        console.warn(
          "[GMLL]: Loading intel fallback for M1. Please contact GMLL's developer if this bugs out.",
        );
        for (const key of Object.keys(manifest[platform]))
          if (manifest[platform][key].length < 1)
            manifest[platform][key] = manifest["mac-os"][key];
      } else {
        platform = "mac-os";
      }
      break;
    default:
      throw "Unsupported operating system";
  }
  for (const key of Object.keys(manifest[platform])) {
    if (manifest[platform][key].length < 1) continue;
    const obj = manifest[platform][key][0] as RuntimeManifestEntry;
    await runtimes
      .getFile(key + ".json")
      .download(obj.manifest.url, obj.manifest);
  }
}

export async function getForgiac() {
  const forgiacURL =
    getRepositories().maven + "za/net/hanro50/forgiac/basic/1.9/basic-1.9.jar";
  const forgiacSHA = forgiacURL + ".sha1";
  const libsFolder = getlibraries()
    .getDir("za", "net", "hanro50", "forgiac", "basic", "1.9")
    .mkdir()
    .getFile("basic-1.9.jar");
  const rURL2 = await fetch(forgiacSHA);
  if (rURL2.status == 200) {
    await libsFolder.download(forgiacURL, { sha1: await rURL2.text() });
  }

  return libsFolder;
}
/**
 * Updates GMLL's manifest files. Used internally
 *
 *
 */
export async function manifests() {
  const repositories = getRepositories();
  const legacyFabricLoader =
    "https://meta.legacyfabric.net/v2/versions/loader/";
  const legacyFabricVersions =
    "https://meta.legacyfabric.net/v2/versions/game/";

  const fabricLoader = "https://meta.fabricmc.net/v2/versions/loader/";
  const fabricVersions = "https://meta.fabricmc.net/v2/versions/game/";

  const quiltLoader = "https://meta.quiltmc.org/v3/versions/loader";
  const quiltVersions = "https://meta.quiltmc.org/v3/versions/game";

  const mcRuntimes =
    "https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json";
  const mcVersionManifest =
    "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";

  const armRuntimes = repositories.armFix + "index.json";
  const armPatch = repositories.armFix + "/arm-patch.json";

  const agentaURL =
    repositories.maven + "za/net/hanro50/agenta/1.6.2/agenta-1.6.2.jar";

  const update = getUpdateConfig();
  const meta = getMeta();
  interface JSLoaderInf {
    separator: string;
    build: number;
    maven: string;
    version: string;
    stable: boolean;
  }
  interface JSGameInf {
    version: string;
    stable: boolean;
  }
  if (onUnsupportedArm) {
    await meta.index.getFile("arm-patch.json").download(armPatch);
  }

  const r = await nFetch(mcVersionManifest);
  if (r.status == 200) {
    const json: VanillaManifestJson = await r.json();
    meta.index.getFile("latest.json").write(json.latest);
    meta.manifests.getFile("vanilla.json").write(json.versions);
  }

  if (update.includes("fabric")) {
    try {
      const jsGame = (
        await meta.index.getFile("fabric_game.json").download(fabricVersions)
      ).toJSON<[JSGameInf]>();
      const jsLoader = (
        await meta.index.getFile("fabric_loader.json").download(fabricLoader)
      ).toJSON<[JSLoaderInf]>();
      const result = [];
      jsGame.forEach((game) => {
        const version = game.version;
        jsLoader.forEach((l) => {
          result.push({
            id: "fabric-loader-" + l.version + "-" + version,
            base: version,
            stable: l.stable,
            type: "fabric",
            url: fabricLoader + version + "/" + l.version + "/profile/json",
          });
        });
      });
      meta.manifests.getFile("fabric.json").write(result);
    } catch (e) {
      console.error(getErr(e));
    }
  }
  if (update.includes("legacy-fabric")) {
    try {
      const jsGame = (
        await meta.index
          .getFile("legacy_fabric_game.json")
          .download(legacyFabricVersions)
      ).toJSON<[JSGameInf]>();
      const jsLoader = (
        await meta.index
          .getFile("legacy_fabric_loader.json")
          .download(legacyFabricLoader)
      ).toJSON<[JSLoaderInf]>();
      const result = [];
      jsGame.forEach((game) => {
        const version = game.version;
        jsLoader.forEach((l) => {
          result.push({
            id: "legacy-fabric-loader-" + l.version + "-" + version,
            base: version,
            stable: l.stable,
            type: "legacy-fabric",
            url:
              legacyFabricLoader + version + "/" + l.version + "/profile/json",
          });
        });
      });
      meta.manifests.getFile("legacy-fabric.json").write(result);
    } catch (e) {
      console.error(getErr(e));
    }
  }
  if (update.includes("quilt")) {
    try {
      const jsGame = (
        await meta.index.getFile("quilt_game.json").download(quiltVersions)
      ).toJSON<[JSGameInf]>();
      const jsLoader = (
        await meta.index.getFile("quilt_loader.json").download(quiltLoader)
      ).toJSON<[JSLoaderInf]>();
      const result = [];
      jsGame.forEach((game) => {
        const version = game.version;
        jsLoader.forEach((l) => {
          result.push({
            id: "quilt-loader-" + l.version + "-" + version,
            base: version,
            stable: l.stable,
            type: "quilt",
            url:
              quiltLoader + "/" + version + "/" + l.version + "/profile/json",
          });
        });
      });
      meta.manifests.getFile("quilt.json").write(result);
    } catch (e) {
      console.error(getErr(e));
    }
  }
  if (update.includes("runtime")) {
    let indexes = (
      await meta.index.getFile("runtime.json").download(mcRuntimes)
    ).toJSON<RuntimeManifest>();
    if (onUnsupportedArm) {
      indexes = combine(
        indexes,
        (
          await meta.index.getFile("runtime-Arm.json").download(armRuntimes)
        ).toJSON<RuntimeManifest>(),
      );
    }
    getRuntimeIndexes(indexes);
  }
  if (update.includes("agent")) {
    let sha1;
    try {
      const r = await nFetch(agentaURL + ".sha1");
      sha1 = await r.text();
      await getAgentFile().download(agentaURL, { sha1 });
    } catch (e) {
      /* empty */
    }
  }
  const arch = getCpuArch();
  if (["arm", "arm64", "x32", "x64"].includes(arch))
    await download7zip({
      dir: meta.bin,
      arch: arch as "arm" | "arm64" | "x32" | "x64",
      z7Repo: repositories.z7Repo,
    });
  else
    await download7zip({
      dir: meta.bin,
      arch: getOS() != "osx" ? "x32" : "x64",
      z7Repo: repositories.z7Repo,
    });
}
export function getAgentFile() {
  return getlibraries()
    .getDir("za", "net", "hanro50", "agenta", "1.6.1")
    .mkdir()
    .getFile("agenta-1.6.1.jar");
}
/**
 * Used for runtime management.
 * Short for encode Mojang Resource Format
 *
 */
export async function encodeMRF(url: string, root: Dir, out: Dir) {
  const res: MojangResourceManifest = { files: {} };
  const packed = out.getDir("encoded").mkdir();
  console.log("[GMLL]: Starting to encode as Mojang resource file");
  let tFiles = 0;
  let cFiles = 0;
  emit("encode.start");
  async function encodeDir(path: string, root: Dir) {
    const ls = root
      .ls()
      .sort((a, b) => a.sysPath().length - b.sysPath().length);
    tFiles += ls.length;
    for (let index = 0; index < ls.length; index++) {
      const e = ls[index];
      const directory = [path, e.getName()].join("/");
      cFiles++;
      emit("encode.progress", directory, cFiles, tFiles, tFiles - cFiles);
      if (e.isLink()) {
        res.files[directory] = {
          type: "link",
          target: readlinkSync(e.sysPath()),
        };
        continue;
      } else if (e instanceof File) {
        const rHash = e.getHash();
        e.copyTo(packed.getFile(rHash, e.name).mkdir());
        let zip = out.getFile("tmp", e.name + ".7z").mkdir();
        await packAsync(e.sysPath(), zip.sysPath());
        const zHash = zip.getHash();
        const downloadable: MojangResourceFile = {
          type: "file",
          executable: await e.isExecutable(),
          downloads: {
            raw: {
              sha1: rHash,
              size: e.getSize(),
              url: [url, rHash, e.name].join("/"),
            },
          },
        };
        if (zip.getSize() < e.getSize()) {
          zip = zip.moveTo(packed.getFile(zHash, e.name).mkdir());
          downloadable.downloads.lzma = {
            sha1: zHash,
            size: zip.getSize(),
            url: [url, zHash, e.name].join("/"),
          };
        } else {
          zip.rm();
        }
        res.files[directory] = downloadable;
        continue;
      } else if (e instanceof Dir) {
        res.files[directory] = {
          type: "directory",
        };
        await encodeDir(directory, e);
        continue;
      }
    }
  }
  await encodeDir("", root);
  const manifest = out.getFile(root.getName() + "_manifest.json");
  manifest.write(res);

  const mHash = manifest.getHash();
  manifest.copyTo(packed.getFile(mHash, "manifest.json").mkdir());
  const index = out.getFile(root.getName() + "_index.json");
  index.write({
    sha1: mHash,
    size: manifest.getSize(),
    url: [url, mHash, "manifest.json"].join("/"),
  });
  emit("encode.done");
  out.getDir("tmp").rm();
  return res;
}
