#!/bin/node
import { handler, init, Instance } from "gmll";
//Import the auth class
import { Auth } from "msmc";

await init();

const forge = await handler.getForgeVersions("1.2.5");
console.log(forge, forge[0].install);

try {
  const v = await forge[forge.length - 1].install();

  var int = new Instance({ ram: 8, version: v.id });
  // await int.import(
  //   "https://mediafilez.forgecdn.net/files/4664/777/All-of-Fabric-6-1.9.1.zip",
  //   "curseforge",
  // );
  //await int.import("https://www.hanro50.net.za/test/", "gmll")
  //Create a new auth manager
  const authManager = new Auth("select_account");
  //Launch using the 'raw' gui framework (can be 'electron' or 'nwjs')
  const xboxManager = await authManager.launch("raw");
  //Generate the minecraft login token
  const token = await xboxManager.getMinecraft();

  //Launch with the gmll token
  int.launch(token.gmll());
} catch (e) {
  console.log("ERROR");
  console.error(e);
}
