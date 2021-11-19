
import * as _config from "./main/config.js";
import * as  _forge from "./main/forge.js";
import * as  _handler from "./main/handler.js"
import _profile from "./main/instance.js";
import { fsSanitiser } from "./internal/util.js";
import { join } from "path";
import { writeFile } from "fs";
const conf = await _config.getConfig();
/**
 * First time setup. 
 */
export async function setup() {
    let prof = new _profile({ name: "default" });
    let chron = prof.getChronicle();
    await chron.setup();
    prof.save();
    await _forge.build();
}

export function getChronicle(version) {
    _handler.getChronicle(version);
}

export const instance = {
    make(opt) { return new _profile(opt) },
    get(name = "default") { return _profile.get(name) }
}

/**
 * Forge installer:
 * Uses Forgiac to install forge from an installation file. 
 * If no file is provided then the user will be prompted for it
 * @param {String | String[] | null} file
 * @returns {Promise<void>}
 */
export function installForge(File) {
    return _forge.install(File)
}
/**
 * 
 * @returns 
 */
export function getVersions() {
    return _config.getVersions();
}

export function writeManifest(manifests, fileID) {
   const file =  join(conf.metaFiles.manifest.folder, fsSanitiser(fileID) + ".json");
   writeFile(file,JSON.stringify(manifests))
}