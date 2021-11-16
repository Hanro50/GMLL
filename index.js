
import * as _config from "./modules/config.js";
import * as  _forge from "./modules/forge.js";
import * as  _handler from "./modules/handler.js"
import _profile from "./modules/instance.js";


/**
 * First time setup. 
 */
export async function setup() {
    let chron = new _profile().getChronicle();
    await chron.setup();
    await _forge.build();
}

export function getChronicle(version) {
    _handler.getChronicle(version);
}

export const instance = {
    make(opt) { return new _profile(opt) },
    get(name) { return _profile.get(name) }
}

/**
 * Forge installer:
 * Uses Forgiac to install forge from an installation file. 
 * If no file is provided then the user will be prompted for it
 * @param {String | String[] | null} file
 * @returns {Promise<void>}
 */
export function installForge(File){
    return _forge.install(File)
}
/**
 * 
 * @returns 
 */
export function getVersions(){
    return _config.getVersions();
}

export function setConfig(conf){
    return _config.setConfig(conf)
}