import * as _config from "./modules/config.js";
export function setConfig(conf){
    return _config.setConfig(conf)
}
export async function init(){
    const mod = await import("./modules/init.js");
    return mod; 
}

