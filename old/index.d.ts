import "./@types/main"
import "./@types/config"
import "./@types/instance"
import "./@types/manifests"
import "./@types/version"

/**
 *  SHOULD ONLY BE RAN ONCE BEfORE EVERYTHING ELSE!
 * 
 * Sets the config files this module should use
 */
export function setConfig(conf: GMLL.config.opt): Promise<void>;


export function init():Promise<GMLL.init>;