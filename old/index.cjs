/**A CommonJS wrapper for the ES6 Module */

module.exports.setConfig = async (conf) => {
    const _config = await import("./modules/main/config.js");
    return await _config.setConfig(conf)
}
module.exports.init = async () => {
    const mod = await import("./modules/init.js");
    return mod;
}

