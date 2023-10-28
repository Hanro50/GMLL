import { resolvePath, getMeta, getAssets, getVersions } from '../config.js';
import { getLatest } from '../handler.js';
import {
	fsSanitizer,
	getCpuArch,
	throwErr,
	assetTag,
} from '../internal/util.js';
import { join } from 'path';
import type {
	AssetIndex,
	DownloadableFile,
	LaunchArguments,
	LaunchOptions,
	VersionJson,
	curseforgeModpack,
} from '../../types';
import { Dir, File } from './files.js';
import Version from './version.js';
import * as metaHandler from '../internal/handlers/meta.js';
import * as modsHandler from '../internal/handlers/mods.js';
import * as launchHandler from '../internal/handlers/launch.js';
import { importLink } from '../handler.js';
import { download } from '../downloader.js';
/**
 * An instance is what the name entails. An instance of the game Minecraft containing Minecraft specific data.
 * This information on where the game is stored and the like. The mods installed and what not.
 */
export default class Instance {
	protected assets: Partial<AssetIndex>;
	protected id: string;
	path: string;
	version: string;
	name: string;
	env: { [key: string]: string };

	ram: number;
	/**This is a custom field for launcher authors. It can safely be ignored*/
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	meta: any;

	javaPath: 'default' | string;
	noLegacyFix: boolean;

	detach: boolean;

	/**Additional arguments added for legacy versions */
	public static oldJVM = [
		'-Djava.util.Arrays.useLegacyMergeSort=true',
		'-Dminecraft.applet.TargetDirectory=${game_directory}',
	];

	/**The default game arguments, don't mess with these unless you know what you are doing */
	public static defaultGameArguments = [
		'-Xms${ram}M',
		'-Xmx${ram}M',
		'-XX:+UnlockExperimentalVMOptions',
		'-XX:+UseG1GC',
		'-XX:G1NewSizePercent=20',
		'-XX:G1ReservePercent=20',
		'-XX:MaxGCPauseMillis=50',
		'-XX:G1HeapRegionSize=32M',
		'-Dlog4j2.formatMsgNoLookups=true',
	];
	/**Do not mess with unless you know what you're doing. Some older versions may not launch if information from this file is missing. */
	public static defJVM: LaunchArguments = [
		{
			rules: [{ action: 'allow', os: { name: 'osx' } }],
			value: ['-XstartOnFirstThread'],
		},
		{
			rules: [{ action: 'allow', os: { name: 'windows' } }],
			value:
				'-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump',
		},
		{
			rules: [{ action: 'allow', os: { name: 'windows', version: '^10\\.' } }],
			value: ['-Dos.name=Windows 10', '-Dos.version=10.0'],
		},
		{ rules: [{ action: 'allow', os: { arch: 'x86' } }], value: '-Xss1M' },
		'-Djava.library.path=${natives_directory}',
		'-Dminecraft.launcher.brand=${launcher_name}',
		'-Dminecraft.launcher.version=${launcher_version}',
		'-cp',
		'${classpath}',
	];

	constructor(opt: LaunchOptions = {}) {
		this.version = opt.version || getLatest().release;
		this.name = opt.name || this.version;
		this.path = opt.path || join('<instance>', fsSanitizer(this.name));
		this.ram = opt.ram || 2;
		this.meta = opt.meta || undefined;
		this.assets = opt.assets || {};
		this.javaPath = opt.javaPath || 'default';
		this.env = opt.env || {};
		this.noLegacyFix = opt.noLegacyFix || false;
		this.detach = opt.detach || false;
		this.getDir().mkdir();
		const MESA = 'MESA_GL_VERSION_OVERRIDE';
		if (!['x64', 'arm64', 'ppc64'].includes(getCpuArch()) && this.ram > 1.4) {
			console.warn(
				'[GMLL]: Setting ram limit to 1.4GB due to running on a 32-bit version of java!',
			);
			this.ram = 1.4;
		}
		if (!(MESA in this.env) && process.platform == 'linux') {
			this.env[MESA] = '4.6';
		}
	}
	getID() {
		return this.id;
	}
	/**Gets the load order of minecraft jars in jar mod loader. */
	public getJarModPriority = modsHandler.getJarModPriority;
	/**Install forge in this instance. */
	public installForge = modsHandler.installForge;
	/**
	 * Used to modify minecraft's jar file (Low level)
	 * @param metaPaths
	 * @param version
	 * @returns
	 */
	public static jarMod = modsHandler.jarMod;
	/**An version of the wrap function that takes an object as a variable instead of the mess the base function takes. */
	public pack = modsHandler.pack;
	/**Wraps up an instance in a prepackaged format that can be easily uploaded to a server for distribution
	 * @param baseUrl The base URL the generated files will be stored within on your server. For example http\:\/\/yourawesomdomain.net\/path\/to\/files\/
	 * @param save The file GMLL will generate the final files on.
	 * @param name The name that should be used to identify the generated version files
	 * @param forge The path to a forge installation jar
	 * @param trimMisc Gets rid of any unnecessary miscellaneous files
	 */
	public wrap = modsHandler.wrap;
	/**
	 * @returns Some low level meta paths used to obtain some key files of this instance.
	 */
	public getMetaPaths = metaHandler.getMetaPaths;
	/**
	 * Gets information about mods in this instance. This includes the loader version plus some general
	 * information about the mod author and mod itself. This will also provide you the icon for a set mod if it can be obtained.\
	 *
	 * Works with Legacy forge, forge, fabric, riftloader and liteloader
	 */
	public getMods = metaHandler.getMods;
	/**
	 * Gets information about the installed resource and texture packs of this instance.
	 * This includes information like the pack icon, name, description, legal documents and credits.
	 */
	public getResourcePacks = metaHandler.getResourcePacks;
	/**
	 * Gets some general information about all the world files in this instance.
	 * It also decodes the level.DAT file for you and returns the decoded file as a JSON file.
	 *
	 * It also decodes the player data stored in the "playerdata" and "stats" subfolder in newer versions of the game.
	 */
	public getWorlds = metaHandler.getWorlds;
	/**
	 * This function is used to launch the game. It also runs the install script for you.
	 * This essentially does an integrity check.
	 * @param token The player login token
	 * @param resolution Optional information defining the game's resolution
	 * @returns The game's child process
	 */
	public launch = launchHandler.launch;
	/**
	 * Runs the installer script without launching MC
	 * @returns The instance's version object.
	 * @see {@link getVersion} if you just want the instance's version
	 */
	public install = launchHandler.install;
	/**
	 *
	 * @returns An object containing the version data this instance is based on
	 * @see {@link install} if you want to initiate that version object first!
	 */
	async getVersion() {
		return await Version.get(this.version);
	}

	getDir() {
		return new Dir(resolvePath(this.path));
	}

	/**Gets a list of profiles that where saved previously */
	static getProfiles() {
		const profiles: Map<string, LaunchOptions & { get: () => Instance }> =
			new Map();
		getMeta()
			.profiles.ls()
			.forEach((e) => {
				if (e instanceof File && e.getName().endsWith('.json')) {
					const profile = e.toJSON<LaunchOptions>();
					profiles.set(profile.name, {
						...profile,
						get: () => this.get(e.getName()),
					});
				}
			});
		return profiles;
	}

	/**Gets a set profile based on the name of that profile */
	public static get(profile: string) {
		if (!profile.endsWith('.json')) profile += '.json';
		const _file = getMeta().profiles.getFile(fsSanitizer(profile));
		const json = _file.exists() ? _file.toJSON<LaunchOptions>() : {};
		return new Instance(json);
	}
	/**
	 * Deletes a profile based on the profileID
	 * @param profile
	 * @returns
	 */
	public static rm(profile: string) {
		if (!profile.endsWith('.json')) profile += '.json';
		const _file = getMeta().profiles.getFile(fsSanitizer(profile));
		return _file.rm();
	}
	/**
	 * Delete the saved information for this instance.
	 * @returns
	 */
	rmSelf() {
		return Instance.rm(this.getID());
	}

	/**
	 * Saves the instance data. Can be used to automatically get the instance again by using it's name
	 * @see {@link get} for more info
	 */
	save() {
		getMeta()
			.profiles.getFile(fsSanitizer(this.name + '.json'))
			.write(this);
		return this;
	}
	/**
	 * This will tell GMLL to rerun some of the install scripts it normally skips upon a second "install" call.
	 * This won't reset worlds or rewrite dynamic files. Use this if, for instance, forge failed to install.
	 */
	reinstall() {
		this.getDir().getFile('.installed.txt').rm();
	}
	/**Injects a set selection of images into the asset files and sets them as the icon for this instance */
	setIcon(x32?: string | File, x16?: string | File, mac?: string | File) {
		if (x32) {
			const x32Icon = this.injectAsset('icons/icon_32x32.png', x32);
			this.assets.objects['minecraft/icons/icon_32x32.png'] = x32Icon;
		}
		if (x16) {
			const x16Icon = this.injectAsset('icons/icon_16x16.png', x16);
			this.assets.objects['minecraft/icons/icon_16x16.png'] = x16Icon;
		}
		if (mac) {
			const macIcon = this.injectAsset('icons/minecraft.icns', mac);
			this.assets.objects['minecraft/icons/minecraft.icns'] = macIcon;
		}
	}
	/**
	 * Inject custom assets into the game.
	 * @param key The asset key
	 * @param path The path to the asset file in questions...it must exist!
	 */
	injectAsset(key: string, path: string | File) {
		if (typeof path == 'string') path = new File(path);
		if (!path.exists()) throwErr('Cannot find file');
		const hash = path.getHash();
		path.copyTo(assetTag(getAssets().getDir('objects'), hash).getFile(hash));
		if (!this.assets.objects) this.assets.objects = {};
		const asset = { hash: hash, size: path.getSize(), ignore: true };
		this.assets.objects[key] = asset;
		return asset;
	}

	getName() {
		return this.name;
	}

	//https://www.curseforge.com/api/v1/mods/829758/files/4661651/download

	static async import(
		name: string,
		urlorFile: string | File,
		type: 'curseforge' | 'gmll',
		forge?: string | File,
	) {
		return new this({ name }).import(urlorFile, type, forge);
	}

	async import(
		urlorFile: string | File,
		type: 'curseforge' | 'gmll',
		forge?: string | File,
	) {
		switch (type) {
			case 'curseforge':
				console.warn("GMLL's support for curse modpacks is in an Alpha state!");
				console.log('Use GMLLs native modpack api instead if you can');
				console.log('Only fabric modpacks work properly atm.');
				const tmp = getMeta().scratch.getDir('curse', this.name).mkdir();
				const metaInf = tmp.getFile('manifest.json');
				const installedFile = this.getDir().getFile('installed.txt');
				const metaFile = getMeta().scratch.getFile('curse_meta.json');
				let metaModData: {
					[key: string]: {
						id: string;
						sha1?: string | string[];
						size?: number;
					};
				} = metaFile.exists() ? metaFile.toJSON() : {};

				if (installedFile.exists() && metaInf.exists()) {
					let inf = metaInf.toJSON<curseforgeModpack>();
					this.version = 'curse.' + inf.name + '-' + inf.version;
					console.log('Installed files found, assuming file was installed!');
					return this;
				}
				// await this.install();
				let file: File;
				if (typeof urlorFile == 'string') {
					file = this.getDir().getFile('modpack.zip');
					await file.download(urlorFile);
				} else {
					file = urlorFile;
				}
				console.log('Extracting achive');

				await file.unzip(tmp);
				let inf = metaInf.toJSON<curseforgeModpack>();

				console.log('Applying overides');
				function copyFile(fToCopy: File | Dir, base: Dir) {
					if (fToCopy instanceof File) {
						let file = base.getFile(fToCopy.getName()).rm();
						fToCopy.moveTo(file);
					} else {
						fToCopy
							.ls()
							.forEach((e) => copyFile(e, base.getDir(fToCopy.getName())));
					}
				}
				tmp
					.getDir(inf.overrides)
					.ls()
					.forEach((e) => copyFile(e, this.getDir()));

				let mcVersion = inf.minecraft.version;

				if (forge) {
					mcVersion = await this.installForge(forge);
				} else {
					if (inf.minecraft.modLoaders.length > 1)
						console.warn(
							'GMLL may not support multi modloader setups are currently not recommended!',
						);

					for (let e of inf.minecraft.modLoaders) {
						const data = e.id.split('-');
						const type = data[0];
						const version = data[1];

						if (['fabric', 'quilt'].includes(type)) {
							mcVersion = `${type}-loader-${version}-${inf.minecraft.version}`;
						} else {
							console.warn(
								'Unsupported modloader type ' +
									e.id +
									'\nIf this is forge then supply the forge jar yourself.\nGMLL is not natively compatible with the method Curse uses to install forge.',
							);
						}
					}
				}
				const mods = this.getDir().getDir('mods').mkdir();
				let fileNames = [];

				let files: DownloadableFile[] = [];

				inf.files.forEach((f) => {
					const name = `${f.projectID}-${f.fileID}`;
					fileNames.push(name);

					let meta = metaModData[name];
					let fname = name;
					if (meta && meta.id && meta.sha1 && meta.size)
						fname =
							meta.id + '-' + meta.sha1.slice(0, 5) + meta.size.toString(36);

					files.push({
						name: fname + '.jar',
						path: [this.getDir().sysPath(), 'mods'],
						url:
							f.downloadUrl ||
							`https://www.curseforge.com/api/v1/mods/${f.projectID}/files/${f.fileID}/download`,
						key: meta?.id || name,
						chk: meta || {},
					});
				});

				await download(files);

				this.version = mcVersion;
				const err = (await this.getMetaPaths()).mods
					.getDir('unparsable')
					.mkdir();

				(await this.getMods()).forEach((e) => {
					const fileName = e.path.getName();

					if (fileNames.includes(fileName)) {
						if (e.error) {
							if (e.loader == 'unknown')
								e.path.moveTo(err.getFile(e.path.getName()));
							return;
						}
						let sha1 = e.path.getHash();
						let size = e.path.getSize();

						metaModData[fileName] = {
							sha1,
							size,
							id: e.id + '-' + e.version,
						};
						const nfile = mods.getFile(
							fsSanitizer(
								e.id +
									'-' +
									e.version +
									'-' +
									sha1.slice(0, 5) +
									size.toString(36),
							) + '.jar',
						);
						e.path.moveTo(nfile);
					}
				});
				metaFile.write(metaModData);

				break;
			case 'gmll':
				if (forge) console.warn('The forge property goes unused in this mode!');
				if (typeof urlorFile == 'string')
					this.version = (await importLink(urlorFile)).id;
				else console.warn('Only URLS are supported');
				break;
			default:
				console.error('Unsupported modpack type!');
		}

		return this;
	}
}
