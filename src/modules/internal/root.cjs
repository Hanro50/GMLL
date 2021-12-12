/**
 * There is no constant way to do this. 
 * Doing it with commonJS is the most universal way to pull this off! */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");
let packagePath = path.dirname(require.resolve("./root.cjs"));
module.exports = packagePath;