
import { wrapper, init, instance } from "gmll";
import { setRoot } from "gmll/config";


import { fastLaunch } from "msmc";
setRoot(".MC")


const token = wrapper.msmc2token(await fastLaunch("raw", console.log));
await init();
const i = new instance({ version: "1.6.4" });
i.save();
i.launch(token);

