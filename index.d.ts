import "./@types/main"
import "./@types/config"
import "./@types/instance"
import "./@types/manifests"
import "./@types/version"

/**
 * Will run a first time setup. Can be used by installers to insure the game will be ready to launch asap. 
 */
export function setup(): Promise<void>;

/**
 * A chronicle represents the data for a set version. This includes it's launch json for example
 * @param version The version name in string
 */
export function getChronicle(version: string): GMLL.version.chronicle;

/**
 * Instances are how you manage installations of minecraft. 
 */
export const instance : {
    make: (opt: GMLL.instance.options) => GMLL.instance.instance,
    get: (name: string) => GMLL.instance.instance
}

/**
 * Forge installer:
 * Uses Forgiac to install forge from an installation file. 
 * If no file is provided then the user will be prompted for it
 */
export function installForge(File: String | String[] | null): Promise<void>
/**
 * Get a list of available versions
 * @returns 
 */
export function getVersions(): Array<GMLL.manifests.version>

/**
 *  SHOULD ONLY BE RAN ONCE BEfORE EVERYTHING ELSE!
 * 
 * Sets the config files this module should use
 */
export function setConfig(conf:GMLL.config.opt):Promise<void>;