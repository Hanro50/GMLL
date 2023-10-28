/* eslint-disable no-undef */
module.exports.getPath = () => {
  try {
    return require.resolve("./get.js");
  } catch {
    /* empty */
  }
  return "NOT FOUND!";
};
