console.log("[GMLL]: Generating files...")
import { getVersion } from "../handler.js";
import { getLatest } from "../config";
await getVersion(getLatest().release).setup();