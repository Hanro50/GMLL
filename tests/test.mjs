#!/bin/node
import { init, Instance } from "gmll";
//Import the auth class
import { Auth } from "msmc";

await init()
var int = new Instance({ ram: 8, name: "TEST3" })
//await int.import("https://mediafilez.forgecdn.net/files/4664/777/All-of-Fabric-6-1.9.1.zip", "curseforge")
await int.import("https://www.hanro50.net.za/test/", "gmll")
//Create a new auth manager
const authManager = new Auth("select_account");
//Launch using the 'raw' gui framework (can be 'electron' or 'nwjs')
const xboxManager = await authManager.launch("raw")
//Generate the minecraft login token
const token = await xboxManager.getMinecraft()

//Launch with the gmll token
int.launch(token.gmll());





