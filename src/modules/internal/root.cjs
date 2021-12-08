/**
 * There is no constant way to do this. 
 * Doing it with commonJS is the most universal way to pull this off! */
const path = require("path")
let packagePath = path.dirname(require.resolve("./root.cjs"));
module.exports = packagePath;