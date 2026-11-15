import { pipe } from "effect";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Schema from "effect/Schema";
import { CommandUtils } from "$/utils/shell";
import { GetActivationEvents } from "./package-json/activationEvents";
import { GetContributes } from "./package-json/contributes";
import { PackageJson } from "./package-json/schema";

/** `value` with object keys in the order they have in `reference`; new keys go last. */
function withKeyOrderOf(reference: unknown, value: unknown): unknown {
	if (Array.isArray(value)) {
		const ref = Array.isArray(reference) ? reference : [];
		return value.map((item, i) => withKeyOrderOf(ref[i], item));
	}
	if (typeof value !== "object" || value === null) return value;

	const ref =
		typeof reference === "object" &&
		reference !== null &&
		!Array.isArray(reference)
			? (reference as Record<string, unknown>)
			: {};
	const entries = Object.entries(value);
	const known = Object.keys(ref).filter((key) => key in value);
	const rest = entries.map(([key]) => key).filter((key) => !(key in ref));
	return Object.fromEntries(
		[...known, ...rest].map((key) => [
			key,
			withKeyOrderOf(ref[key], (value as Record<string, unknown>)[key]),
		]),
	);
}

const UpdatePackageJson = Effect.gen(function* () {
	yield* Effect.logInfo("Updating package.json");

	const fs = yield* FileSystem.FileSystem;

	const original = yield* fs.readFileString("package.json");
	const PackageJsonContent =
		yield* Schema.decodeUnknownEffect(PackageJson)(original);

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
		Effect.map((encoded) =>
			JSON.stringify(
				withKeyOrderOf(JSON.parse(original), JSON.parse(encoded)),
				null,
				"\t",
			),
		),
		Effect.flatMap((f) => fs.writeFileString("package.json", `${f}\n`)),
	);

	yield* pipe(
		ChildProcess.make("bunx", ["biome", "format", "--write", "package.json"]),
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
