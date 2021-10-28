const p = require("path");
const config = { "fabric": "true" };
const fs = require('fs');


module.exports.setRoot = (datafolder) => {
    module.exports.files = {
        minecraft: datafolder,
        instances: p.join(datafolder, "instances"),
        assets: p.join(datafolder, "assets"),
        versions: p.join(datafolder, "versions"),
        natives: p.join(datafolder, "natives"),
        launcher: p.join(datafolder, "launcher"),
        runtimes: p.join(datafolder, "runtimes"),
        libraries: p.join(datafolder, "libraries")
    };

    module.exports.launcherFiles = {
        versions: p.join(this.files.launcher, "versions.json"),
        latest: p.join(this.files.launcher, "latest.json"),
        patch: p.join(this.files.launcher, "patch"),
        config: p.join(this.files.launcher, "config.json")
    };

    try {
        if (fs.existsSync(this.launcherFiles.config)) {
            config = require(this.launcherFiles.config);
        }
    } catch { };
    module.exports.config = config;
}

module.exports.chkFiles = () => {
    if (!fs.existsSync(this.files.minecraft)) {
        fs.mkdirSync(this.files.minecraft);
    }
    Object.values(this.files).forEach(e => {
        if (!fs.existsSync(e)) {
            fs.mkdirSync(e);
        }
    })
    if (!fs.existsSync(this.launcherFiles.patch)) {
        fs.mkdirSync(this.launcherFiles.patch);
    }
    fs.writeFileSync(this.launcherFiles.config, JSON.stringify(config))
}
this.setRoot(p.join(process.cwd(), ".minecraft"));

const EventEmitter = require('events');

const defEvents = new EventEmitter()

//Download Manager
defEvents.on('download.setup', (cores) => console.log("[GMLL]: Dividing out work to " + cores + " cores"))
defEvents.on('download.start', () => console.log("[GMLL]: Starting download"))
defEvents.on('download.restart', () => console.error("[GMLL]: It is taking to long to get update, assuming crash"))
defEvents.on('download.progress', (key, index, total, left) => console.log("[GMLL]: Done with " + index + " of " + total + " : " + left + " : " + key))
defEvents.on('download.done', () => console.log("[GMLL]: Done with download"))
defEvents.on('download.fail', (key, type, err) => {
    switch (type) {
        case ("retry"): console.log("[GMLL]: Trying to download " + key + " again"); break;
        case ("fail"): console.log("[GMLL]: Failed to download " + key); break;
        case ("system"): console.log("[GMLL]: Failed to download " + key + " due to an error"); console.trace(err); break;
    }
})

module.exports.eventManager = defEvents;