/**The internal java and version manifest handler for GMLL */

import {
	emit,
	getInstances,
	getlibraries,
	getMeta,
	getRuntimes,
	getVersions,
	isInitialized,
	onUnsupportedArm,
} from './config.js';
import { getForgiac, runtime } from './downloader.js';
import { fsSanitizer, getOS } from './internal/util.js';
import { spawn } from 'child_process';
import { File } from './objects/files.js';
import fetch from 'node-fetch';
import Instance from './objects/instance.js';
import type {
	ModPackApiInfo,
	VersionManifest,
	MCRuntimeVal,
	VersionJson,
} from '../types';
/**
 * Compiles all manifest objects GMLL knows about into a giant array. This will include almost all fabric versions and any installed version of forge.
 * GMLL can still launch a version if it is not within this folder, although it is not recommended
 * @returns a list of Manifest files GMLL knows definitely exist.
 */
export function getManifests(): VersionManifest[] {
	isInitialized();
	const versionManifest = [];
	const root = getMeta().manifests;
	root.ls().forEach((e) => {
		if (e.sysPath().endsWith('json') && e instanceof File) {
			const v = e.toJSON<VersionManifest | VersionManifest[]>();
			if (v instanceof Array) versionManifest.push(...v);
			else versionManifest.push(v);
		}
	});
	return versionManifest;
}

const forgiacCodes = {
	100: 'Could not create virtual folder',
	101: 'Could not create junction link',
	102: 'Please use Windows Vista or later',
	200: 'User cancelled request',
	201: 'Invalid installation jar',
	202: 'Forge failed to install',
	300: 'Parameter error',
};

function findManifest(version: string, manifests: VersionManifest[]) {
	const v = version.toLocaleLowerCase().trim();
	let manifest = manifests.find((e) => {
		try {
			return e.id.toLocaleLowerCase().trim() == v;
		} catch {
			return false;
		}
	}); //|| { id: version, type: "unknown" };
	if (!manifest) {
		console.warn('[GMLL]: attempting to generate manifest files');
		const root = getMeta().manifests;
		const versionJson = getVersions().getFile(version, `${version}.json`);
		if (versionJson.exists()) {
			let f = root.getFile(`${version}.json`);
			let i = 1;
			while (f.exists()) f = root.getFile(`${version}_${i++}.json`);
			try {
				const vj = versionJson.toJSON<Partial<VersionJson>>();
				const mf: VersionManifest = {
					id: vj.id || versionJson.name.split('.')[0],
					base: vj.inheritsFrom,
					releaseTime: vj.releaseTime,
					time: vj.time,
					type: vj.type || 'generated',
				};
				f.write(mf);
			} catch (e) {
				console.error(
					'[GMLL]: failed to compile manifest from version json',
				);
			}
		} else {
			console.warn(
				`[GMLL]: no version json (at ${versionJson.sysPath()}) found, I hope you know what you are doing!`,
			);
		}
		manifest = { id: version, type: 'unknown' };
	}

	if (manifest.base) {
		const man2 = findManifest(manifest.base, manifests);
		manifest.releaseTime = man2.releaseTime;
		manifest.time = man2.time;
		manifest.complianceLevel = man2.complianceLevel;
	}
	return manifest;
}
const spTag = ['latest', 'latest:release', 'latest:snapshot'];
/**Gets a specific version manifest based on the version ID provided
 * @param version the version ID
 * @returns a version manifest. It will be of type "unknown" if the specific manifest is not in the manifest database.
 */
export function getManifest(version: string) {
	if (spTag.includes(version)) {
		const lt = getLatest();
		switch (version) {
			case 'latest:snapshot':
				version = lt.snapshot;
				break;
			case 'latest:release':
			case 'latest':
				version = lt.release;
				break;
		}
	}
	isInitialized();
	const manifests = getManifests();
	return findManifest(version, manifests);
}

/**Gets the latest release and snapshot builds.*/
export function getLatest(): { release: string; snapshot: string } {
	isInitialized();
	const file = getMeta().index.getFile('latest.json');
	if (file.exists()) return file.toJSON();
	else return { release: '1.17.1', snapshot: '21w42a' };
}

export async function installForge(
	forgeInstallerJar?: string | File,
	forgiacArgs: string[] = ['--virtual', getVersions().sysPath()],
) {
	const path = getInstances().getDir('.forgiac');
	const manifest = path.getDir('.manifest_' + Date.now()).mkdir();
	if (typeof forgeInstallerJar == 'string')
		forgeInstallerJar = new File(forgeInstallerJar);
	const fRun: MCRuntimeVal = onUnsupportedArm
		? 'java-runtime-arm'
		: 'java-runtime-gamma';
	await runtime(fRun);

	const javaPath = getJavaPath(fRun);
	const logFile = path.getFile('log.txt');
	const args: string[] = [
		'-jar',
		(await getForgiac()).sysPath(),
		' --log',
		logFile.sysPath(),
		...forgiacArgs,
		getlibraries().sysPath(),
		'--mk_manifest',
		manifest.sysPath(),
	];
	if (forgeInstallerJar) {
		args.push('--installer', forgeInstallerJar.sysPath());
	}
	path.mkdir();
	emit('jvm.start', 'Forgiac', path.sysPath());
	const s = spawn(javaPath.sysPath(), args, { cwd: path.sysPath() });
	s.stdout.on('data', (chunk) => emit('jvm.stdout', 'Forgiac', chunk));
	s.stderr.on('data', (chunk) => emit('jvm.stderr', 'Forgiac', chunk));
	const err = (await new Promise((e) => s.on('exit', e))) as number;
	if (err != 0) {
		throw {
			Error: 'forge.install.failure',
			code: err,
			message: forgiacCodes[err] || 'unknown error',
		};
	}

	const forgeManifest = manifest.ls();
	if (forgeManifest.length < 1) {
		throw {
			Error: 'manifest.not.found',
			code: 400,
			message: 'Manifest file not found?',
		};
	}
	const manifestFile = forgeManifest[0];
	if (!(manifestFile instanceof File)) {
		throw {
			Error: 'manifest.is.folder',
			code: 401,
			message: 'Manifest file is a directory?',
		};
	}
	const result = manifestFile.toJSON<VersionManifest>();
	manifestFile.moveTo(getMeta().manifests.getFile(manifestFile.getName()));
	manifest.rm();
	return result;
}

/**
 * Imports a modpack off the internet compatible with GMLL via a link.
 * See the {@link Instance.wrap()  wrapper function} to generate the files to upload to your web server to make this work
 * @param url the aforementioned link.
 */
export async function importLink(url: string): Promise<VersionManifest>;
export async function importLink(url: string, name: string): Promise<Instance>;
export async function importLink(
	url: string,
	name?: string,
): Promise<Instance | VersionManifest> {
	const r = await fetch(url + '/.meta/api.json');
	if (!r.ok) throw 'Could not find the api doc';
	const v = (await r.json()) as ModPackApiInfo;
	if (v.version != 1) {
		throw 'Incompatible version ID detected';
	}
	const manfile = fsSanitizer(v.name) + '.json';
	const manifest = (
		await getMeta()
			.manifests.getFile(manfile)
			.download(url + '/.meta/manifest.json', { sha1: v.sha })
	).toJSON<VersionManifest>();
	// console.log(manfile)
	if (!name) return manifest;
	return new Instance({ version: manifest.id, name: name }).save();
}

/**
 * Gets the path to an installed version of Java. GMLL manages these versions and they're not provided by the system.
 * @param java the name of the Java runtime. Based on the names Mojang gave them.
 * @returns The location of the have executable.
 */
export function getJavaPath(java: MCRuntimeVal = 'jre-legacy') {
	if (getOS() == 'windows') {
		const f = getRuntimes().getFile(java, 'bin', 'javaw.exe');
		if (f.exists()) return f;
		else getRuntimes().getFile(java, 'bin', 'java.exe');
	} else return getRuntimes().getFile(java, 'bin', 'java');
}
