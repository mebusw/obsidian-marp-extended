import { Modal, Notice, PluginSettingTab, Setting, type App, type SettingDefinitionItem } from 'obsidian';

import packageMetadata from '../../package.json';
import type MarpExtended from '../main';
import { MarpExport } from '../utilities/marpExport';
import { MermaidThemeManager } from '../utilities/mermaidThemeManager';
import { ThemeManager } from '../utilities/themeManager';
import type { MarpExtendedSettings } from '../utilities/settings';
import type { InstalledThemeEntry } from '../utilities/vaultThemeManager';
import { VaultThemeManager } from '../utilities/vaultThemeManager';

const NPX_FALLBACK_DESCRIPTION = `If Marp CLI is not found and no path is set, run a pinned ${packageMetadata.marpExtended.npxMarpCliPackage} through npx when Marp CLI is not found or when a browser-backed export fails without an explicit CLI path. This requires Node.js/npm and may download the package on first use.`;

export class MarpExtendedSettingTab extends PluginSettingTab {
	private plugin: MarpExtended;

	constructor(app: App, plugin: MarpExtended) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem<keyof MarpExtendedSettings>[] {
		const themeConfig = this.getThemeSectionConfig();
		const mermaidThemeConfig = this.getMermaidThemeSectionConfig();

		return [
			{
				type: 'group',
				heading: 'Export and preview',
				items: [
					{
						name: 'Marp CLI path',
						desc: 'Optional. Export uses this executable first. Leave empty to auto-detect marp from PATH and common Homebrew locations.',
						aliases: ['marp executable', 'export command'],
						render: setting => this.renderMarpCliPathControl(setting),
					},
					{
						name: 'Use npx fallback',
						desc: NPX_FALLBACK_DESCRIPTION,
						aliases: ['npm', 'marp cli fallback'],
						render: setting => this.renderNpxFallbackControl(setting),
					},
					{
						name: 'Chrome path',
						desc: 'Optional. Leave empty to let Marp CLI automatically find Google Chrome, Chromium, or Microsoft Edge. Set this only if export auto-detection fails.',
						aliases: ['chromium', 'edge', 'browser path'],
						render: setting => this.renderChromePathControl(setting),
					},
					{
						name: 'Auto-fit wide Mermaid flowcharts',
						desc: 'Re-layout long linear left-to-right or top-to-bottom flowcharts as multi-row/column zigzag diagrams in preview, export, and the editor, so slide scaling keeps text readable.',
						aliases: ['mermaid zigzag', 'flowchart layout'],
						render: setting => this.renderMermaidAutoFitControl(setting),
					},
				],
			},
			{
				type: 'group',
				heading: 'Mermaid in editor',
				items: [
					{
						name: 'Modify editor tab Mermaid rendering',
						desc: 'Replace Mermaid code blocks in Live Preview with Marp Extended styled, zoomable diagrams. Turn this off to use Obsidian\'s native rendering.',
						aliases: ['live preview mermaid', 'native rendering'],
						render: setting => this.renderMermaidEditorControl(setting),
					},
					{
						name: 'Editor Mermaid theme',
						desc: 'Theme used for Mermaid diagrams rendered inside the Obsidian editor. Default: kami.',
						aliases: ['diagram theme', 'kami'],
						render: setting => this.renderMermaidEditorThemeControl(setting),
					},
				],
			},
			{
				type: 'group',
				heading: themeConfig.heading,
				items: [{
					name: themeConfig.installedName,
					desc: themeConfig.installedDesc,
					aliases: ['marp css', 'slide theme'],
					render: setting => this.renderThemeSectionControl(setting, themeConfig),
				}],
			},
			{
				type: 'group',
				heading: mermaidThemeConfig.heading,
				items: [{
					name: mermaidThemeConfig.installedName,
					desc: mermaidThemeConfig.installedDesc,
					aliases: ['mermaid css', 'diagram themes'],
					render: setting => this.renderThemeSectionControl(setting, mermaidThemeConfig),
				}],
			},
		];
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Export and preview')
			.setHeading();

		this.renderMarpCliPathControl(new Setting(containerEl)
			.setName('Marp CLI path')
			.setDesc('Optional. Export uses this executable first. Leave empty to auto-detect marp from PATH and common Homebrew locations.'));

		this.renderNpxFallbackControl(new Setting(containerEl)
			.setName('Use npx fallback')
			.setDesc(NPX_FALLBACK_DESCRIPTION));

		this.renderChromePathControl(new Setting(containerEl)
			.setName('Chrome path')
			.setDesc('Optional. Leave empty to let Marp CLI automatically find Google Chrome, Chromium, or Microsoft Edge. Set this only if export auto-detection fails.'));

		this.renderMermaidAutoFitControl(new Setting(containerEl)
			.setName('Auto-fit wide Mermaid flowcharts')
			.setDesc('Re-layout long linear left-to-right or top-to-bottom flowcharts as multi-row/column zigzag diagrams in preview, export, and the editor, so slide scaling keeps text readable.'));

		this.displayMermaidEditorSection(containerEl);
		this.displayThemesSection(containerEl);
		this.displayMermaidThemesSection(containerEl);
	}

	private renderMarpCliPathControl(setting: Setting): void {
		let marpCliPathText: { setValue(value: string): void } | null = null;
		setting.addText(text => {
				marpCliPathText = text;
				text
					.setPlaceholder('marp or /opt/homebrew/bin/marp')
					.setValue(this.plugin.settings.MARP_CLI_PATH)
					.onChange(async (value) => {
						this.plugin.settings.MARP_CLI_PATH = value;
						await this.plugin.saveSettings();
					});
			})
			.addButton(button => button
				.setButtonText('Auto-detect')
				.onClick(async () => {
					button.setDisabled(true);
					try {
						const detectedPath = MarpExport.detectCliPath();
						if (!detectedPath) {
							new Notice('Marp CLI was not found in PATH or common install locations.', 7000);
							return;
						}
						this.plugin.settings.MARP_CLI_PATH = detectedPath;
						marpCliPathText?.setValue(detectedPath);
						await this.plugin.saveSettings();
						new Notice(`Detected Marp CLI: ${detectedPath}`, 7000);
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						new Notice(`Marp CLI auto-detect failed: ${message}`, 8000);
					} finally {
						button.setDisabled(false);
					}
				}))
			.addButton(button => button
				.setButtonText('Test CLI')
				.onClick(async () => {
					button.setDisabled(true);
					try {
						const version = await MarpExport.getCliVersion(this.plugin.settings);
						new Notice(`Marp CLI found${version ? `: ${version}` : '.'}`, 5000);
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						new Notice(`Marp CLI test failed: ${message}`, 8000);
					} finally {
						button.setDisabled(false);
					}
				}));
	}

	private renderNpxFallbackControl(setting: Setting): void {
		setting.addToggle(toggle => toggle
				.setValue(this.plugin.settings.MARP_CLI_USE_NPX)
				.onChange(async (value) => {
					this.plugin.settings.MARP_CLI_USE_NPX = value;
					await this.plugin.saveSettings();
				}));
	}

	private renderChromePathControl(setting: Setting): void {
		let chromePathText: { setValue(value: string): void } | null = null;
		setting.addText(text => {
				chromePathText = text;
				text
					.setPlaceholder('Enter CHROME_PATH')
					.setValue(this.plugin.settings.CHROME_PATH)
					.onChange(async (value) => {
						this.plugin.settings.CHROME_PATH = value;
						await this.plugin.saveSettings();
					});
			})
			.addButton(button => button
				.setButtonText('Auto-detect')
				.onClick(async () => {
					button.setDisabled(true);
					try {
						const detectedPath = MarpExport.detectBrowserPath();
						if (!detectedPath) {
							new Notice('Chrome, Chromium, or Microsoft Edge was not found in PATH or common install locations.', 7000);
							return;
						}
						this.plugin.settings.CHROME_PATH = detectedPath;
						chromePathText?.setValue(detectedPath);
						await this.plugin.saveSettings();
						new Notice(`Detected browser: ${detectedPath}`, 7000);
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						new Notice(`Browser auto-detect failed: ${message}`, 8000);
					} finally {
						button.setDisabled(false);
					}
				}));
	}

	private renderMermaidAutoFitControl(setting: Setting): void {
		setting.addToggle(toggle => toggle
				.setValue(this.plugin.settings.MERMAID_AUTO_FIT)
				.onChange(async (value) => {
					this.plugin.settings.MERMAID_AUTO_FIT = value;
					await this.plugin.saveSettings();
					this.plugin.refreshEditorMermaidRendering();
					this.plugin.refreshActivePreview();
				}));
	}

	private displayMermaidEditorSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Mermaid in editor')
			.setHeading();

		this.renderMermaidEditorControl(new Setting(containerEl)
			.setName('Modify editor tab Mermaid rendering')
			.setDesc('Replace Mermaid code blocks in Live Preview and Reading view with Marp Extended styled, zoomable diagrams. Reading view omits the source button. Turn this off to use Obsidian\'s native rendering.'));

		this.renderMermaidEditorThemeControl(new Setting(containerEl)
			.setName('Editor Mermaid theme')
			.setDesc('Theme used for Mermaid diagrams rendered inside the Obsidian editor. Default: kami.'));
	}

	private renderMermaidEditorControl(setting: Setting): void {
		setting.addToggle(toggle => toggle
				.setValue(this.plugin.settings.MERMAID_EDITOR_RENDER)
				.onChange(async (value) => {
					this.plugin.settings.MERMAID_EDITOR_RENDER = value;
					await this.plugin.saveSettings();
					this.plugin.refreshEditorMermaidRendering();
				}));
	}

	private renderMermaidEditorThemeControl(setting: Setting): void {
		setting.addDropdown(dropdown => {
				const currentTheme = this.plugin.settings.MERMAID_EDITOR_THEME || 'kami';
				const optionNames = new Set<string>();
				const addOption = (name: string) => {
					if (!optionNames.has(name)) {
						dropdown.addOption(name, name);
						optionNames.add(name);
					}
				};

				addOption(currentTheme);
				addOption('kami');
				dropdown.setValue(currentTheme);
				dropdown.onChange(async (value) => {
					this.plugin.settings.MERMAID_EDITOR_THEME = value;
					await this.plugin.saveSettings();
					this.plugin.refreshEditorMermaidRendering();
				});

				void new MermaidThemeManager(this.app).listThemes()
					.then((themes) => {
						themes.forEach((theme) => addOption(theme.name));
						dropdown.setValue(this.plugin.settings.MERMAID_EDITOR_THEME);
					})
					.catch((error: unknown) => {
						const message = error instanceof Error ? error.message : String(error);
						console.error('Marp Extended: Mermaid theme dropdown load failed', message);
					});
			});
	}

	private displayThemesSection(containerEl: HTMLElement): void {
		this.displayThemeSection(containerEl, this.getThemeSectionConfig());
	}

	private getThemeSectionConfig(): ThemeSectionConfig {
		const manager = new ThemeManager(this.app);
		return {
			manager,
			refreshPreview: true,
			heading: 'Themes',
			installedName: 'Installed themes',
			installedDesc: `Bundled default themes are installed as managed CSS files in ${manager.getDefaultThemeDirectory()} from the current plugin package. Fork a default theme before editing it. Use @theme names in Marp frontmatter.`,
			emptyText: 'No themes installed yet. Marp Extended will install bundled default themes on startup, or you can add CSS manually.',
			forkTooltip: 'Fork bundled default theme',
			editTooltip: 'Edit custom theme CSS',
			deleteTooltip: 'Delete custom theme CSS',
			notices: {
				added: (name) => `Added Marp theme: ${name}`,
				forked: (name) => `Forked Marp theme: ${name}`,
				saved: (name) => `Saved Marp theme: ${name}`,
				deleted: (name) => `Deleted Marp theme: ${name}`,
				forkFailed: (message) => `Theme fork failed: ${message}`,
				editFailed: (message) => `Theme edit failed: ${message}`,
			},
			modalText: {
				addTitle: 'Add Marp CSS theme',
				editTitle: 'Edit Marp CSS theme',
				nameDesc: 'Optional if the CSS already has a /* @theme name */ metadata comment.',
				namePlaceholder: 'my-theme',
				cssDesc: 'Paste a Marp theme CSS file. It will be saved into .marp-extended/themes/.',
				cssRows: 18,
				cssPlaceholder: '/* @theme my-theme */\n\n@import "default";\n\nsection { ... }',
				addSaveButtonText: 'Save theme',
				saveErrorPrefix: 'Theme save failed',
			},
		};
	}

	private displayMermaidThemesSection(containerEl: HTMLElement): void {
		this.displayThemeSection(containerEl, this.getMermaidThemeSectionConfig());
	}

	private getMermaidThemeSectionConfig(): ThemeSectionConfig {
		const manager = new MermaidThemeManager(this.app);
		return {
			manager,
			refreshPreview: false,
			heading: 'Mermaid theme library',
			installedName: 'Installed Mermaid themes',
			installedDesc: `Bundled Mermaid themes are installed as managed CSS files in ${manager.getDefaultThemeDirectory()} from the current plugin package. Fork a default before editing it. Use their names in the mermaidTheme frontmatter property.`,
			emptyText: 'No Mermaid themes installed yet. Marp Extended will install bundled defaults on startup, or you can add CSS manually.',
			forkTooltip: 'Fork bundled Mermaid theme',
			editTooltip: 'Edit custom Mermaid theme CSS',
			deleteTooltip: 'Delete custom Mermaid theme CSS',
			notices: {
				added: (name) => `Added Mermaid theme: ${name}`,
				forked: (name) => `Forked Mermaid theme: ${name}`,
				saved: (name) => `Saved Mermaid theme: ${name}`,
				deleted: (name) => `Deleted Mermaid theme: ${name}`,
				forkFailed: (message) => `Mermaid theme fork failed: ${message}`,
				editFailed: (message) => `Mermaid theme edit failed: ${message}`,
			},
			modalText: {
				addTitle: 'Add Mermaid CSS theme',
				editTitle: 'Edit Mermaid CSS theme',
				nameDesc: 'Optional if the CSS already has a /* @mermaid-theme name */ metadata comment.',
				namePlaceholder: 'my-mermaid-theme',
				cssDesc: 'CSS selectors should target .mermaid-diagram-container and the inline SVG variables such as --bg, --fg, --line, and --accent. Optional Core 5 aliases: --marp-mermaid-background, --marp-mermaid-foreground, and the matching --marp-mermaid-* names.',
				cssRows: 14,
				cssCols: 64,
				cssPlaceholder: '/* @mermaid-theme my-mermaid-theme */\nsection .mermaid-diagram-container svg { --accent: #1B365D !important; --marp-mermaid-accent: var(--accent); }',
				addSaveButtonText: 'Save Mermaid theme',
				saveErrorPrefix: 'Could not save Mermaid theme',
			},
		};
	}

	private displayThemeSection(containerEl: HTMLElement, config: ThemeSectionConfig): void {
		new Setting(containerEl)
			.setName(config.heading)
			.setHeading();

		this.renderThemeSectionControl(new Setting(containerEl)
			.setName(config.installedName)
			.setDesc(config.installedDesc), config);
	}

	private renderThemeSectionControl(setting: Setting, config: ThemeSectionConfig): void {
		const themeListEl = setting.settingEl.ownerDocument.win.createDiv({ cls: 'marp-extended-theme-list' });
		setting.settingEl.insertAdjacentElement('afterend', themeListEl);

		setting.addButton(button => button
				.setButtonText('Add CSS theme')
				.setCta()
				.onClick(() => {
					new AddVaultThemeModal(this.app, config.manager, async (entry) => {
						new Notice(config.notices.added(entry.name), 5000);
						await this.afterThemeChange(config);
						await this.renderThemeList(themeListEl, config);
					}, config.modalText).open();
				}));
		void this.renderThemeList(themeListEl, config);
	}

	private async afterThemeChange(config: ThemeSectionConfig): Promise<void> {
		await this.plugin.refreshThemePropertyOptions();
		if (config.refreshPreview) {
			this.plugin.refreshActivePreview();
		}
	}

	private getThemeDescription(theme: InstalledThemeEntry): string {
		const source = theme.source === 'default' ? 'Built-in' : 'Custom';
		if (theme.source !== 'default') {
			return `${source} · ${theme.path}`;
		}

		return `${source} · managed by Marp Extended · fork to edit · ${theme.path}`;
	}

	private async renderThemeList(containerEl: HTMLElement, config: ThemeSectionConfig): Promise<void> {
		containerEl.empty();

		const themeManager = config.manager;
		const themes = await themeManager.listThemes();

		if (themes.length === 0) {
			containerEl.createEl('p', {
				cls: 'marp-extended-theme-empty',
				text: config.emptyText,
			});
			return;
		}

		themes.forEach((theme) => {
			const setting = new Setting(containerEl)
				.setName(theme.name)
				.setDesc(this.getThemeDescription(theme));

			if (theme.source === 'default') {
				setting.addExtraButton(button => button
						.setIcon('copy')
						.setTooltip(config.forkTooltip)
						.onClick(async () => {
							button.setDisabled(true);
							try {
								const forked = await themeManager.forkDefaultTheme(theme.fileName);
								await this.afterThemeChange(config);
								new Notice(config.notices.forked(forked.name), 5000);
								await this.renderThemeList(containerEl, config);
							} catch (error) {
								const message = error instanceof Error ? error.message : String(error);
								new Notice(config.notices.forkFailed(message), 8000);
								button.setDisabled(false);
							}
						}));
			} else {
				setting.addExtraButton(button => button
					.setIcon('pencil')
					.setTooltip(config.editTooltip)
					.onClick(async () => {
						button.setDisabled(true);
						try {
							const css = await themeManager.readThemeCss(theme.path);
							new AddVaultThemeModal(this.app, themeManager, async (entry) => {
								new Notice(config.notices.saved(entry.name), 5000);
								await this.afterThemeChange(config);
								await this.renderThemeList(containerEl, config);
							}, config.modalText, {
								entry: theme,
								initialCss: css,
								initialName: theme.name,
								mode: 'edit',
							}).open();
						} catch (error) {
							const message = error instanceof Error ? error.message : String(error);
							new Notice(config.notices.editFailed(message), 8000);
						} finally {
							button.setDisabled(false);
						}
					}));

				setting.addExtraButton(button => button
					.setIcon('trash')
					.setTooltip(config.deleteTooltip)
					.onClick(async () => {
						await themeManager.removeTheme(theme.path);
						await this.afterThemeChange(config);
						new Notice(config.notices.deleted(theme.name), 5000);
						await this.renderThemeList(containerEl, config);
					}));
			}
		});
	}
}

interface ThemeModalText {
	addTitle: string;
	editTitle: string;
	nameDesc: string;
	namePlaceholder: string;
	cssDesc: string;
	cssRows: number;
	cssCols?: number;
	cssPlaceholder: string;
	addSaveButtonText: string;
	saveErrorPrefix: string;
}

interface ThemeSectionConfig {
	manager: VaultThemeManager;
	/** Marp slide themes also refresh the active preview after mutations. */
	refreshPreview: boolean;
	heading: string;
	installedName: string;
	installedDesc: string;
	emptyText: string;
	forkTooltip: string;
	editTooltip: string;
	deleteTooltip: string;
	notices: {
		added: (name: string) => string;
		forked: (name: string) => string;
		saved: (name: string) => string;
		deleted: (name: string) => string;
		forkFailed: (message: string) => string;
		editFailed: (message: string) => string;
	};
	modalText: ThemeModalText;
}

interface ThemeModalOptions {
	entry?: InstalledThemeEntry;
	initialCss?: string;
	initialName?: string;
	mode?: 'add' | 'edit';
}

class AddVaultThemeModal extends Modal {
	private themeName = '';
	private themeCss = '';
	private mode: 'add' | 'edit';
	private entry?: InstalledThemeEntry;

	constructor(
		app: App,
		private themeManager: VaultThemeManager,
		private onSaved: (entry: InstalledThemeEntry) => Promise<void>,
		private text: ThemeModalText,
		options: ThemeModalOptions = {},
	) {
		super(app);
		this.themeName = options.initialName ?? '';
		this.themeCss = options.initialCss ?? '';
		this.mode = options.mode ?? 'add';
		this.entry = options.entry;
	}

	onOpen(): void {
		this.titleEl.textContent = this.mode === 'edit' ? this.text.editTitle : this.text.addTitle;
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('marp-extended-add-theme-modal');

		new Setting(contentEl)
			.setName('Theme name')
			.setDesc(this.text.nameDesc)
			.addText(text => text
				.setPlaceholder(this.text.namePlaceholder)
				.setValue(this.themeName)
				.onChange((value) => {
					this.themeName = value;
				}));

		const cssSetting = new Setting(contentEl)
			.setName('Theme CSS')
			.setDesc(this.text.cssDesc)
			.addTextArea(text => {
				text.inputEl.rows = this.text.cssRows;
				if (this.text.cssCols) {
					text.inputEl.cols = this.text.cssCols;
				}
				text.inputEl.addClass('marp-extended-theme-css-input');
				text.setPlaceholder(this.text.cssPlaceholder)
					.setValue(this.themeCss)
					.onChange((value) => {
						this.themeCss = value;
					});
			});
		cssSetting.settingEl.addClass('marp-extended-theme-css-setting');

		new Setting(contentEl)
			.addButton(button => button
				.setButtonText('Cancel')
				.onClick(() => this.close()))
			.addButton(button => button
				.setButtonText(this.mode === 'edit' ? 'Save changes' : this.text.addSaveButtonText)
				.setCta()
				.onClick(async () => {
					button.setDisabled(true);
					try {
						const entry = this.mode === 'edit' && this.entry
							? await this.themeManager.updateCustomThemeFromCss(this.entry.path, this.themeCss, this.themeName)
							: await this.themeManager.addThemeFromCss(this.themeCss, this.themeName);
						await this.onSaved(entry);
						this.close();
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						new Notice(`${this.text.saveErrorPrefix}: ${message}`, 8000);
						button.setDisabled(false);
					}
				}));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
