//Just a stub for backwards compatiblity
export { Dir, File, WrappedObj, packAsync, jsonEncode } from "gfsl";

console.warn(
  "[GMLL:system]: The file system library has been moved into it's own module. Please use 'gfsl' from now on!",
);
console.trace();
