/*
import { join } from "path";
import { randomUUID } from "crypto";
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { load } from "./modloaders.js";
export function getSessionID() { return sessionID; }
export const disable = {
    fabric = () => {
        config.fabric = "false";
        saveConfig();
    }
};



var initialized = false;
var sessionID = randomUUID();


export function setRoot(datafolder) {
    try {
        if (existsSync(this.launcherFiles.config))
            config = JSON.parse(readFileSync(this.launcherFiles.config));
        else
            saveMe();

    } catch (e) {
        console.log(e);
    };
    config.save = saveMe;
    if (initialized) this.initialize();
    sessionID = randomUUID();


    const saveMe = () => writeFileSync(this.launcherFiles.config, JSON.stringify(config));

}

export function getConfig() { return config };

export function chkFiles() {
    if (!existsSync(this.files.minecraft)) {
        mkdirSync(this.files.minecraft);
    }
    Object.values(this.files).forEach(e => {
        if (!existsSync(e)) {
            mkdirSync(e);
        }
    })
    if (!existsSync(this.launcherFiles.patch)) {
        mkdirSync(this.launcherFiles.patch);
    }
}


/**
 * @type {{files:{[minecraft,instances:
        assets: join(datafolder, "assets"),
        versions: join(datafolder, "versions"),
        natives: join(datafolder, "natives"),
        launcher: join(datafolder, "launcher"),
        runtimes: join(datafolder, "runtimes"),
        libraries}}}
 */






/*


export async function getConfig() {
    if (!config) {
        console.log("[GMLL]: Loading default config");
        this.setConfig();
    }
    this.setRoot(join(process.cwd(), ".minecraft"));
    if (initialized) console.log("[GMLL]: The library is already loaded, calling this method again may cause unforseen errors. Forcing reinitialisation");
    initialized = true;
    this.chkFiles();
    load();
    const config = this.get()
    if (sessionID == getConfig().sessionID && config.sessionExp > Date.now()) return;
    config.sessionExp = Date.now() + 3600000; config.sessionID = sessionID; config.save();

}
*/