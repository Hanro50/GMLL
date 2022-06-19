/**Here for future reference if we decide to become an ES6 only Module*/
module.exports.getPath = (mod) => {
    try {
        return require.resolve(mod);
    } catch (e) {
        console.warn("[GMLL]: Failed to determine module location!");
        console.trace(e);
        return "Unknown_Path"
    }
}