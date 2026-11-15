import * as Path from "node:path";
import * as Effect from "effect/Effect";
import * as Record_ from "effect/Record";
import { ConfigurationTarget, type Uri, window, workspace } from "vscode";
import { Command } from "$/vscode/command";

export const RenameTab = new Command.Command({
	id: "rename-tab",
	name: "Rename Tab",
	task: Effect.gen(function* () {
		const editor = window.activeTextEditor;
		if (!editor) {
			return;
		}

		const uri = editor.document.uri;
		if (uri.scheme !== "file") {
			yield* Effect.tryPromise(() =>
				window.showWarningMessage("Only file-backed tabs can be renamed."),
			);
			return;
		}

		const currentLabel = Path.basename(editor.document.fileName);
		const nextLabel = yield* Effect.tryPromise(() =>
			window.showInputBox({
				prompt: "Enter a custom tab label",
				value: currentLabel,
				valueSelection: [0, currentLabel.length],
				ignoreFocusOut: true,
			}),
		);

		if (nextLabel === undefined) {
			return;
		}

		const finalLabel = nextLabel.trim();
		const { patternKey, target } = getPatternKeyAndTarget(uri);
		const config = workspace.getConfiguration("workbench.editor.customLabels");
		const previousPatterns =
			config.get<Record<string, string>>("patterns") ?? {};

		const nextPatterns = Record_.set(
			previousPatterns,
			patternKey,
			finalLabel || undefined,
		);

		yield* Effect.tryPromise(() => config.update("enabled", true, target));
		yield* Effect.tryPromise(() =>
			config.update("patterns", nextPatterns, target),
		);
	}),
});

function getPatternKeyAndTarget(uri: Uri): {
	readonly patternKey: string;
	readonly target: ConfigurationTarget;
} {
	const workspaceFolder = workspace.getWorkspaceFolder(uri);
	if (workspaceFolder) {
		const relativePath = Path.relative(workspaceFolder.uri.fsPath, uri.fsPath)
			.split(Path.sep)
			.join("/");
		return {
			patternKey: `*/${relativePath}`,
			target: ConfigurationTarget.Workspace,
		};
	}

	const absolutePath = uri.fsPath.split(Path.sep).join("/");
	return {
		patternKey: absolutePath.startsWith("/")
			? absolutePath
			: `/${absolutePath}`,
		target: ConfigurationTarget.Global,
	};
}
