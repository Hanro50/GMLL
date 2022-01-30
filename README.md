# GMLL
<a href="https://github.com/Hanro50/GMLL/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/msmc" alt="MIT license"/></a>
<a href="https://www.npmjs.com/package/gmll"><img src="https://img.shields.io/npm/v/gmll" alt="Version Number"/></a>
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
PS: If you find a bug, don't be afraid to report it on Github or Discord!  

# File systems
When running under Windows. GMLL only supports NTFS. GMLL will not work under FAT32, FAT16, exFAT or any other non NTFS based file system commonly used by Windows what so ever.

Linux and Mac users should not encounter this issue as on these systems, symlinks can be made by users whom are not system administrators. 

If your launcher is installed onto a drive which in of itself is not formated as NTFS, but your launcher tells GMLL to generate it's files on a partition that is formated as NTFS. It _should_ work. A shortcut to the user's AppData folder is "%appdata%\\\<name of your launcher\>". Just incase...

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
# Start here
## Import the module
GMLL contains a commonJS and a ES6 versions of every internal component
```js
//ES6 
import * as gmll from "gmll";
//commonJS
const gmll = require("gmll");
```

## a word on the docs
GMLL is to big to maintain an up to date dev doc with the current amount of resources awarded to the project. Instead, please see the included JSDocs in the comments in the type files. Since those will be exponetially easier to maintain and will likely provide the information specific to what you require a function to do. 

## Quick start 
This quick start will use MSMC for authentication. Full disclosure, GMLL endorses MSMC by virtue of the two projects sharing an author. 

ES6:
```js
//All modules can be accessed from the main GMLL index file
import { wrapper, init, instance } from "gmll";
//GMLL supports sub modules 
import { setRoot } from "gmll/config";
import { installForge } from "gmll/handler";
import { fastLaunch } from "msmc";
//Changes where GMLL puts the ".minecraft" gmll creates (will default to a folder called .minecraft in the same folder in your root process directory)
setRoot(".MC")
//Gets GMLL to fetch some critical files it needs to function 
await init();
//Prompts GMLL to ask the user to install forge. This command can be fed the path to a forge installer as well 
installForge();
//Gets the login token for use in launching the game
const token = wrapper.msmc2token(await fastLaunch("raw", console.log));
//GMLL uses the concept of instances. Essentially containerised minecraft installations 
const i = new instance({ version: "1.18.1" });
//Save the instance for use later, will go into more detail in later parts of the docs
i.save();
//Launches the game with the token we got earlier. GMLL will download and install any library it needs 
i.launch(token);

```
CommonJS:
```js
//Like in ES6 we can use sub-modules 
const gmll = require("gmll");
const config = require("gmll/config");
const { fastLaunch } = require("msmc");
//Changes where GMLL puts the ".minecraft" gmll creates (will default to a folder called .minecraft in the same folder in your root process directory)
config.setRoot(".MC")
//The init call does some fetch operations internally. Thus it needs to be async 
gmll.init().then(async () => {
    const e = await fastLaunch("raw", console.log);
    //Converts the login token to something GMLL understands 
    const token = gmll.wrapper.msmc2token(e);
    //GMLL uses the concept of instances. Essentially containerised minecraft installations 
    let int = new gmll.instance({ version: "1.18.1" })
    //This method is a high level override for setting custom icons for the game. May not work with older versions of Minecraft
    int.setIcon("icon_32x32.png","icon_16x16.png")
    //Launches the game with the token we got earlier. GMLL will download and install any library it needs 
    int.launch(token);
})
```
# Handling of instances 
An instance contains all the local files of a launcher profile. Your texture, resource, mod and data packs are all contained within a folder declared by an "instance". GMLL has an instance manager built into it and can easily keep track of multiple instances for you. 

## Instance constructor
GMLL's instance object accepts one parameter of type options. This is also the format GMLL will save instances in internally. 
```ts
export interface options {
    /**The name of the instance */
    name?: string,
    /**The version of the game to load */
    version?: string,
    /**The installation path */
    path?: string,
    /**Ram in GB */
    ram?: Number,
    /**Custom data your launcher can use */
    meta?: any
    /**Asset index injection */
    assets?: assets
}
```
## loading and saving
```js
//CommonJS
const {instance} = require("gmll/objects/instance");
//ES6
import {instance} from "gmll/objects/instance";
...
const i = new instance({ version: "1.18.1",name:"MY INSTANCE" });
//GMLL won't save instances automatically. Could hurt SSD users
i.save();
...
//some random code
...
//We have loaded the instance we created earlier back and can now launch it
const i777 = instance.get("MY INSTANCE"); 
i777.launch(token);
```

## Custom icons and assets
Warning: borked in general on Mac and Linux for releases between 1.13 and 1.18.1 (<a href="https://bugs.mojang.com/browse/MCL-15163">MCL-15163?</a>)

Can be used to insert a matching launcher icon or replace a random song with Rick Ashley's <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Never going to give you up</a>. This will copy the files provided into Minecraft's asset index and create a custom asset index file matching the modifications. GMLL does take care to emulate vanilla here in how assets are added to the index to avoid collisions. 

Should be a predefined asset in Minecraft's asset index for the version the set instance launches. 
```js
//CommonJS
const {instance} = require("gmll/objects/instance");
//ES6
import {instance} from "gmll/objects/instance";
const i777 = instance.get("MY INSTANCE"); 
i777.injectAsset("minecraft/sounds/ambient/cave/cave1.ogg", "path/to/rick/roll.ogg");
i777.setIcon("path/to/32x32.png","path/to/16x16.png","path/to/mac.icns")
```

## Install \<Advanced!>
The install command on the instance does a range of preflight checks. From making sure the instance has the java version it currently needs already installed to downloading the version json, assets, libraries and what not the instance needs to launch. It does not compile the asset index for the index beforehand if there are custom assets. This function is called by the launch function as well. 
```js
//CommonJS
const {instance} = require("gmll/objects/instance");
//ES6
import {instance} from "gmll/objects/instance";
const i777 = instance.get("MY INSTANCE"); 
i777.install();
```
# Warning!
From the point forward. It will be assumed that you have a basic understanding of how JavaScript works. Not every element will be showed like it was with the previous documentation!

# Basic file handling in GMLL
GMLL uses an object based system to handle files. This abstraction simplifies handling the small differences between Windows, Linux and MacOS interms of how files, folders and directories are specified. It also replaces the old buggy and unstable function based system completely that GMLL used in the past.  

## Specifying a folder 
```js
const { dir } = require("gmll/objects/files");
const folder = new dir("path","to","folder");
```
Folders specify, while folders if you're on Windows and directories if you're on anything else. 

## Specifying a file 
```js
import { file } from "gmll/objects/files";
const file = new file("path/to/folder");
```
Specifies the path towards a file

# Configuration 
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
function setRoot(_root: dir): void;
```
<b style="color:red">Warning:</b> using "setRoot" will mark gmll as uninitialized. It will also reset all other filepaths to their default values based on the given root path. This call is used internally to set the initial filepaths. 

 This method can be used to easily redefine where GMLL stores Minecraft related data. Useful if the default location is not exactly optimal for one reason or another. 

### Assets
```ts
function setAssets(_assets: dir): void;
function getAssets(): string;
```
The location of the assets in GMLL. Internally it should look similar to the vanilla launcher's asset's folder. Apart from the fact that certain folders aren't deleted after GMLL shuts down. 
### Libraries
```ts
function setLibraries(_libraries: dir):void;
function getlibraries(): string;
```
The array of Java libraries Minecraft needs to function correctly. These two commands allow you to specify where GMLL will store them internally. 
### Instances
```ts
function setInstances(_instances: dir): void;
function getInstances(): string;
```
The default location where GMLL stores the game files used by various versions of minecraft. It will contain the name of the instance which will default to the version id if a set instance is not given a name. 
### Versions
```ts
function setVersions(_Versions: dir): void;
function getVersions(): string;
```
The location of the assets in GMLL. Internally it should look similar to the vanilla launcher's asset's folder. Apart from the fact that certain folders aren't deleted after GMLL shuts down. 
### Runtimes
```ts
function setRuntimes(_runtimes: dir): void;
function getRuntimes(): string;
```
The "runtimes" folder contains all the java runtimes GMLL knows about. Adding custom runtimes to this folder can technically be done, but isn't recommended. 
### Launcher/Meta
```ts
async function setLauncher(_launcher: dir): Promise<void>;
export declare function getMeta(): {
   manifests: dir;runtimes: dir;index: dir;profiles: dir;temp: dir;folder: dir;
};
```
The launcher folder contains all the core meta data and files GMLL uses. 
It is where it will save data related to instances, manifest and core index files.
The "getMeta" function wraps all of this into an easy to handle object that contains paths to 
every folder within the meta files. The files here are more here to instruct GMLL where to get certain files from and are checked when you run the "init" command. 

The "setLauncher" is asynchronous as it will reinitialize GMLL for you when it is used. 

#### Fields
<table>
<tr><th>name</th><th>description</th></tr>
<tr><td>manifests</td><td>This file contains files used to compile the version manifest file GMLL exposes to your Launcher. Want to add a custom version? Add a file in here. Forgiac actually drops in files here and every version should have exactly one file in this folder reference it. Since the manifests files also give GMLL some data points needed to sort a set custom version. </td></tr>
<tr><td>runtimes</td><td>Contains the index files GMLL uses to download a set runtime required by a set version. The vanilla provided indexes are checked against a sha hash. Although custom runtime indexes are left alone and will be ignored unless a set version of minecraft requests it.<br><br>  <b style="color:red">Warning:</b>Contents of these indexes are different per platform. Just take that into account as you need to insure the right index is placed here for the set platform your launcher is currently running on.</td></tr>
<tr><td>index</td><td>Contains miscellaneous index files used by GMLL to get other index files or to store internal data GMLL uses to function. Please ignore unless you're developing an addon for GMLL.</td></tr>
<tr><td>profiles</td><td>Where instance config data is saved when you run the "save()" function on the profile object. </td></tr>
</table>

### Natives
```ts
function setNatives(_natives: dir): void;
function getNatives(): string;
```
Where the natives a set version uses should be extracted to. 

### setLauncherVersion & setLauncherName
```ts
function setLauncherVersion(_version?: string): void;
function getLauncherVersion(): string;

function setLauncherName(_name: string = "GMLL"): void;
function setLauncherName(): string;
```
Declares the launcher version and name GMLL should report to Minecraft. Doesn't seem to do much of anything atm. 

### events 
```ts
function emit(tag: string, ...args: Array<Number | String>): void;
function setEventListener(events: Events): void;
function getEventListener(): Events;
```
This determines a few things in GMLL. Like console output and how data for a set event is processed.
If GMLL's console output is annoying then you can use the set method to feed in your own event listener. Check the JS docs for more information as the readme is likely to become outdated before long if I wrote information about it here. 

emit is an internal function and should not be used outside of GMLL. 

## Update config 
```ts
//Clears all settings
function clrUpdateConfig(): void;
//Adds a setting to the list of things GMLL should update
function addUpdateConfig(item: update): void;
//Gets the current list of things GMLL will update upon initialization
function getUpdateConfig(): update[];
```
Can be used to fine tune GMLL if your launcher isn't using all of GMLL's functions. 
For instance you can set it to only update the vanilla version manifest if you're not planning on using fabric or you can ask it to not download/update forgiac. 

## misc
```ts
//Used to resolve paths within the context of GMLL. Useful for plugin developers
function resolvePath(file: string): string;

//Used for GMLL plugins. Any function passed to this function will be called every time GMLL is initialized. 
export function initializationListener(func: () => void | Promise<void>):void;
//Does some preflight checks and is actually called by the "init" function in the index file. This can be called directly and will be no different then calling "init" in the index file.
export async function initialize();
```

# modpacks 
```ts
//part of gmll/objects/instance
async function wrap(baseUrl: string, save: dir, name?: string , forge?: { jar: file });
...
//part of gmll/handler
async function importLink(url: string): Promise<manifest>;
async function importLink(url: string, name: string): Promise<instance>;
async function importLink(url: string, name?: string): Promise<instance | manifest> 
```
GMLL has a built in modpack API it can use to obtain and install modpacks. It also has a function to manually wrap up instances into the required format you need to upload said modpack to a webserver somewhere. Modpacks can still be manually built by hand since the installer can do more then the wrapper will give you access to. 

## Basic setup
### Creation:
```js
//Create an instance with the settings you want
var int = new gmll.instance({ version: "1.18.1" })
//Customise the asset index for that version like so
int.setIcon("icon_32x32.png", "icon_16x16.png");
//Finally create your modpack - this example is what to do for fabric and vanilla packs
await int.wrap(
    /**The URL link to the base folder of this modpacks final resting spot*/
    "https://www.hanro50.net.za/test", 
    /**The output directory where you want GMLL to compile the files to.*/ 
    new dir(".wrap"),
    /**The name of your pack.*/ 
    "MyAmazingPack"
    )
...
//Alternatively. Here's what to do for Forge based packs
await int.wrap(
    /**The URL link to the base folder of this modpacks final resting spot*/
    "https://www.hanro50.net.za/test", 
    /**The output directory where you want GMLL to compile the files to.*/ 
    new dir(".wrap"),
    /**The name of your pack.*/ 
    "MyAmazingPack",
    /**This is a bit more complex here for future proofing. This is just a path to your forge jar*/
    {jar: new file("path/to/installer/jar")}))
```
### Importing:
```js
const e = await fastLaunch("raw", console.log);
const token = gmll.wrapper.msmc2token(e);

/**This will only install the manifest files for a custom modpack. Making the created version selectable as the base of a new instance.*/
(await gmll.handler.importLink(
    /**The link leading to a modpack. Fun fact, this link actually leads to a demo of this whole system*/
    "https://www.hanro50.net.za/test")).launch(token);
...
/**This version of the function will go ahead and create an instance with the name provided.*/
(await gmll.handler.importLink(
    /**The link leading to a modpack. Fun fact, this link actually leads to a demo of this whole system*/
    "https://www.hanro50.net.za/test",
    /**A custom name for the new instance*/
    "launcherTest")).launch(token);
```

## A tale of two modloaders...

While GMLL's modpack api supports both forge (via <a href="https://github.com/Hanro50/Forgiac/">forgiac</a>) and fabric. Fabric is recommended over forge due to a lesser chance of breaking due to changes made to forge by the forge developers. 

It should be mentioned that for GMLL to wrap a forge based modpack. The forge installer will need to be provided as an input. Ignoring this field will treat the modpack as a fabric modpack. While this can still work, you'll need to instruct your user to manually install forge. The reason why you do not need to manually install fabric versions is because GMLL will automatically generate the manifest files needed to install nearly any version of fabric.   


# WIP Docs
Still being worked on actively. Stay tuned.