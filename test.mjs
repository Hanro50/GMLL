import   instance  from "./dist/modules/objects/instance.js";
import { getSelf } from "./dist/modules/internal/get.js";
import { initialize } from "./dist/modules/config.js";

await initialize();

getSelf();
new instance({version:"1.18"}).launch({name:"Hanro50"})
