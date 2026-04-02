import { CodeAction } from "$/vscode/code-action";
import { Language } from "$/vscode/language";
import { CreateGetter } from "./create-getter";

export const TypescriptCodeActions = new CodeAction.Provider({
	id: "typescript",
	actions: [CreateGetter],
	selector: [
		{ language: Language.ts },
		{ language: Language.tsx },
		{ language: Language.js },
		{ language: Language.jsx },
	],
});
