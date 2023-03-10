/**Here for future reference if we decide to become an ES6 only Module*/
export function getPath() {
    try {
        //return import.meta.resolve("./get.js");
        return require.resolve("./get.js");
    } catch (e) {
        console.warn("[GMLL]: Failed to determine module location!");
        console.trace(e);
        return "Unknown_Path"
    }
}