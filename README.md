# GMLL
<a href="https://www.npmjs.com/package/gmll"><img src="https://img.shields.io/npm/l/msmc" alt="MIT license"/></a>
<a href="https://github.com/Hanro50/gmll/"><img src="https://img.shields.io/npm/v/gmll" alt="Version Number"/></a>
<a href="https://github.com/Hanro50/gmll/"><img src="https://img.shields.io/github/stars/hanro50/gmll" alt="Github Stars"/></a><br/>
A generic Minecraft Launcher Library 

# Module type
GMLL is a hybrid module. However as such, you should best avoid trying to use GMLL as both a ES6 and a CommonJS module in the same project. 

# Support 
No support will be given to launchers that seek to grant access to Minecraft to individuals whom do not posses a valid Minecraft License. In other words, don't launch Minecraft if a user has not logged in with an account that owns the game at least once. I'm not in the mood to get sued. -Hanro

Other then that. There's a channel dedicated to GMLL on the MSMC support Discord server. Click the following badge to join.
<div>
   <a href="https://discord.gg/3hM8H7nQMA">
   <img src="https://img.shields.io/discord/861839919655944213?logo=discord"
      alt="chat on Discord"></a>
</div>

# Initialization
The library relies on a collection core files that are dynamically downloaded from the internet to function. GMLL thus has two states it can be within. Initialized and uninitialized. GMLL will refuse to launch minecraft if it is not properly initialized. 

Before initialization. You'll likely want to load the config module and modify the paths GMLL uses. This is recommended as the initialization method will also create any folders required by GMLL to function. Essentially if you keep finding GMLL is generating random .minecraft folders, this is likely why. See the header "Config" under modules.

To initialize GMLL. You need to execute the init() function. 
```js
//CommonJS
const {init} = require("gmll");
init().then(...);
//ES6
import { init } from "gmll";
await init();
```

# Modules
## index
The main module you will load upon pulling in GMLL. It contains fallback hooks for every other module in GMLL as well as the init function witch will initialize GMLL. See content under the header "Initialization". 

This module also contains shortcuts for setting up an the code needed to launch a new instance. Namely a direct export for the instance, player and instance options. 

For example
```js
//ES6 
import * as gmll from "gmll";
//commonJS
const gmll = require("gmll");
... //Let's assume the next part in a async function!
//Needed to make sure all the needed files are downloaded
await gmll.init();
//The player profile and login token
const token = {
     profile: {
        id:"id",
        name: "Player",
        xuid: 5556345345,
        type: "msa",
        demo: true},
    access_token: "Some token"};
//Launches the game
new gmll.instance({ version: "1.18" }.launch(token);
...
```
## config
The config class manages all the configuration data managed by the module. It should ideally be handled exclusively when the library has not been initialized yet as changing certain properties within the config module can cause GMLL to become uninitialized again. 

This is primarily due to this module controlling where GMLL will look and pull files from. <br><br>

### Function: resetRoot
This allows you to customize where the data folder for GMLL will be located. This function is called internally on startup to specify the default directory GMLL will use if you don't customize the directories

Warning: This function will override any directories you have already changed and will mark GMLL as uninitialized. Which will cause errors if the initialize function is not called again!

```ts
function resetRoot(_root: string): void;
```

# WIP Docs