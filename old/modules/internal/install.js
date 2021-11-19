console.log("[GMLL]: Generating files...")
import { getChronicle } from "../handler.js";
import { getLatest } from "../config";
await getChronicle(getLatest().release).setup();