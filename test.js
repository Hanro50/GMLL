import * as GMLL from "./index.js";

GMLL.setConfig({})
await GMLL.init();

GMLL.instance.make({"version":"1.0"}).launch({})