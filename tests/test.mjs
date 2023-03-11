#!/bin/node



import { init, instance } from "gmll";
//Import the auth class
import { auth } from "msmc";

await init()
var int = new instance({"version":"b1.7.3"})
await int.install()
//Create a new auth manager
const authManager = new auth("select_account");
//Launch using the 'raw' gui framework (can be 'electron' or 'nwjs')
const xboxManager = await authManager.launch("raw")
//Generate the minecraft login token
const token = await xboxManager.getMinecraft()


//Launch with the gmll token
int.launch(token.gmll());

try {
} catch (e) {
    console.trace(e)
}



