
import { wrapper, init, instance } from "gmll";
import { setRoot } from "gmll/config";
import { installForge } from "gmll/handler";


import { fastLaunch } from "msmc";

setRoot(".MC")
await init();
installForge();

const token = wrapper.msmc2token(await fastLaunch("raw", console.log));

const i = new instance({ version: "1.8.9-forge1.8.9-11.15.1.2318-1.8.9" });
i.save();
i.launch(token);

