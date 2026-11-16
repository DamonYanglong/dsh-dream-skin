/*
 * 10-locale.js — 文案字典（纯数据）。
 * 职责：zh/en 双语全部面板与设置行文案。
 * 不引用：任何符号（纯 JSON 形态的 JS 字面量）。
 */
/** 文案（M2：zh/en 先行）。 */
const LOCALE = {
	zh: {
		"row.title": "皮肤",
		"row.theme.off": "官方默认",
		"panel.label": "皮肤",
		"panel.title": "皮肤",
		"panel.subtitle": "为整个界面换上背景图与主题色",
		"panel.theme.off": "官方默认",
		"panel.theme.off.hint": "还原官方外观",
		"panel.builtin": "内置主题",
		"panel.imported": "导入的皮肤",
		"panel.import": "导入皮肤",
		"panel.import.zip": "导入 ZIP",
		"panel.import.folder": "文件夹",
		"panel.import.folder.hint": "选择本地主题文件夹（theme.json + 背景图）",
		"panel.import.hint": "选择一个主题文件夹（含 theme.json 与背景图，zcode-dream-skin 格式）",
		"panel.import.busy": "导入中…",
		"panel.import.fail": "导入失败",
		"panel.remove": "删除",
		"panel.visibility": "背景透出度",
	},
	en: {
		"row.title": "Skin",
		"row.theme.off": "Official default",
		"panel.label": "Skin",
		"panel.title": "Skin",
		"panel.subtitle": "Background art and theme colors for the whole interface",
		"panel.theme.off": "Official default",
		"panel.theme.off.hint": "Restore the stock appearance",
		"panel.builtin": "Built-in themes",
		"panel.imported": "Imported skins",
		"panel.import": "Import skin",
		"panel.import.zip": "Import ZIP",
		"panel.import.folder": "Folder",
		"panel.import.folder.hint": "Pick a local theme folder (theme.json + background)",
		"panel.import.hint": "Pick a theme folder (theme.json + background, zcode-dream-skin format)",
		"panel.import.busy": "Importing…",
		"panel.import.fail": "Import failed",
		"panel.remove": "Remove",
		"panel.visibility": "Background visibility",
	},
};
