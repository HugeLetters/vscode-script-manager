import { CodeAction } from "$/vscode/code-action";
import { Language } from "$/vscode/language";
import {
	CreateGetter,
	CreateGetterAndSetter,
	CreateSetterFromGetter,
} from "./create-getter";

export const TypescriptCodeActions = new CodeAction.Provider({
	id: "typescript",
	actions: [CreateGetter, CreateGetterAndSetter, CreateSetterFromGetter],
	selector: [
		{ language: Language.ts },
		{ language: Language.tsx },
		{ language: Language.js },
		{ language: Language.jsx },
	],
});
