import { FileSystemAdapter, type SettingDefinitionGroup, type SettingDefinitionItem } from 'obsidian';
import { describe, expect, test } from '@jest/globals';

import { MarpExtendedSettingTab } from '@/settings/marpExtendedSettingTab';
import { DEFAULT_SETTINGS } from '@/utilities/settings';
import packageMetadata from '../../package.json';

function isSettingGroup<K extends string>(definition: SettingDefinitionItem<K>): definition is SettingDefinitionGroup<K> {
	return 'type' in definition && definition.type === 'group';
}

function createSettingTab(): MarpExtendedSettingTab {
	const app = {
		vault: {
			adapter: new FileSystemAdapter(),
		},
	};
	const plugin = {
		settings: { ...DEFAULT_SETTINGS },
	};

	return new MarpExtendedSettingTab(app as any, plugin as any);
}

describe('Marp Extended setting definitions', () => {
	test('indexes every settings section for Obsidian settings search', () => {
		const definitions = createSettingTab().getSettingDefinitions();
		const groups = definitions.filter(isSettingGroup);

		expect(groups.map(group => group.heading)).toEqual([
			'Export and preview',
			'Mermaid in editor',
			'Themes',
			'Mermaid theme library',
		]);

		const names = groups.flatMap(group => group.items?.map(item => item.name) ?? []);
		expect(names).toEqual([
			'Marp CLI path',
			'Use npx fallback',
			'Chrome path',
			'Auto-fit wide Mermaid flowcharts',
			'Historical temporary files',
			'Modify editor tab Mermaid rendering',
			'Editor Mermaid theme',
			'Installed themes',
			'Installed Mermaid themes',
		]);
		expect(new Set(names).size).toBe(names.length);

		const npxFallback = groups.flatMap(group => group.items ?? [])
			.find(item => item.name === 'Use npx fallback');
		expect(npxFallback?.desc).toContain(packageMetadata.marpExtended.npxMarpCliPackage);
	});

	test('keeps imperative render callbacks for settings with side effects and actions', () => {
		const definitions = createSettingTab().getSettingDefinitions();
		const items = definitions
			.filter(isSettingGroup)
			.flatMap(group => group.items ?? []);

		expect(items).toHaveLength(9);
		expect(items.every(item => 'render' in item && typeof item.render === 'function')).toBe(true);
	});
});
