module.exports.getPath = () => {
    try {
        return require.resolve("./get.js");
    } catch { }
    return "NOT FOUND!";
}