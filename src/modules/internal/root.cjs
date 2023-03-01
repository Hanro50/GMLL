/**Here for future reference if we decide to become an ES6 only Module*/
module.exports.getPath = () => {
    try {
        return require.resolve("./get.js");
    } catch (e) {
        console.warn("[GMLL]: Failed to determine module location!");
        console.trace(e);
        return "Unknown_Path"
    }
}

module.exports.agentPath = () => {
    const T = this.getPath();
    return T.substring(0, T.length - "get.js".length) + "agent.jar";
}
