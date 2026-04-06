import * as Path from "@effect/platform/Path";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { type Node, Project } from "ts-morph";
import { asError } from "$/utils/error";

export class TsMorph extends Effect.Service<TsMorph>()(
	"script-manager/tsmorph/TsMorph",
	{
		effect: Effect.gen(function* () {
			yield* Effect.log("Initializing ts-morph service");

			const path = yield* Path.Path;

			const tsConfig = path.resolve(
				// TODO master | vscode uses cjs, replace with inMemory later, move this implementation to build scripts  | by Evgenii Perminov at Mon, 06 Apr 2026 20:26:19 GMT
				import.meta.dir,
				"..",
				"..",
				"tsconfig.json",
			);
			const project = yield* Effect.try({
				try() {
					return new Project({
						tsConfigFilePath: tsConfig,
					});
				},
				catch(error) {
					return new TsMorphError({ cause: error });
				},
			});

			return { project };
		}),
	},
) {
	static with = Effect.fn("use")(
		<T>(run: (project: Project) => PromiseLike<T> | T) => {
			return TsMorph.use((tsmorph) =>
				Effect.tryPromise({
					try: async () => {
						return run(tsmorph.project);
					},
					catch(error) {
						return new TsMorphError({ cause: error });
					},
				}),
			);
		},
	);

	static addSourceFile = Effect.fn("addSourceFile")((filePath: string) => {
		return TsMorph.with((project) => project.addSourceFileAtPath(filePath));
	});

	static InMemory = Layer.effect(
		TsMorph,
		Effect.gen(function* () {
			const project = yield* Effect.try({
				try() {
					return new Project({ useInMemoryFileSystem: true });
				},
				catch(error) {
					return new TsMorphError({ cause: error });
				},
			});

			return {
				_tag: "script-manager/tsmorph/TsMorph",
				project,
			};
		}),
	);
}

export namespace TsMorph {
	export function getNodeName(node: Node) {
		return node.getSymbol()?.getName() ?? node.getText();
	}

	export function getNodeLocation(node: Node) {
		const source = node.getSourceFile();
		const position = source.getLineAndColumnAtPos(node.getStart());
		return `${source.getFilePath()}:${position.line}:${position.column}`;
	}
}

export class TsMorphError extends Data.TaggedError("TsMorphError")<{
	cause: unknown;
}> {
	override message = asError(this.cause).message;
}
