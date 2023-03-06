/**
 * ---------------------------------------------------------------------------------------------
 * INDEX 
 * ---------------------------------------------------------------------------------------------
 */
import { initialize } from "./modules/config.js";
/**Does a range of required preflight checks. Will cause errors if ignored!*/
export async function init() { await initialize() }
/**The core config class. Used to change the locations of files and to get the location of files as well! */
export * as config from './modules/config.js';
/**The main download manager in GMLL. */
export * as downloader from './modules/downloader.js';
/**Stuff related to the version and manifest files. Used to install forge, get a complete list of manifest files and so much more! */
export * as handler from "./modules/handler.js";
/**Integration with other libs */
export * as wrapper from "./modules/wrapper.js";
/**Provides access to GMLL's file handler */
export * as files from "./modules/objects/files.js"
/**Provides access to the nbt data reader in gmll */
export * as nbt from "./modules/nbt.js"

import instance from "./modules/objects/instance.js";

import type types from "./types";
export { instance, types } 
