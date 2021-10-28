
const c = require("./modules/handler");
const fs = require("fs");
const p = require("path")
const handler = require("./modules/handler")
async function loadme() {
    handler.update();
}
loadme();

module.exports = {
    reload: loadme
}
