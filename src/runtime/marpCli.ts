import type * as NodeChildProcess from 'node:child_process';
import type * as NodeFs from 'node:fs';
import type * as NodePath from 'node:path';
import { Platform } from 'obsidian';
import packageMetadata from '../../package.json';
import type { MarpExtendedSettings } from '../utilities/settings';

export class MarpCLIError extends Error {}

interface MarpCliExecResult {
	stdout: string;
	stderr: string;
}

interface MarpCliExecError extends Error {
	code?: string | number;
	errno?: number;
	syscall?: string;
	path?: string;
}

interface MarpCliInvocation {
	executable: string;
	argsPrefix: string[];
	isNpxFallback: boolean;
}

type NodeChildProcessModule = typeof NodeChildProcess;
type NodeFsModule = typeof NodeFs;
type NodePathModule = typeof NodePath;

const DEFAULT_MARP_CLI_COMMAND = 'marp';
type MarpExtendedPackageMetadata = {
	marpExtended: {
		npxMarpCliPackage: string;
	};
};

const NPX_MARP_CLI_PACKAGE = (packageMetadata as MarpExtendedPackageMetadata).marpExtended.npxMarpCliPackage;
const SUPPORTED_MARP_CLI_VERSION = NPX_MARP_CLI_PACKAGE.slice(NPX_MARP_CLI_PACKAGE.lastIndexOf('@') + 1);
const MISSING_MARP_CLI_INSTALL_HINT = 'Install it with `npm install -g @marp-team/marp-cli`, set the Marp CLI path, or enable npx fallback in Marp Extended settings.';
const MISSING_NPX_INSTALL_HINT = 'Install Node.js/npm so npx is available, or set the Marp CLI path in Marp Extended settings.';
const MARP_CLI_MAX_BUFFER = 10 * 1024 * 1024;
const WINDOWS_COMMAND_SCRIPT_PATTERN = /\.(?:cmd|bat)$/i;
const WINDOWS_CMD_META_CHARACTER_PATTERN = /([()\][%!^"`<>&|;, *?])/g;
const WINDOWS_NODE_MODULES_CMD_SHIM_PATTERN = /node_modules[\\/]\.bin[\\/][^\\/]+\.cmd$/i;
const marpCliValidationCache = new Map<string, MarpCliInvocation>();
const COMMON_MARP_CLI_DIRECTORIES = [
	'/opt/homebrew/bin',
	'/usr/local/bin',
	'/opt/local/bin',
	'/usr/bin',
	'/bin',
];

function getEnvVar(key: string): string {
	const p = (typeof window !== 'undefined' ? (window as Window & { process?: { env?: Record<string, string> } }).process : undefined) ?? (typeof process !== 'undefined' ? process : undefined);
	const env = p ? p['env'] : undefined;
	return (env ? env[key] : '') ?? '';
}

const COMMON_DARWIN_BROWSER_PATHS = [
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/Applications/Chromium.app/Contents/MacOS/Chromium',
	'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
	`${getEnvVar('HOME')}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
	`${getEnvVar('HOME')}/Applications/Chromium.app/Contents/MacOS/Chromium`,
	`${getEnvVar('HOME')}/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`,
];
const COMMON_WINDOWS_BROWSER_PATHS = [
	`${getEnvVar('PROGRAMFILES')}\\Google\\Chrome\\Application\\chrome.exe`,
	`${getEnvVar('PROGRAMFILES(X86)')}\\Google\\Chrome\\Application\\chrome.exe`,
	`${getEnvVar('LOCALAPPDATA')}\\Google\\Chrome\\Application\\chrome.exe`,
	`${getEnvVar('PROGRAMFILES')}\\Microsoft\\Edge\\Application\\msedge.exe`,
	`${getEnvVar('PROGRAMFILES(X86)')}\\Microsoft\\Edge\\Application\\msedge.exe`,
	`${getEnvVar('LOCALAPPDATA')}\\Microsoft\\Edge\\Application\\msedge.exe`,
];

function assertDesktopExport(): void {
	if (!Platform.isDesktop) {
		throw new MarpCLIError('Export is only available on desktop Obsidian.');
	}
}

function getNodeFs(): NodeFsModule {
	assertDesktopExport();
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- Obsidian desktop export uses Node fs via require(); dynamic import() fails at runtime
	return require('node:fs') as NodeFsModule;
}

function getNodePath(): NodePathModule {
	assertDesktopExport();
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- Obsidian desktop export uses Node path via require(); dynamic import() fails at runtime
	return require('node:path') as NodePathModule;
}

function getNodeChildProcess(): NodeChildProcessModule {
	assertDesktopExport();
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- Obsidian desktop export uses Node child_process via require(); dynamic import() fails at runtime
	return require('node:child_process') as NodeChildProcessModule;
}

class MarpCliProcessError extends Error {
	constructor(
		message: string,
		readonly executable: string,
		readonly args: string[],
		readonly exitCode: number | null,
		readonly code: string | number | undefined,
		readonly stdout: string,
		readonly stderr: string,
		readonly isNpxFallback: boolean,
	) {
		super(message);
		this.name = 'MarpCliProcessError';
	}
}

function getMarpCliExecutableNames(): string[] {
	return process.platform === 'win32'
		? ['marp.cmd', 'marp.exe', 'marp']
		: [DEFAULT_MARP_CLI_COMMAND];
}

function getNpxExecutableNames(): string[] {
	return process.platform === 'win32'
		? ['npx.cmd', 'npx.exe', 'npx']
		: ['npx'];
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function getPathSearchDirectories(path: NodePathModule): string[] {
	return uniqueStrings([
		...getEnvVar('PATH').split(path.delimiter),
		...(process.platform === 'win32' ? [] : COMMON_MARP_CLI_DIRECTORIES),
	]);
}

function isExecutableFile(fs: NodeFsModule, path: string): boolean {
	try {
		fs.accessSync(path, fs.constants.X_OK);
		return true;
	} catch {
		return false;
	}
}

function detectExecutablePath(executableNames: string[]): string | null {
	const fs = getNodeFs();
	const path = getNodePath();
	const directories = getPathSearchDirectories(path);

	for (const directory of directories) {
		for (const executableName of executableNames) {
			const executablePath = path.join(directory, executableName);
			if (isExecutableFile(fs, executablePath)) {
				return executablePath;
			}
		}
	}

	return null;
}

export function detectMarpCliPath(): string | null {
	return detectExecutablePath(getMarpCliExecutableNames());
}

function getBrowserExecutableNames(): string[] {
	if (process.platform === 'win32') {
		return ['chrome.exe', 'msedge.exe', 'chromium.exe'];
	}

	return [
		'google-chrome',
		'google-chrome-stable',
		'chromium',
		'chromium-browser',
		'microsoft-edge',
		'microsoft-edge-stable',
		'chrome',
		'msedge',
	];
}

export function detectBrowserPath(): string | null {
	const pathExecutable = detectExecutablePath(getBrowserExecutableNames());
	if (pathExecutable) {
		return pathExecutable;
	}

	const fs = getNodeFs();
	const platformPaths = process.platform === 'darwin'
		? COMMON_DARWIN_BROWSER_PATHS
		: process.platform === 'win32'
			? COMMON_WINDOWS_BROWSER_PATHS
			: [];

	for (const browserPath of uniqueStrings(platformPaths)) {
		if (isExecutableFile(fs, browserPath)) {
			return browserPath;
		}
	}

	return null;
}

function getNpxExecutable(): string {
	return detectExecutablePath(getNpxExecutableNames()) ?? (process.platform === 'win32' ? 'npx.cmd' : 'npx');
}

function getPrimaryMarpCliInvocation(settings: MarpExtendedSettings): MarpCliInvocation {
	const configuredPath = settings.MARP_CLI_PATH.trim();
	const detectedPath = configuredPath ? null : detectMarpCliPath();
	const executable = configuredPath || detectedPath || DEFAULT_MARP_CLI_COMMAND;
	return {
		executable,
		argsPrefix: [],
		isNpxFallback: false,
	};
}

function getNpxMarpCliInvocation(): MarpCliInvocation {
	return {
		executable: getNpxExecutable(),
		argsPrefix: ['--yes', '--package', NPX_MARP_CLI_PACKAGE, DEFAULT_MARP_CLI_COMMAND],
		isNpxFallback: true,
	};
}

function shouldUseNpxFallback(settings: MarpExtendedSettings, args: string[], error: MarpCliProcessError): boolean {
	if (!settings.MARP_CLI_USE_NPX || settings.MARP_CLI_PATH.trim().length > 0 || error.isNpxFallback) {
		return false;
	}

	if (isMissingExecutable(error)) {
		return true;
	}

	const isBrowserBackedExport = args.includes('--pdf') || args.includes('--pptx');
	return isBrowserBackedExport && isMissingBrowserError(getMarpCliOutput(error));
}

function getMarpCliEnvironment(settings: MarpExtendedSettings): Record<string, string> {
	const p = (typeof window !== 'undefined' ? (window as Window & { process?: { env?: Record<string, string> } }).process : undefined) ?? (typeof process !== 'undefined' ? process : undefined);
	const envCopy: Record<string, string> = {};
	const env = p ? p['env'] : undefined;
	if (env) {
		for (const key of Object.keys(env)) {
			envCopy[key] = env[key] ?? '';
		}
	}
	// Obsidian launched from Finder/Dock inherits launchd's default PATH, which usually
	// excludes Homebrew. The npm-installed `marp` is a `#!/usr/bin/env node`
	// script, so it dies with `env: node: No such file or directory` (exit 127)
	// even though the executable itself was located successfully above. Forward
	// the same fallback directories used for discovery so the child process can
	// resolve its interpreter.
	const path = getNodePath();
	const searchDirectories = getPathSearchDirectories(path);
	if (searchDirectories.length > 0) {
		envCopy.PATH = searchDirectories.join(path.delimiter);
	}
	if (settings.CHROME_PATH.trim()) {
		envCopy.CHROME_PATH = settings.CHROME_PATH.trim();
	}
	return envCopy;
}

function toOutputText(output: string | Buffer | undefined): string {
	if (output == null) {
		return '';
	}
	return Buffer.isBuffer(output) ? output.toString('utf-8') : output;
}

function getExecErrorExitCode(error: MarpCliExecError): number | null {
	return typeof error.code === 'number' ? error.code : null;
}

function escapeWindowsCommand(command: string): string {
	return command.replace(WINDOWS_CMD_META_CHARACTER_PATTERN, '^$1');
}

function escapeWindowsArgument(argument: string, doubleEscapeMetaCharacters: boolean): string {
	let escaped = argument
		.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"')
		.replace(/(?=(\\+?)?)\1$/, '$1$1');
	escaped = `"${escaped}"`.replace(WINDOWS_CMD_META_CHARACTER_PATTERN, '^$1');
	return doubleEscapeMetaCharacters
		? escaped.replace(WINDOWS_CMD_META_CHARACTER_PATTERN, '^$1')
		: escaped;
}

function getSpawnInvocation(executable: string, args: string[]): {
	executable: string;
	args: string[];
	windowsVerbatimArguments?: boolean;
} {
	if (process.platform !== 'win32' || !WINDOWS_COMMAND_SCRIPT_PATTERN.test(executable)) {
		return { executable, args };
	}

	const doubleEscapeMetaCharacters = WINDOWS_NODE_MODULES_CMD_SHIM_PATTERN.test(executable);
	const shellCommand = [
		escapeWindowsCommand(executable),
		...args.map((argument) => escapeWindowsArgument(argument, doubleEscapeMetaCharacters)),
	].join(' ');
	return {
		executable: getEnvVar('COMSPEC') || 'cmd.exe',
		args: ['/d', '/s', '/c', `"${shellCommand}"`],
		windowsVerbatimArguments: true,
	};
}

function execMarpCli(
	invocation: MarpCliInvocation,
	args: string[],
	settings: MarpExtendedSettings,
): Promise<MarpCliExecResult> {
	const { spawn } = getNodeChildProcess();
	const commandArgs = [...invocation.argsPrefix, ...args];
	const spawnInvocation = getSpawnInvocation(invocation.executable, commandArgs);
	return new Promise((resolve, reject) => {
		const child = spawn(spawnInvocation.executable, spawnInvocation.args, {
			env: getMarpCliEnvironment(settings),
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
			windowsVerbatimArguments: spawnInvocation.windowsVerbatimArguments,
		});
		let stdoutText = '';
		let stderrText = '';
		let settled = false;

		const rejectOnce = (
			message: string,
			exitCode: number | null,
			code: string | number | undefined,
		): void => {
			if (settled) {
				return;
			}
			settled = true;
			reject(new MarpCliProcessError(
				message,
				invocation.executable,
				commandArgs,
				exitCode,
				code,
				stdoutText,
				stderrText,
				invocation.isNpxFallback,
			));
		};

		const appendOutput = (target: 'stdout' | 'stderr', output: string | Buffer): void => {
			if (target === 'stdout') {
				stdoutText += toOutputText(output);
			} else {
				stderrText += toOutputText(output);
			}

			if (stdoutText.length + stderrText.length > MARP_CLI_MAX_BUFFER) {
				child.kill();
				rejectOnce('Marp CLI output exceeded the maximum buffer size.', null, 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER');
			}
		};

		child.stdout?.on('data', (output: string | Buffer) => appendOutput('stdout', output));
		child.stderr?.on('data', (output: string | Buffer) => appendOutput('stderr', output));
		child.on('error', (error: MarpCliExecError) => {
			rejectOnce(error.message, getExecErrorExitCode(error), error.code);
		});
		child.on('close', (exitCode: number | null, signal: NodeJS.Signals | null) => {
			if (settled) {
				return;
			}
			settled = true;

			if (exitCode === 0) {
				resolve({ stdout: stdoutText, stderr: stderrText });
				return;
			}

			reject(new MarpCliProcessError(
				signal ? `Marp CLI was terminated by ${signal}.` : `Marp CLI exited with status ${String(exitCode ?? 'unknown')}.`,
				invocation.executable,
				commandArgs,
				exitCode,
				exitCode ?? signal ?? undefined,
				stdoutText,
				stderrText,
				invocation.isNpxFallback,
			));
		});
	});
}

function getMarpCliOutput(error: MarpCliProcessError): string {
	return [error.stderr, error.stdout].filter((output) => output.trim().length > 0).join('\n').trim();
}

function parseMarpCliVersion(output: string): string | null {
	const packageVersion = output.match(/@marp-team\/marp-cli\s+v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/i);
	if (packageVersion) {
		return packageVersion[1];
	}

	return output.match(/^\s*v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:\s|$)/)?.[1] ?? null;
}

function isMissingExecutable(error: MarpCliProcessError): boolean {
	return error.code === 'ENOENT';
}

function isMissingNodeError(error: MarpCliProcessError): boolean {
	// A `#!/usr/bin/env node` shebang that cannot resolve `node` fails inside
	// /usr/bin/env, so the child dies with exit status 127 instead of raising
	// ENOENT, and the generic "Marp CLI failed" message gives no useful hint.
	return error.exitCode === 127;
}

function isMissingBrowserError(output: string): boolean {
	return /NOT_FOUND_CHROMIUM|could not find.*(?:chrome|chromium|edge)|no .*browser|no usable sandbox|install .*chrome|chromium.*not found/i.test(output);
}

function toUserFacingCliError(error: MarpCliProcessError): MarpCLIError {
	if (isMissingExecutable(error)) {
		if (error.isNpxFallback) {
			return new MarpCLIError(`npx executable was not found. ${MISSING_NPX_INSTALL_HINT} Tried: ${error.executable}`);
		}
		return new MarpCLIError(`Marp CLI executable was not found. ${MISSING_MARP_CLI_INSTALL_HINT} Tried: ${error.executable}`);
	}

	const output = getMarpCliOutput(error);
	if (isMissingNodeError(error)) {
		const suffix = output ? `\n\n${output}` : '';
		return new MarpCLIError(`Marp CLI could not run because \`node\` was not found in its PATH (exit status 127). Obsidian inherits PATH from launchd when launched from Finder or the Dock, which usually omits Homebrew. Reinstall Node.js into a directory on the system PATH, or set the Marp CLI path to a wrapper script that invokes Node with an absolute path.${suffix}`);
	}
	
	if (isMissingBrowserError(output)) {
		const suffix = output ? `\n\n${output}` : '';
		return new MarpCLIError(`Marp CLI could not find Chrome, Chromium, or Microsoft Edge. Install a supported browser or set CHROME_PATH in Marp Extended settings.${suffix}`);
	}

	const status = error.exitCode == null ? `error code ${String(error.code ?? 'unknown')}` : `exit status ${error.exitCode}`;
	const suffix = output ? `\n\n${output}` : '';
	return new MarpCLIError(`Marp CLI failed with ${status}.${suffix}`);
}

async function execMarpCliWithFallback(
	settings: MarpExtendedSettings,
	args: string[],
): Promise<MarpCliExecResult> {
	const primaryInvocation = getPrimaryMarpCliInvocation(settings);
	try {
		return await execMarpCli(primaryInvocation, args, settings);
	} catch (error) {
		if (!(error instanceof MarpCliProcessError)) {
			throw error;
		}

		if (!shouldUseNpxFallback(settings, args, error)) {
			throw toUserFacingCliError(error);
		}

		try {
			return await execMarpCli(getNpxMarpCliInvocation(), args, settings);
		} catch (fallbackError) {
			if (fallbackError instanceof MarpCliProcessError) {
				throw toUserFacingCliError(fallbackError);
			}

			throw fallbackError;
		}
	}
}

function getMarpCliValidationCacheKey(settings: MarpExtendedSettings): string {
	return `${settings.MARP_CLI_PATH.trim()}\0${settings.MARP_CLI_USE_NPX ? '1' : '0'}`;
}

async function getValidatedMarpCliInvocation(settings: MarpExtendedSettings): Promise<MarpCliInvocation> {
	const cacheKey = getMarpCliValidationCacheKey(settings);
	const cachedInvocation = marpCliValidationCache.get(cacheKey);
	if (cachedInvocation) {
		return cachedInvocation;
	}

	const primary = getPrimaryMarpCliInvocation(settings);
	let invocation = primary;
	try {
		const versionResult = await execMarpCli(primary, ['--version'], settings);
		const versionOutput = (versionResult.stdout || versionResult.stderr).trim();
		const version = parseMarpCliVersion(versionOutput);
		if (version !== SUPPORTED_MARP_CLI_VERSION) {
			if (settings.MARP_CLI_PATH.trim()) {
				throw new MarpCLIError(`Configured Marp CLI version ${version ?? (versionOutput || 'unknown')} is incompatible; Marp Extended requires exactly ${SUPPORTED_MARP_CLI_VERSION}.`);
			}
			if (!settings.MARP_CLI_USE_NPX) {
				throw new MarpCLIError(`Detected Marp CLI version ${version ?? (versionOutput || 'unknown')} is incompatible; enable the pinned npx fallback (${SUPPORTED_MARP_CLI_VERSION}).`);
			}
			invocation = getNpxMarpCliInvocation();
		}
	} catch (error) {
		if (error instanceof MarpCLIError) throw error;
		if (!(error instanceof MarpCliProcessError)) throw error;
		if (!settings.MARP_CLI_USE_NPX || settings.MARP_CLI_PATH.trim()) throw toUserFacingCliError(error);
		invocation = getNpxMarpCliInvocation();
	}

	// Only successful decisions are cached so a user can fix a CLI error without reloading Obsidian.
	marpCliValidationCache.set(cacheKey, invocation);
	return invocation;
}

export function clearMarpCliVersionCache(): void {
	marpCliValidationCache.clear();
}

export async function getMarpCliVersion(settings: MarpExtendedSettings): Promise<string> {
	const result = await execMarpCliWithFallback(settings, ['--version']);
	return (result.stdout || result.stderr).trim();
}

export async function runMarpCli(settings: MarpExtendedSettings, args: string[]): Promise<void> {
	const invocation = await getValidatedMarpCliInvocation(settings);

	try {
		await execMarpCli(invocation, args, settings);
	} catch (error) {
		if (!(error instanceof MarpCliProcessError)) throw error;
		if (invocation.isNpxFallback || !shouldUseNpxFallback(settings, args, error)) throw toUserFacingCliError(error);
		await execMarpCli(getNpxMarpCliInvocation(), args, settings).catch((fallbackError: unknown) => {
			throw fallbackError instanceof MarpCliProcessError ? toUserFacingCliError(fallbackError) : fallbackError;
		});
	}
}
