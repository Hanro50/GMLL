import { installForge, instance } from "./dist/modules/instance.js";
import { getSelf } from "./dist/modules/internal/get.js";
console.log(getSelf())

getSelf();
new instance({version:"1.12.2-forge-14.23.5.2855"}).launch({name:"Hanro50"})
