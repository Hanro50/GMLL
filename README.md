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
```js
//ES6 
import * as gmll from "gmll";
//commonJS
const gmll = require("gmll");
```
The main module you will load upon pulling in GMLL. It contains fallback hooks for every other module in GMLL as well as the init function witch will initialize GMLL. See content under the header "Initialization". 

This module also contains shortcuts for setting up an the code needed to launch a new instance. Namely a direct export for the instance, player and instance options. 

For example
```js
//Let's assume the next part is in an async function!
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
```js
//ES6 
import * as config from "gmll/config";
//commonJS
const config = require("gmll/config");
//fallback 
const config = gmll.config; 
```
The config class manages all the configuration data managed by the module. It should ideally be handled exclusively when the library has not been initialized yet as changing certain properties within the config module can cause GMLL to become uninitialized again. 

This is primarily due to this module controlling where GMLL will look and pull files from. <br><br>

## set and get functions
### Root
```ts
function getRoot(): string;
function setRoot(_root: string): void;
```
<b style="color:red">Warning:</b> using "setRoot" will mark gmll as uninitialized. It will also reset all other filepaths to their default values based on the given root path. This call is used internally to set the initial filepaths. 

<b>set:</b> The set method can be used to customize where your launcher stores GMLL's data. Useful if the default location is not exactly optimal for one reason or another. 

<b>get:</b> In a sense the get method will give you the root directory gmll is using. Unless you're developing a plugin for GMLL and wish to use the same folder GMLL uses to store critical information and or settings. It is best to use one of the other methods below to access GMLL's files.  

### Assets
```ts
function setAssets(_assets: string): void;
function getAssets(): string;
```
The location of the assets in GMLL. Internally it should look similar to the vanilla launcher's asset's folder. Apart from the fact that certain folders aren't deleted after GMLL shuts down. 
### Libraries
```ts
function setLibraries(_libraries: string):void;
function getlibraries(): string;
```
The array of Java libraries Minecraft needs to function correctly. These two commands allow you to specify where GMLL will store them internally. 
### Instances
```ts
function setInstances(_instances: string): void;
function getInstances(): string;
```
### Runtimes
```ts
function setRuntimes(_runtimes: string): void;
function getRuntimes(): string;
```
### Launcher/Meta
```ts
function setLauncher(_launcher: string): Promise<void>;
function getMeta();
```
### Natives
```ts
function setNatives(_natives: string): void;
function getNatives(): string;
```

# WIP Docs