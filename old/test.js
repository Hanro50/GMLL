import * as GMLL from "./index.js";

GMLL.setConfig({})
const gm = await GMLL.init();
gm.instance.make({"version":"1.0"}).launch({})