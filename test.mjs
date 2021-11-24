import { URL } from "url";
import { instance } from "./dist/modules/instance.js";
import { getSelf } from "./dist/modules/internal/get.js";
console.log(getSelf())

getSelf();
new instance({version:"1.18-pre5"}).launch({name:"Hanro50"})
