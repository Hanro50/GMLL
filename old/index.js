import * as _config from "./modules/main/config.js";
export async function setConfig(conf){
    return await _config.setConfig(conf)
}
/**
 * 
 */
export async function init(){
    const mod = await import("./modules/init.js");
    return mod; 
}

