import { pipe } from "effect";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import { CommandUtils } from "$/utils/shell";
import { GetActivationEvents } from "./package-json/activationEvents";
import { GetContributes } from "./package-json/contributes";
import { PackageJson } from "./package-json/schema";

const UpdatePackageJson = Effect.gen(function* () {
	yield* Effect.logInfo("Updating package.json");

	const fs = yield* FileSystem.FileSystem;

	const PackageJsonContent = yield* fs
		.readFileString("package.json")
		.pipe(Effect.flatMap(Schema.decodeUnknownEffect(PackageJson)));

	const contributes = yield* GetContributes;
	const activationEvents = yield* GetActivationEvents;

	yield* pipe(
		PackageJsonContent,
		(file): PackageJson => {
			return {
				...file,
				activationEvents,
				contributes: {
					...file.contributes,
					...contributes,
				},
			};
		},
		Schema.encodeEffect(PackageJson),
		Effect.flatMap((f) => fs.writeFileString("package.json", f)),
	);

	yield* pipe(
		ChildProcess.make("bun", ["run", "format", "package.json"]),
		CommandUtils.execute,
		Effect.catch((err) =>
			Effect.logWarning("Failed to format package.json", err),
		),
	);
});

const Package = Effect.fn("Package")(function* (extension: string) {
	yield* Effect.log("Packaging extension");
	const cmd = ChildProcess.make("bun", ["run", "package", "--out", extension]);
	yield* CommandUtils.execute(cmd);
});

const Install = Effect.fn("Install")(function* (extension: string) {
	const cmd = ChildProcess.make("code", ["--install-extension", extension]);
	yield* CommandUtils.execute(cmd);
});

export namespace Release {
	export const Prebuild = UpdatePackageJson;
	export const Postbuild = Effect.gen(function* () {
		const now = yield* DateTime.now;
		const extension = `.extension-${now.epochMilliseconds}.vsix`;

		yield* Package(extension);
		yield* Install(extension);

		const fs = yield* FileSystem.FileSystem;
		yield* fs.remove(extension);
		yield* Effect.log("Removing extension file");
	});

	export const Full = Effect.gen(function* () {
		yield* Prebuild;
		yield* Postbuild;
	});
}
