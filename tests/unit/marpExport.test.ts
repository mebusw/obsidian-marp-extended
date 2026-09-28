import { spawn } from 'node:child_process';
import { App, Notice, TFile } from 'obsidian';
import { expect, jest, test, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename as pathBasename, dirname, join } from 'node:path';

import { MarpCLIError, MarpExport, exportWithNotice } from '@/utilities/marpExport';
import packageMetadata from '../../package.json';
import { DEFAULT_SETTINGS } from '@/utilities/settings';

type MarpExtendedPackageMetadata = {
	marpExtended: {
		npxMarpCliPackage: string;
	};
};

const NPX_MARP_CLI_PACKAGE = (packageMetadata as MarpExtendedPackageMetadata).marpExtended.npxMarpCliPackage;

jest.mock('node:child_process', () => ({
	spawn: jest.fn(),
}));

type SpawnError = Error & { code?: string | number };
type MockChildProcess = EventEmitter & {
	stdout: EventEmitter;
	stderr: EventEmitter;
	kill: jest.MockedFunction<() => boolean>;
};
type SpawnMock = jest.MockedFunction<(
	executable: string,
	args: string[],
	options: Record<string, unknown>,
) => MockChildProcess>;

const spawnMock = spawn as unknown as SpawnMock;

type TestElectronRequire = (moduleName: string) => {
	remote?: {
		dialog?: {
			showSaveDialog?: (options: unknown) => Promise<{ canceled: boolean; filePath?: string }>;
		};
	};
};

type TestWindow = Window & { require?: TestElectronRequire };
const tempDirectories: string[] = [];

function createMockChildProcess(result: {
	error?: SpawnError;
	exitCode?: number | null;
	signal?: NodeJS.Signals | null;
	stdout?: string;
	stderr?: string;
} = {}): MockChildProcess {
	const child = new EventEmitter() as MockChildProcess;
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();
	child.kill = jest.fn(() => true);

	process.nextTick(() => {
		if (result.stdout) {
			child.stdout.emit('data', result.stdout);
		}
		if (result.stderr) {
			child.stderr.emit('data', result.stderr);
		}
		if (result.error) {
			child.emit('error', result.error);
			return;
		}

		child.emit('close', result.exitCode ?? 0, result.signal ?? null);
	});

	return child;
}

function mockCliSuccess(stdout = '', stderr = ''): void {
	spawnMock.mockImplementation((_executable, args) => createMockChildProcess({
		stdout: args[args.length - 1] === '--version' ? (stdout || '4.5.1\n') : stdout,
		stderr,
	}));
}

function getLastCliExecutable(): string {
	return spawnMock.mock.calls[spawnMock.mock.calls.length - 1][0];
}

function getLastCliArgs(): string[] {
	return spawnMock.mock.calls[spawnMock.mock.calls.length - 1][1];
}

function getLastCliOptions(): Record<string, unknown> {
	return spawnMock.mock.calls[spawnMock.mock.calls.length - 1][2];
}

function expectMarpExecutable(executable: string): void {
	expect(executable).toMatch(/(?:^|[/\\])marp(?:\.cmd|\.exe)?$/);
}

function expectNpxExecutable(executable: string): void {
	expect(executable).toMatch(/(?:^|[/\\])npx(?:\.cmd|\.exe)?$/);
}

function createFile(): TFile {
	const file = new TFile() as TFile & {
		basename: string;
		name: string;
		vault: TFile['vault'] & { configDir: string };
	};

	file.path = 'slides/deck.md';
	file.name = 'deck.md';
	file.basename = 'deck';
	file.parent = { path: 'slides' } as TFile['parent'];
	file.vault.configDir = '.obsidian';
	void file.vault.adapter.write('vault', '');

	return file;
}

function createDiskBackedFile(root: string, markdownPath: string, content: string): TFile {
	const file = new TFile() as TFile & {
		basename: string;
		name: string;
		vault: TFile['vault'] & { configDir: string };
	};
	const parentPath = dirname(markdownPath);
	const sourcePath = join(root, markdownPath);

	mkdirSync(join(root, parentPath), { recursive: true });
	writeFileSync(sourcePath, content, 'utf-8');
	file.path = markdownPath;
	file.name = pathBasename(markdownPath);
	file.basename = file.name.replace(/\.md$/i, '');
	file.parent = { path: parentPath === '.' ? '' : parentPath } as TFile['parent'];
	file.vault.configDir = '.obsidian';
	void file.vault.adapter.write(root, '');
	(file.vault.adapter as any).getFullPath = (path: string) => join(root, path);
	file.vault.cachedRead = async () => readFileSync(sourcePath, 'utf-8');

	return file;
}

function mockSaveDialog(result: { canceled: boolean; filePath?: string }) {
	const showSaveDialog = jest.fn(async (_options: unknown) => result);
	const electronRequire: TestElectronRequire = (moduleName: string) => {
		if (moduleName === 'electron') {
			return {
				remote: {
					dialog: { showSaveDialog },
				},
			};
		}

		throw new Error(`Unexpected module: ${moduleName}`);
	};
	(window as TestWindow).require = electronRequire;

	return showSaveDialog;
}

beforeEach(() => {
	MarpExport.clearCliVersionCache();
	spawnMock.mockReset();
	mockCliSuccess();
});

afterEach(() => {
	delete (window as TestWindow).require;
	for (const directory of tempDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('export selects a file and passes output path to external Marp CLI', async () => {
	const showSaveDialog = mockSaveDialog({ canceled: false, filePath: '/tmp/export/custom.pdf' });
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	await exporter.export(createFile(), 'pdf');

	expect(showSaveDialog).toHaveBeenCalledWith({
		title: 'Choose export file',
		defaultPath: 'vault/slides/deck.pdf',
		filters: [{ name: 'PDF', extensions: ['pdf'] }],
	});
	expect(spawnMock).toHaveBeenCalledTimes(2);
	expectMarpExecutable(getLastCliExecutable());
	expect(getLastCliArgs()).toEqual(expect.arrayContaining([
		'--pdf',
		'-o',
		'/tmp/export/custom.pdf',
	]));
	expect(getLastCliArgs()).toEqual(expect.arrayContaining(['--engine', expect.stringMatching(/marp-engine\.cjs$/), '--html']));
	expect(getLastCliOptions().stdio).toEqual(['ignore', 'pipe', 'pipe']);
});

test('export uses configured Marp CLI path when provided', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/custom.pdf' });
	const exporter = new MarpExport({
		...DEFAULT_SETTINGS,
		MARP_CLI_PATH: '/opt/homebrew/bin/marp',
	});

	await exporter.export(createFile(), 'pdf');

	expect(getLastCliExecutable()).toBe('/opt/homebrew/bin/marp');
});

test('export accepts the standard Marp CLI 4.5.1 version banner', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/custom.html' });
	mockCliSuccess('@marp-team/marp-cli v4.5.1 (w/ @marp-team/marp-core v4.4.0)\n');
	const exporter = new MarpExport({
		...DEFAULT_SETTINGS,
		MARP_CLI_PATH: '/opt/homebrew/bin/marp',
	});

	await exporter.export(createFile(), 'html');

	expect(spawnMock).toHaveBeenCalledTimes(2);
	expect(getLastCliExecutable()).toBe('/opt/homebrew/bin/marp');
});

test('export caches CLI version validation for unchanged settings and revalidates changed paths', async () => {
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	await exporter.export(createFile(), 'html');
	await exporter.export(createFile(), 'html');
	await new MarpExport({
		...DEFAULT_SETTINGS,
		MARP_CLI_PATH: '/opt/homebrew/bin/marp',
	}).export(createFile(), 'html');

	expect(spawnMock).toHaveBeenCalledTimes(5);
	expect(spawnMock.mock.calls.filter((call) => call[1].includes('--version'))).toHaveLength(2);
	expect(spawnMock.mock.calls[2][1]).not.toContain('--version');
	expect(spawnMock.mock.calls[3][1]).toEqual(['--version']);
});

test('export rejects an explicitly configured incompatible Marp CLI', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/custom.html' });
	mockCliSuccess('@marp-team/marp-cli v4.4.0 (w/ @marp-team/marp-core v4.4.0)\n');
	const exporter = new MarpExport({
		...DEFAULT_SETTINGS,
		MARP_CLI_PATH: '/opt/homebrew/bin/marp',
	});

	await expect(exporter.export(createFile(), 'html')).rejects.toThrow('requires exactly 4.5.1');
	await expect(exporter.export(createFile(), 'html')).rejects.toThrow('requires exactly 4.5.1');
	expect(spawnMock).toHaveBeenCalledTimes(2);
});

test('export replaces an incompatible auto-detected CLI with the pinned npx host', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/custom.html' });
	spawnMock
		.mockImplementationOnce(() => createMockChildProcess({
			stdout: '@marp-team/marp-cli v4.4.0 (w/ @marp-team/marp-core v4.4.0)\n',
		}))
		.mockImplementationOnce(() => createMockChildProcess());
	const exporter = new MarpExport({
		...DEFAULT_SETTINGS,
		MARP_CLI_USE_NPX: true,
	});

	await exporter.export(createFile(), 'html');

	expect(spawnMock).toHaveBeenCalledTimes(2);
	expectNpxExecutable(spawnMock.mock.calls[1][0]);
	expect(spawnMock.mock.calls[1][1]).toEqual(expect.arrayContaining([
		'--yes', '--package', NPX_MARP_CLI_PACKAGE, 'marp', '--engine',
	]));
});

test('Marp CLI version check runs the configured executable', async () => {
	mockCliSuccess('4.4.0\n');

	const version = await MarpExport.getCliVersion({
		...DEFAULT_SETTINGS,
		MARP_CLI_PATH: '/usr/local/bin/marp',
	});

	expect(version).toBe('4.4.0');
	expect(getLastCliExecutable()).toBe('/usr/local/bin/marp');
	expect(getLastCliArgs()).toEqual(['--version']);
});

test('browser auto-detect finds an executable on PATH', () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-browser-path-'));
	tempDirectories.push(root);
	const executableName = process.platform === 'win32' ? 'chrome.exe' : 'google-chrome';
	const executablePath = join(root, executableName);
	const previousPath = process.env.PATH;
	writeFileSync(executablePath, '');
	chmodSync(executablePath, 0o755);
	process.env.PATH = previousPath ? `${root}${process.platform === 'win32' ? ';' : ':'}${previousPath}` : root;

	try {
		expect(MarpExport.detectBrowserPath()).toBe(executablePath);
	} finally {
		process.env.PATH = previousPath;
	}
});

test('Marp CLI version check explains missing executable errors', async () => {
	spawnMock.mockImplementationOnce(() => createMockChildProcess({
		error: Object.assign(new Error('spawn marp ENOENT'), { code: 'ENOENT' }),
	}));

	await expect(MarpExport.getCliVersion(DEFAULT_SETTINGS)).rejects.toThrow('Install it with `npm install -g @marp-team/marp-cli`');
});

test('export can fall back to npx when auto-detected Marp CLI is missing', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/deck.html' });
	spawnMock
		.mockImplementationOnce(() => createMockChildProcess({
			error: Object.assign(new Error('spawn marp ENOENT'), { code: 'ENOENT' }),
		}))
		.mockImplementationOnce(() => createMockChildProcess());
	const exporter = new MarpExport({
		...DEFAULT_SETTINGS,
		MARP_CLI_USE_NPX: true,
	});

	await exporter.export(createFile(), 'html');

	expect(spawnMock).toHaveBeenCalledTimes(2);
	expectNpxExecutable(spawnMock.mock.calls[1][0]);
	expect(spawnMock.mock.calls[1][1]).toEqual(expect.arrayContaining([
		'--yes',
		'--package',
		NPX_MARP_CLI_PACKAGE,
		'marp',
		'--html',
		'-o',
		'/tmp/export/deck.html',
	]));
});

test('configured Marp CLI path does not fall back to npx when missing', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/deck.html' });
	spawnMock.mockImplementationOnce(() => createMockChildProcess({
		error: Object.assign(new Error('spawn /missing/marp ENOENT'), { code: 'ENOENT' }),
	}));
	const exporter = new MarpExport({
		...DEFAULT_SETTINGS,
		MARP_CLI_PATH: '/missing/marp',
		MARP_CLI_USE_NPX: true,
	});

	await expect(exporter.export(createFile(), 'html')).rejects.toThrow('Tried: /missing/marp');
	expect(spawnMock).toHaveBeenCalledTimes(1);
});

test('Marp CLI version check can fall back to npx', async () => {
	spawnMock
		.mockImplementationOnce(() => createMockChildProcess({
			error: Object.assign(new Error('spawn marp ENOENT'), { code: 'ENOENT' }),
		}))
		.mockImplementationOnce(() => createMockChildProcess({ stdout: '4.4.0\n' }));

	const version = await MarpExport.getCliVersion({
		...DEFAULT_SETTINGS,
		MARP_CLI_USE_NPX: true,
	});

	expect(version).toBe('4.4.0');
	expect(spawnMock).toHaveBeenCalledTimes(2);
	expectNpxExecutable(spawnMock.mock.calls[1][0]);
	expect(spawnMock.mock.calls[1][1]).toEqual(['--yes', '--package', NPX_MARP_CLI_PACKAGE, 'marp', '--version']);
});

test('Windows npx fallback runs command scripts through cmd.exe', async () => {
	const platform = Object.getOwnPropertyDescriptor(process, 'platform');
	const previousComspec = process.env.COMSPEC;
	const previousPath = process.env.PATH;
	Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' });
	process.env.COMSPEC = 'C:\\Windows\\System32\\cmd.exe';
	process.env.PATH = 'C:\\missing';
	spawnMock
		.mockImplementationOnce(() => createMockChildProcess({
			error: Object.assign(new Error('spawn marp ENOENT'), { code: 'ENOENT' }),
		}))
		.mockImplementationOnce(() => createMockChildProcess({ stdout: '4.5.1\n' }));

	try {
		await expect(MarpExport.getCliVersion({
			...DEFAULT_SETTINGS,
			MARP_CLI_USE_NPX: true,
		})).resolves.toBe('4.5.1');

		expect(spawnMock.mock.calls[1][0]).toBe('C:\\Windows\\System32\\cmd.exe');
		expect(spawnMock.mock.calls[1][1].slice(0, 3)).toEqual(['/d', '/s', '/c']);
		expect(spawnMock.mock.calls[1][1][3]).toContain('npx.cmd');
		expect(spawnMock.mock.calls[1][1][3]).toContain(NPX_MARP_CLI_PACKAGE);
		expect(spawnMock.mock.calls[1][2].windowsVerbatimArguments).toBe(true);
	} finally {
		if (platform) Object.defineProperty(process, 'platform', platform);
		if (previousComspec === undefined) delete process.env.COMSPEC;
		else process.env.COMSPEC = previousComspec;
		if (previousPath === undefined) delete process.env.PATH;
		else process.env.PATH = previousPath;
	}
});

test('Windows configured command script escapes paths and arguments for cmd.exe', async () => {
	const platform = Object.getOwnPropertyDescriptor(process, 'platform');
	Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' });
	spawnMock.mockImplementation(() => createMockChildProcess({ stdout: '4.5.1\n' }));
	mockSaveDialog({ canceled: false, filePath: 'C:\\Exports & Reviews\\deck.html' });

	try {
		await new MarpExport({
			...DEFAULT_SETTINGS,
			MARP_CLI_PATH: 'C:\\Program Files\\Marp & Tools\\marp.cmd',
		}).export(createFile(), 'html');

		expect(getLastCliExecutable()).toBe(process.env.COMSPEC || 'cmd.exe');
		expect(getLastCliArgs().slice(0, 3)).toEqual(['/d', '/s', '/c']);
		expect(getLastCliArgs()[3]).toContain('C:\\Program^ Files\\Marp^ ^&^ Tools\\marp.cmd');
		expect(getLastCliArgs()[3]).toContain('^"C:\\Exports^ ^&^ Reviews\\deck.html^"');
		expect(getLastCliOptions().windowsVerbatimArguments).toBe(true);
	} finally {
		if (platform) Object.defineProperty(process, 'platform', platform);
	}
});

test('export cancellation does not run Marp CLI', async () => {
	mockSaveDialog({ canceled: true });
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	await exporter.export(createFile(), 'pptx');

	expect(spawnMock).not.toHaveBeenCalled();
});

test('HTML export uses Bespoke template and selected output file', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/custom.html' });
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	await exporter.export(createFile(), 'html');

	expect(getLastCliArgs()).toEqual(expect.arrayContaining([
		'--html',
		'--template',
		'bespoke',
		'-o',
		'/tmp/export/custom.html',
	]));
});

test('preview uses a managed temporary source and removes the generated HTML when Marp CLI exits', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-preview-temp-source-'));
	tempDirectories.push(root);
	const file = createDiskBackedFile(root, 'slides/deck.md', '# Deck\n');
	let temporarySourcePath = '';
	let temporaryHtmlPath = '';

	spawnMock.mockImplementation((_executable, args) => {
		if (args[args.length - 1] === '--version') return createMockChildProcess({ stdout: '4.5.1\n' });
		temporarySourcePath = args[0];
		temporaryHtmlPath = temporarySourcePath.replace(/\.md$/i, '.html');
		writeFileSync(temporaryHtmlPath, '<html></html>', 'utf-8');
		return createMockChildProcess();
	});

	const app = {
		vault: file.vault,
		metadataCache: {
			getFileCache: jest.fn(() => ({ frontmatter: {} })),
			getFirstLinkpathDest: jest.fn(() => null),
		},
	} as unknown as App;
	const exporter = new MarpExport(DEFAULT_SETTINGS, app, '.obsidian/plugins/marp-extended');

	await exporter.export(file, 'preview');

	expect(temporarySourcePath).toMatch(/[/\\]\.deck\.marp-export-\d+-[0-9a-z]+-[0-9a-z]+\.md$/i);
	expect(getLastCliArgs()).toContain('--preview');
	expect(existsSync(temporarySourcePath)).toBe(false);
	expect(existsSync(temporaryHtmlPath)).toBe(false);
	expect(existsSync(join(root, 'slides/deck.html'))).toBe(false);
});

test('preview removes its temporary Markdown and HTML when Marp CLI fails', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-preview-failure-'));
	tempDirectories.push(root);
	const file = createDiskBackedFile(root, 'slides/deck.md', '# Deck\n');
	let temporarySourcePath = '';
	let temporaryHtmlPath = '';

	spawnMock
		.mockImplementationOnce(() => createMockChildProcess({ stdout: '4.5.1\n' }))
		.mockImplementationOnce((_executable, args) => {
			temporarySourcePath = args[0];
			temporaryHtmlPath = temporarySourcePath.replace(/\.md$/i, '.html');
			writeFileSync(temporaryHtmlPath, '<html></html>', 'utf-8');
			return createMockChildProcess({ exitCode: 1, stderr: 'preview failed' });
		});

	const app = {
		vault: file.vault,
		metadataCache: {
			getFileCache: jest.fn(() => ({ frontmatter: {} })),
			getFirstLinkpathDest: jest.fn(() => null),
		},
	} as unknown as App;
	const exporter = new MarpExport(DEFAULT_SETTINGS, app, '.obsidian/plugins/marp-extended');

	await expect(exporter.export(file, 'preview')).rejects.toThrow('preview failed');
	expect(existsSync(temporarySourcePath)).toBe(false);
	expect(existsSync(temporaryHtmlPath)).toBe(false);
});

test('historical cleanup recursively removes only managed temporary files older than 24 hours', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-historical-cleanup-'));
	tempDirectories.push(root);
	const nested = join(root, 'slides', 'nested');
	const oldMarkdown = join(nested, '.deck.marp-export-123-labcde-random.md');
	const oldHtml = join(root, '.root-deck.marp-export-456-lfghij-other.html');
	const freshHtml = join(nested, '.fresh.marp-export-789-lklmno-recent.html');
	const similarUserFile = join(nested, '.deck.marp-export-not-managed.html');
	const oldDate = new Date(Date.now() - (25 * 60 * 60 * 1000));

	mkdirSync(nested, { recursive: true });
	for (const path of [oldMarkdown, oldHtml, freshHtml, similarUserFile]) {
		writeFileSync(path, 'temporary', 'utf-8');
	}
	utimesSync(oldMarkdown, oldDate, oldDate);
	utimesSync(oldHtml, oldDate, oldDate);
	utimesSync(similarUserFile, oldDate, oldDate);

	const file = createDiskBackedFile(root, 'deck.md', '# Deck\n');
	const app = { vault: file.vault } as unknown as App;

	const result = await MarpExport.removeHistoricalTemporaryFiles(app);

	expect(result).toEqual({ removed: 2, failed: 0 });
	expect(existsSync(oldMarkdown)).toBe(false);
	expect(existsSync(oldHtml)).toBe(false);
	expect(existsSync(freshHtml)).toBe(true);
	expect(existsSync(similarUserFile)).toBe(true);
});

test('export removes stale managed files from the source directory but keeps recent files', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-local-cleanup-'));
	tempDirectories.push(root);
	const file = createDiskBackedFile(root, 'slides/deck.md', '# Deck\n');
	const oldHtml = join(root, 'slides/.old.marp-export-123-labcde-random.html');
	const freshMarkdown = join(root, 'slides/.fresh.marp-export-456-lfghij-recent.md');
	const oldDate = new Date(Date.now() - (25 * 60 * 60 * 1000));

	writeFileSync(oldHtml, '<html></html>', 'utf-8');
	writeFileSync(freshMarkdown, '# Temporary', 'utf-8');
	utimesSync(oldHtml, oldDate, oldDate);
	mockSaveDialog({ canceled: false, filePath: join(root, 'deck.html') });

	const app = {
		vault: file.vault,
		metadataCache: {
			getFileCache: jest.fn(() => ({ frontmatter: {} })),
			getFirstLinkpathDest: jest.fn(() => null),
		},
	} as unknown as App;
	const exporter = new MarpExport(DEFAULT_SETTINGS, app, '.obsidian/plugins/marp-extended');

	await exporter.export(file, 'html');

	expect(existsSync(oldHtml)).toBe(false);
	expect(existsSync(freshMarkdown)).toBe(true);
});

test('export converts wiki-links through a temporary markdown file without changing the source file', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-export-temp-source-'));
	tempDirectories.push(root);
	const originalContent = '# Deck\n\n![[image.png|Alt text]]\n';
	const file = createDiskBackedFile(root, 'slides/deck.md', originalContent);
	const exportDirectory = join(root, 'exports');
	const sourcePath = join(root, 'slides/deck.md');
	const linkedImage = new TFile() as TFile & { path: string };
	let temporarySourcePath = '';

	mkdirSync(exportDirectory, { recursive: true });
	linkedImage.path = 'assets/image.png';
	mockSaveDialog({ canceled: false, filePath: join(exportDirectory, 'deck.pdf') });
	spawnMock.mockImplementation((_executable, args) => {
		if (args[args.length - 1] === '--version') return createMockChildProcess({ stdout: '4.5.1\n' });
		temporarySourcePath = args[0];
		expect(temporarySourcePath).not.toBe(sourcePath);
		expect(dirname(temporarySourcePath)).toBe(dirname(sourcePath));
		expect(readFileSync(temporarySourcePath, 'utf-8')).toContain('![Alt text](../assets/image.png)');
		expect(readFileSync(sourcePath, 'utf-8')).toBe(originalContent);

		return createMockChildProcess();
	});

	const app = {
		vault: file.vault,
		metadataCache: {
			getFirstLinkpathDest: jest.fn(() => linkedImage),
		},
	} as unknown as App;
	const exporter = new MarpExport(DEFAULT_SETTINGS, app, '.obsidian/plugins/marp-extended');

	const outputPath = await exporter.export(file, 'pdf-with-notes');

	expect(outputPath).toBe(join(exportDirectory, 'deck.pdf'));
	expect(getLastCliArgs()).toEqual(expect.arrayContaining([
		'--pdf-notes',
		'--pdf-outlines',
	]));
	expect(temporarySourcePath).not.toBe('');
	expect(existsSync(temporarySourcePath)).toBe(false);
	expect(readFileSync(sourcePath, 'utf-8')).toBe(originalContent);
});

test('export injects selected Mermaid theme CSS and flat mode into the temporary markdown file', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-export-mermaid-theme-'));
	tempDirectories.push(root);
	const originalContent = '---\ntheme: kami\nmermaidTheme: accent\nmermaidFlat: true\n---\n\n```mermaid\nflowchart LR\n  A --> B\n```\n';
	const file = createDiskBackedFile(root, 'slides/deck.md', originalContent);
	const exportDirectory = join(root, 'exports');
	const mermaidThemeDirectory = join(root, '.marp-extended/mermaid-themes');
	let temporarySourcePath = '';

	mkdirSync(exportDirectory, { recursive: true });
	mkdirSync(mermaidThemeDirectory, { recursive: true });
	writeFileSync(join(mermaidThemeDirectory, 'accent.css'), '/* @mermaid-theme accent */\nsection .mermaid-diagram-container svg { --accent: pink !important; }', 'utf-8');
	(file.vault.adapter as any).exists = async (path: string) => existsSync(join(root, path));
	(file.vault.adapter as any).list = async (path: string) => ({
		files: [join(path, 'accent.css')],
		folders: [],
	});
	(file.vault.adapter as any).read = async (path: string) => readFileSync(join(root, path), 'utf-8');
	mockSaveDialog({ canceled: false, filePath: join(exportDirectory, 'deck.html') });
	spawnMock.mockImplementation((_executable, args) => {
		if (args[args.length - 1] === '--version') return createMockChildProcess({ stdout: '4.5.1\n' });
		temporarySourcePath = args[0];
		const processed = readFileSync(temporarySourcePath, 'utf-8');
		expect(processed).toMatch(/^---\ntheme: kami\nmermaidTheme: accent\nmermaidFlat: true\n---\s*<style class="marp-extended-mermaid-theme">/);
		expect(processed).toContain('class="marp-extended-mermaid-theme"');
		expect(processed).toContain('--accent: pink !important');
		expect(processed).toContain('background: transparent !important');
		expect(processed).toContain('svg .edge-label rect');
		expect(processed).toContain('fill: var(--surface, var(--bg)) !important');
		expect(processed).toContain('data-mermaid-renderer="beautiful-mermaid"');

		return createMockChildProcess();
	});

	const app = {
		vault: file.vault,
		metadataCache: {
			getFileCache: jest.fn(() => ({ frontmatter: { mermaidTheme: 'accent', mermaidFlat: true } })),
			getFirstLinkpathDest: jest.fn(() => null),
		},
	} as unknown as App;
	const exporter = new MarpExport(DEFAULT_SETTINGS, app, '.obsidian/plugins/marp-extended');

	await exporter.export(file, 'html');

	expect(temporarySourcePath).not.toBe('');
	expect(existsSync(temporarySourcePath)).toBe(false);
	expect(readFileSync(join(root, 'slides/deck.md'), 'utf-8')).toBe(originalContent);
});

test('export compiles Marp Extended comment markers in the temporary markdown file', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-export-extended-syntax-'));
	tempDirectories.push(root);
	const originalContent = [
		'---',
		'theme: kami',
		'---',
		'',
		'%%marp-slide[class=cover paginate=false]%%',
		'',
		'%%marp-columns%%',
		'### Left',
		'%%marp-column%%',
		'### Right',
		'%%/marp-columns%%',
	].join('\n');
	const file = createDiskBackedFile(root, 'slides/deck.md', originalContent);
	const exportDirectory = join(root, 'exports');
	let temporarySourcePath = '';

	mkdirSync(exportDirectory, { recursive: true });
	mockSaveDialog({ canceled: false, filePath: join(exportDirectory, 'deck.html') });
	spawnMock.mockImplementation((_executable, args) => {
		if (args[args.length - 1] === '--version') return createMockChildProcess({ stdout: '4.5.1\n' });
		temporarySourcePath = args[0];
		const processed = readFileSync(temporarySourcePath, 'utf-8');
		expect(processed).toContain('<!-- _class: cover -->');
		expect(processed).toContain('</style>\n<!-- _class: cover -->');
		expect(processed).toContain('<!-- _paginate: false -->');
		expect(processed).toContain('<div class="marp-extended-columns marp-extended-columns-2">');
		expect(processed).toContain(':where(a[href])');
		expect(processed).toContain('color: inherit');
		expect(processed).not.toContain('%%marp-slide');
		expect(processed).not.toContain('%%marp-columns');
		expect(processed).not.toContain('%%marp-column');

		return createMockChildProcess();
	});

	const app = {
		vault: file.vault,
		metadataCache: {
			getFileCache: jest.fn(() => ({ frontmatter: {} })),
			getFirstLinkpathDest: jest.fn(() => null),
		},
	} as unknown as App;
	const exporter = new MarpExport(DEFAULT_SETTINGS, app, '.obsidian/plugins/marp-extended');

	await exporter.export(file, 'html');

	expect(temporarySourcePath).not.toBe('');
	expect(existsSync(temporarySourcePath)).toBe(false);
	expect(readFileSync(join(root, 'slides/deck.md'), 'utf-8')).toBe(originalContent);
});

test('export uses the current editor markdown instead of stale vault content', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-export-editor-buffer-'));
	tempDirectories.push(root);
	const savedContent = '---\ntheme: kami\n---\n\n# Stale title\n';
	const editorContent = '---\ntheme: kami\n---\n\n%%marp-slide[class=cover]%%\n\n# Current title\n';
	const file = createDiskBackedFile(root, 'slides/deck.md', savedContent);
	let temporarySourcePath = '';

	mockSaveDialog({ canceled: false, filePath: join(root, 'deck.html') });
	spawnMock.mockImplementation((_executable, args) => {
		if (args[args.length - 1] === '--version') return createMockChildProcess({ stdout: '4.5.1\n' });
		temporarySourcePath = args[0];
		const processed = readFileSync(temporarySourcePath, 'utf-8');
		expect(processed).toContain('<!-- _class: cover -->');
		expect(processed).toContain('# Current title');
		expect(processed).not.toContain('# Stale title');

		return createMockChildProcess();
	});

	const app = {
		vault: file.vault,
		metadataCache: {
			getFileCache: jest.fn(() => ({ frontmatter: {} })),
			getFirstLinkpathDest: jest.fn(() => null),
		},
	} as unknown as App;
	const exporter = new MarpExport(DEFAULT_SETTINGS, app, '.obsidian/plugins/marp-extended');

	await exporter.export(file, 'html', editorContent);

	expect(temporarySourcePath).not.toBe('');
	expect(existsSync(temporarySourcePath)).toBe(false);
	expect(readFileSync(join(root, 'slides/deck.md'), 'utf-8')).toBe(savedContent);
});

test('export falls back to the source path when native save dialog is unavailable', async () => {
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	const outputPath = await exporter.export(createFile(), 'html');

	expect(outputPath).toBe('vault/slides/deck.html');
	expect(getLastCliArgs()).toEqual(expect.arrayContaining([
		'-o',
		'vault/slides/deck.html',
	]));
});

test('export passes configured browser path to Marp CLI arguments and environment', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/deck.pdf' });
	const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
	const exporter = new MarpExport({
		...DEFAULT_SETTINGS,
		CHROME_PATH: chromePath,
	});

	await exporter.export(createFile(), 'pdf');

	expect(getLastCliArgs()).toEqual(expect.arrayContaining([
		'--browser-path',
		chromePath,
	]));
	expect((getLastCliOptions().env as NodeJS.ProcessEnv).CHROME_PATH).toBe(chromePath);
});

test('export throws an actionable error when Marp CLI is missing', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/deck.html' });
	spawnMock.mockImplementationOnce(() => createMockChildProcess({
		error: Object.assign(new Error('spawn marp ENOENT'), { code: 'ENOENT' }),
	}));
	const exporter = new MarpExport(DEFAULT_SETTINGS);
	const exportPromise = exporter.export(createFile(), 'html');

	await expect(exportPromise).rejects.toThrow(MarpCLIError);
	await expect(exportPromise).rejects.toThrow('Install it with `npm install -g @marp-team/marp-cli`');
});

test('export throws when Marp CLI returns a failing exit status', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/deck.html' });
	spawnMock
		.mockImplementationOnce(() => createMockChildProcess({ stdout: '4.5.1\n' }))
		.mockImplementationOnce(() => createMockChildProcess({
			exitCode: 1,
			stdout: 'stdout details',
			stderr: 'stderr details',
		}));
	const exporter = new MarpExport(DEFAULT_SETTINGS);
	const exportPromise = exporter.export(createFile(), 'html');

	await expect(exportPromise).rejects.toThrow('exit status 1');
	await expect(exportPromise).rejects.toThrow('stderr details');
});

test('export explains missing browser errors from Marp CLI output', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/deck.pdf' });
	spawnMock
		.mockImplementationOnce(() => createMockChildProcess({ stdout: '4.5.1\n' }))
		.mockImplementationOnce(() => createMockChildProcess({
			exitCode: 1,
			stderr: 'NOT_FOUND_CHROMIUM',
		}));
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	await expect(exporter.export(createFile(), 'pdf')).rejects.toThrow('could not find Chrome, Chromium, or Microsoft Edge');
});


test('exportWithNotice warns when no active markdown file', async () => {
	const app = { workspace: { getActiveFile: () => null } } as unknown as App;

	await exportWithNotice(DEFAULT_SETTINGS, app, 'pdf', null);

	expect(Notice).toHaveBeenCalledWith('Open a Markdown file before exporting Marp slides.', 5000);
});

test('exportWithNotice shows progress then success notices when export returns a path', async () => {
	const file = createFile();
	const app = { workspace: { getActiveFile: () => file } } as unknown as App;
	const exportSpy = jest.spyOn(MarpExport.prototype, 'export').mockResolvedValue('/tmp/export/deck.pdf');

	await exportWithNotice(DEFAULT_SETTINGS, app, 'pdf', file);

	expect(exportSpy).toHaveBeenCalledWith(file, 'pdf', undefined);
	expect(Notice).toHaveBeenCalledWith('Exporting Marp slides as PDF…', 0);
	expect(Notice).toHaveBeenCalledWith('Exported Marp slides to /tmp/export/deck.pdf', 7000);

	exportSpy.mockRestore();
});

test('exportWithNotice hides progress and surfaces export errors', async () => {
	const file = createFile();
	const app = { workspace: { getActiveFile: () => file } } as unknown as App;
	const hide = jest.fn();
	(Notice as jest.Mock).mockImplementationOnce(() => ({ hide })).mockImplementation(() => ({ hide: jest.fn() }));
	const exportSpy = jest.spyOn(MarpExport.prototype, 'export').mockRejectedValue(new Error('disk full'));
	const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

	await exportWithNotice(DEFAULT_SETTINGS, app, 'html', file);

	expect(hide).toHaveBeenCalled();
	expect(Notice).toHaveBeenCalledWith('Marp export failed: disk full', 8000);
	expect(consoleError).toHaveBeenCalled();

	exportSpy.mockRestore();
	consoleError.mockRestore();
});

test('PDF export retries through npx when browser is missing and npx fallback is enabled', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/deck.pdf' });
	spawnMock
		.mockImplementationOnce(() => createMockChildProcess({
			stdout: '@marp-team/marp-cli v4.5.1 (w/ @marp-team/marp-core v4.4.0)\n',
		}))
		.mockImplementationOnce(() => createMockChildProcess({
			exitCode: 1,
			stderr: 'could not find chrome',
		}))
		.mockImplementationOnce(() => createMockChildProcess());
	const exporter = new MarpExport({
		...DEFAULT_SETTINGS,
		MARP_CLI_USE_NPX: true,
	});

	await exporter.export(createFile(), 'pdf');

	expect(spawnMock).toHaveBeenCalledTimes(3);
	expectMarpExecutable(spawnMock.mock.calls[1][0]);
	expect(spawnMock.mock.calls[1][1]).toEqual(expect.arrayContaining(['--pdf', '--engine']));
	expectNpxExecutable(spawnMock.mock.calls[2][0]);
	expect(spawnMock.mock.calls[2][1]).toEqual(expect.arrayContaining([
		'--yes',
		'--package',
		NPX_MARP_CLI_PACKAGE,
		'marp',
		'--pdf',
	]));
});

test('missing-browser stderr does not retry through npx when Marp CLI path is configured', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/deck.pdf' });
	spawnMock
		.mockImplementationOnce(() => createMockChildProcess({ stdout: '4.5.1\n' }))
		.mockImplementationOnce(() => createMockChildProcess({
			exitCode: 1,
			stderr: 'could not find chrome',
		}));
	const exporter = new MarpExport({
		...DEFAULT_SETTINGS,
		MARP_CLI_PATH: '/usr/local/bin/marp',
		MARP_CLI_USE_NPX: true,
	});

	await expect(exporter.export(createFile(), 'pdf')).rejects.toThrow('could not find Chrome');
	expect(spawnMock).toHaveBeenCalledTimes(2);
	expect(spawnMock.mock.calls[1][0]).toBe('/usr/local/bin/marp');
	expect(spawnMock.mock.calls[1][1]).toEqual(expect.arrayContaining(['--pdf', '--engine']));
});
