import { copyFileSync } from "fs";
import { Dir, File } from "gfsl";
import { join } from "path";
import {
  Artifact,
  MCJarTypeVal,
  VersionJson,
  VersionManifest,
} from "../../types";
import { emit, getVersions, getlibraries, isInitialized } from "../config.js";
import { assets, libraries, runtime } from "../downloader.js";
import { getJavaPath, getManifest } from "../handler.js";
import {
  classPackageResolver,
  classPathResolver,
  combine,
  getOS,
  lawyer,
  throwErr,
} from "../internal/util.js";

/**
 * Version data is unique. Each version of the game will generate an unique version object.
 * Take note however. GMLL,unlike the default launcher, will store version data in the same folder as the version it is based upon.
 * If forge still works, but you cannot find the file connected to it...this is why.
 */
export default class Version {
  json: VersionJson;
  manifest: VersionManifest;
  name: string;
  folder: Dir;
  file: File;
  synced: boolean;
  override?: Artifact;
  private pre1d9: boolean;
  private _mergeFailure: boolean;
  /**Gets a set version based on a given manifest or version string. Either do not have to be contained within the manifest database. */
  static async get(manifest: string | VersionManifest): Promise<Version> {
    isInitialized();
    const v = new this(manifest);
    await v.getJSON();
    return v;
  }
  /**
   *  DO NOT USE CONSTRUCTOR DIRECTLY. FOR INTERNAL USE ONLY!
   * @see {@link get} : This is the method that should instead be used
   */
  private constructor(manifest: string | VersionManifest) {
    this.manifest =
      typeof manifest == "string" ? getManifest(manifest) : manifest;
    this.pre1d9 =
      Date.parse(this.manifest.releaseTime) <
      Date.parse("2022-05-12T15:36:11+00:00");
    this.json;
    this.name = this.manifest.base || this.manifest.id;
    this.folder = getVersions().getDir(this.name);
    this.file = this.folder.getFile(this.manifest.id + ".json");
    this.synced = true;
    this.folder.mkdir();
  }
  mergeFailure() {
    return this._mergeFailure;
  }
  /**
   * @returns Gets the version json file.
   * @see {@link json} for synchronous way to access this. The {@link get} method already calls this function and saves it accordingly.
   */
  async getJSON(): Promise<VersionJson> {
    const folder_old = getVersions().getDir(this.manifest.id);
    const file_old = folder_old.getFile(this.manifest.id + ".json");
    if (this.json && !this._mergeFailure) return this.json;
    this._mergeFailure = false;
    if (
      this.file.sysPath() != file_old.sysPath() &&
      !this.file.exists() &&
      file_old.exists()
    ) {
      emit("debug.info", "Cleaning up versions!");
      this.json = file_old.toJSON<VersionJson>();
      this.synced = !("synced" in this.json) || this.json.synced;
      if (this.synced) {
        copyFileSync(file_old.sysPath(), this.file.sysPath());
        folder_old.rm();
      } else {
        try {
          emit(
            "debug.info",
            "Detected synced is false. Aborting sync attempted",
          );
          const base = new Version(
            this.json.inheritsFrom || this.manifest.base,
          );
          this.json = combine(await base.getJSON(), this.json);
          this.name = this.json.id;
          this.folder = folder_old;
          this.file = file_old;
        } catch (e) {
          emit("debug.warn", "[GMLL]: Dependency merge failed.");
          this._mergeFailure = true;
        }

        return this.json;
      }
    }
    if (this.manifest.url) {
      this.json = (
        await this.folder
          .getFile(this.manifest.id + ".json")
          .download(this.manifest.url, { sha1: this.manifest.sha1 })
      ).toJSON();
    } else if (this.file.exists()) {
      this.json = this.file.toJSON();
    } else {
      throwErr(
        this.manifest.type == "unknown"
          ? "Unknown version, please check spelling of given version ID"
          : "Version json is missing for this version!",
      );
    }
    if (this.json.inheritsFrom || this.manifest.base) {
      try {
        const base = new Version(this.json.inheritsFrom || this.manifest.base);
        this.json = combine(await base.getJSON(), this.json);
        this.folder = base.folder;
        this.name = base.name;
      } catch (e) {
        emit("debug.warn", "[GMLL]: Dependency merge failed.");
        this._mergeFailure = true;
      }
    }

    return this.json;
  }
  /**
   * Installs the asset files for a set version
   */
  async getAssets() {
    if (!this.json.assetIndex) {
      const base = await new Version("1.0").getJSON();
      this.json.assetIndex = base.assetIndex;
    }
    await assets(this.json.assetIndex);
  }
  async getRuntime() {
    const jre = this.json.javaVersion
      ? this.json.javaVersion.component
      : "jre-legacy";
    await runtime(jre);
    return jre;
  }
  async getLibs() {
    await libraries(this.json);
  }
  async getJar(type: MCJarTypeVal, jarFile: File) {
    if (this.synced && "downloads" in this.json) {
      const download = this.json.downloads[type];
      if (!jarFile.sha1(download.sha1) || !jarFile.size(download.size)) {
        return await jarFile.download(download.url);
      }
    }
  }
  getJarPath() {
    return this.folder.getFile(this.name + ".jar");
  }
  async install() {
    if (this._mergeFailure) {
      this._mergeFailure = false;
      emit("debug.info", "Correcting earlier dependency merge failure.");
      delete this.json;
      this.json = await this.getJSON();
    }
    await this.getAssets();
    await this.getLibs();
    await this.getJar("client", this.folder.getFile(this.name + ".jar"));
    await this.getRuntime();
  }
  getJavaPath() {
    return getJavaPath(
      this.json.javaVersion ? this.json.javaVersion.component : "jre-legacy",
    );
  }
  getClassPath(mode: "client" | "server" = "client", jarpath?: File) {
    const cp: string[] = [];
    const loadedPackages = [];
    this.json.libraries.forEach((lib) => {
      if (mode == "client" && "clientreq" in lib && !lib.clientreq) return;
      if (mode == "server" && !lib.serverreq && "clientreq" in lib) return;
      if (lib.rules && !lawyer(lib.rules)) return;

      /**Neoforge for 1.21.5 broke this since it tried to load a newer version of asm then the one bundled with MC */
      const packageName = lib.natives
        ? classPackageResolver(lib.name, lib.natives[getOS()])
        : classPackageResolver(lib.name);

      if (loadedPackages.includes(packageName)) {
        emit("debug.error", `${packageName} is already included! Ignoring`);
        return;
      }
      loadedPackages.push(packageName);

      const p = (
        lib.natives
          ? join(
              "libraries",
              ...classPathResolver(lib.name, lib.natives[getOS()]).split("/"),
            )
          : join("libraries", ...classPathResolver(lib.name).split("/"))
      ).replaceAll("@jar", "");

      const p2 = getlibraries().getDir("..").getFile(p);

      if (!p2.exists()) {
        emit(
          "debug.error",
          `${p} does not exist. Removing to avoid possible error (${p2.sysPath()})`,
        );
        return;
      }

      const p3 = p2.sysPath();
      if (!cp.includes(p3)) cp.push(p3);
    });

    const jar = jarpath || this.folder.getFile(this.name + ".jar");
    if (jar.exists()) cp.push(jar.sysPath());

    return cp;
  }
}
