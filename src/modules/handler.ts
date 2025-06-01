/**The internal java and version manifest handler for GMLL */

import { spawn } from "child_process";
import { File } from "gfsl";
import fetch from "node-fetch";
import type {
  ForgeVersion,
  MCRuntimeVal,
  VersionJson,
  VersionManifest,
} from "../types";
import {
  emit,
  getInstances,
  getlibraries,
  getMeta,
  getRuntimes,
  getVersions,
  isInitialized,
} from "./config.js";
import { getForgiac, runtime } from "./downloader.js";
import { getOS } from "./internal/util.js";

export function getManifests(): VersionManifest[] {
  isInitialized();
  const versionManifest = [];
  const root = getMeta().manifests;
  root.ls().forEach((e) => {
    if (e.sysPath().endsWith("json") && e instanceof File) {
      const v = e.toJSON<VersionManifest | VersionManifest[]>();
      if (v instanceof Array) versionManifest.push(...v);
      else versionManifest.push(v);
    }
  });
  return versionManifest;
}

const forgiacCodes = {
  100: "Could not create virtual folder",
  101: "Could not create junction link",
  102: "Please use Windows Vista or later",
  200: "User cancelled request",
  201: "Invalid installation jar",
  202: "Forge failed to install",
  300: "Parameter error",
};

function findManifest(version: string, manifests: VersionManifest[]) {
  const v = version.toLocaleLowerCase().trim();
  let manifest = manifests.find((e) => {
    try {
      return e.id.toLocaleLowerCase().trim() == v;
    } catch {
      return false;
    }
  }); //|| { id: version, type: "unknown" };
  if (!manifest) {
    emit("debug.warn", "attempting to generate manifest files");
    const root = getMeta().manifests;
    const versionJson = getVersions().getFile(version, `${version}.json`);
    if (versionJson.exists()) {
      let f = root.getFile(`${version}.json`);
      let i = 1;
      while (f.exists()) f = root.getFile(`${version}_${i++}.json`);
      try {
        const vj = versionJson.toJSON<Partial<VersionJson>>();
        let base = vj.inheritsFrom;
        if (base) {
          const baseManifest = findManifest(base, manifests);
          base = baseManifest.base || baseManifest.id;
        }
        const mf: VersionManifest = {
          id: vj.id || versionJson.name.split(".")[0],
          base: base,
          releaseTime: vj.releaseTime,
          time: vj.time,
          type: vj.type || "generated",
        };
        f.write(mf);
      } catch (e) {
        emit("debug.error", "failed to compile manifest from version json");
      }
    } else {
      emit(
        "debug.warn",
        `no version json (at ${versionJson.sysPath()}) found, I hope you know what you are doing!`,
      );
    }
    manifest = { id: version, type: "unknown" };
  }

  if (manifest.base) {
    const man2 = findManifest(manifest.base, manifests);
    manifest.releaseTime = man2.releaseTime;
    manifest.time = man2.time;
    manifest.complianceLevel = man2.complianceLevel;
  }
  return manifest;
}
const spTag = ["latest", "latest:release", "latest:snapshot"];
/**Gets a specific version manifest based on the version ID provided
 * @param version the version ID
 * @returns a version manifest. It will be of type "unknown" if the specific manifest is not in the manifest database.
 */
export function getManifest(version: string) {
  if (spTag.includes(version)) {
    const lt = getLatest();
    switch (version) {
      case "latest:snapshot":
        version = lt.snapshot;
        break;
      case "latest:release":
      case "latest":
        version = lt.release;
        break;
    }
  }
  isInitialized();
  const manifests = getManifests();
  return findManifest(version, manifests);
}

/**Gets the latest release and snapshot builds.*/
export function getLatest(): { release: string; snapshot: string } {
  isInitialized();
  const file = getMeta().index.getFile("latest.json");
  if (file.exists()) return file.toJSON();
  else return { release: "1.17.1", snapshot: "21w42a" };
}

export async function installForge(
  forgeInstaller: string | File | ForgeVersion,
  forgiacArgs: string[] = ["--virtual", getVersions().sysPath()],
) {
  if (forgeInstaller instanceof Object && !(forgeInstaller instanceof File)) {
    const { type, forge, game } = forgeInstaller;
    if (type == "modern") {
      return await installModernForge(forge);
    }
    const id = "forge-" + forge;
    const manifest: VersionManifest = {
      id: "forge-" + forge,
      type: "forge",
      base: game,
    };
    getMeta()
      .manifests.getFile(id + ".json")
      .write(manifest);
    const jarname =
      type == "ancient"
        ? `forge-${forge}-client.zip`
        : `forge-${forge}-universal.zip`;
    const shaRequest = await fetch(
      `https://maven.minecraftforge.net/net/minecraftforge/forge/${forge}/${jarname}.sha1`,
    );
    let sha1;
    if (shaRequest.status == 200) sha1 = await shaRequest.text();
    const versionJson: Partial<VersionJson> = {
      id: id,
      inheritsFrom: game,
      jarmods: [
        {
          sha1,
          url: `https://maven.minecraftforge.net/net/minecraftforge/forge/${forge}/${jarname}`,
          id: `forge-${forge}`,
          path: `forge-${forge}.jar`,
        },
      ],
      type: "forge",
    };
    getVersions()
      .getDir(game)
      .mkdir()
      .getFile(id + ".json")
      .write(versionJson);

    return manifest;
  }

  const path = getInstances().getDir(".forgiac");
  const manifest = path.getDir(".manifest_" + Date.now()).mkdir();
  if (typeof forgeInstaller == "string")
    forgeInstaller = new File(forgeInstaller);
  const fRun: MCRuntimeVal = "java-runtime-delta";
  await runtime(fRun);

  const javaPath = getJavaPath(fRun);
  const logFile = path.getFile("log.txt");
  const args: string[] = [
    "-jar",
    (await getForgiac()).sysPath(),
    " --log",
    logFile.sysPath(),
    ...forgiacArgs,
    getlibraries().sysPath(),
    "--mk_manifest",
    manifest.sysPath(),
  ];
  if (forgeInstaller) {
    args.push("--installer", forgeInstaller.sysPath());
  }
  path.mkdir();
  emit("jvm.start", "Forgiac", path.sysPath());
  const s = spawn(javaPath.sysPath(), args, { cwd: path.sysPath() });
  s.stdout.on("data", (chunk) => emit("jvm.stdout", "Forgiac", chunk));
  s.stderr.on("data", (chunk) => emit("jvm.stderr", "Forgiac", chunk));
  const err = (await new Promise((e) => s.on("exit", e))) as number;
  if (err != 0) {
    throw {
      Error: "forge.install.failure",
      code: err,
      message: forgiacCodes[err] || "unknown error",
    };
  }

  const forgeManifest = manifest.ls();
  if (forgeManifest.length < 1) {
    throw {
      Error: "manifest.not.found",
      code: 400,
      message: "Manifest file not found?",
    };
  }
  const manifestFile = forgeManifest[0];
  if (!(manifestFile instanceof File)) {
    throw {
      Error: "manifest.is.folder",
      code: 401,
      message: "Manifest file is a directory?",
    };
  }
  const result = manifestFile.toJSON<VersionManifest>();
  manifestFile.moveTo(getMeta().manifests.getFile(manifestFile.getName()));
  manifest.rm();
  return result;
}

/**
 * Gets the path to an installed version of Java. GMLL manages these versions and they're not provided by the system.
 * @param java the name of the Java runtime. Based on the names Mojang gave them.
 * @returns The location of the have executable.
 */
export function getJavaPath(java: MCRuntimeVal = "jre-legacy") {
  if (getOS() == "osx") {
    return getRuntimes().getFile(
      java,
      "jre.bundle",
      "Contents",
      "Home",
      "bin",
      "java",
    );
  }
  if (getOS() == "windows") {
    const f = getRuntimes().getFile(java, "bin", "javaw.exe");
    return f.exists() ? f : getRuntimes().getFile(java, "bin", "java.exe");
  }
  return getRuntimes().getFile(java, "bin", "java");
}

/**Used to parse forge versions for the installer functions */
function parseForge(forges: string[], mc: string) {
  const ancient = ["1.1", "1.2.3", "1.2.4", "1.2.5"];
  const old = [
    "1.3.2",
    "1.4.0",
    "1.4.1",
    "1.4.2",
    "1.4.3",
    "1.4.5",
    "1.4.6",
    "1.4.7",
    "1.5",
    "1.5.1",
    "1.5.2",
  ];

  let type: "ancient" | "old" | "modern";

  if (ancient.includes(mc)) type = "ancient";
  else if (old.includes(mc)) type = "old";
  else type = "modern";

  return forges.map((forge) => {
    return {
      type,
      forge,
      game: mc,
      install: () => installForge({ type, forge, game: mc }),
    };
  });
}

/**
 * The auto forge installer.
 * To stop forge from breaking this,
 * please add a link to donate to the forge project at https://www.patreon.com/LexManos
 *
 * I am not affiliated with forge in any way, I just want to support them. So they can keep making forge...and so they don't break this.
 * - Hanro50
 *
 * @Warning They may break this at any time. I will try to keep this up to date, but I can't guarantee anything. So...yeah. Add a link to donate to them.
 */

export async function getForgeVersions(): Promise<
  Record<string, (ForgeVersion & { install: () => Promise<VersionManifest> })[]>
>;
export async function getForgeVersions(
  version: string,
): Promise<[ForgeVersion & { install: () => Promise<VersionManifest> }]>;
export async function getForgeVersions(version?: string) {
  const data = await fetch(
    "https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json",
  );

  const json = (await data.json()) as { [key: string]: Array<string> };

  if (version) return parseForge(json[version], version);

  const results: Record<
    string,
    (ForgeVersion & { install: () => Promise<VersionManifest> })[]
  > = {};

  Object.entries(json).forEach((o) => {
    const mc = o[0];
    const forges = o[1];

    results[mc] = parseForge(forges, mc);
  });
  console.log(
    "[GMLL]: Please support the forge project by donating at https://www.patreon.com/LexManos",
  );
  return results;
}
export async function installModernForge(version: string) {
  const path = getMeta().scratch.getDir("forge").mkdir();
  const url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}/forge-${version}-installer.jar`;
  const installer = await path.getFile(version + ".jar").download(url);
  return await installForge(installer);
}

export async function installNeoForge(version: string) {
  const path = getMeta().scratch.getDir("neo-forge").mkdir();
  const url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version}/neoforge-${version}-installer.jar`;
  const installer = await path.getFile(version + ".jar").download(url);
  return await installForge(installer);
}

/**The auto neoforge installer.*/
export async function getNeoForgeVersions(version?: string) {
  let data: fetch.Response;
  if (version?.startsWith("1.")) {
    version = version.substring(2);
    data = await fetch(
      "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge?filter=" +
        version,
    );
  } else {
    data = await fetch(
      "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge",
    );
  }

  const json = (await data.json()) as { [key: string]: Array<string> };

  return json.versions.map((neoforge) => {
    return {
      version: neoforge,
      install: () => installNeoForge(neoforge),
    };
  });
}
