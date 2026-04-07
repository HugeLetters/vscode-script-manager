import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { type Node, Project } from "ts-morph";
import { asError } from "$/utils/error";

export class TsMorph extends Effect.Service<TsMorph>()(
	"script-manager/tsmorph/TsMorph",
	{
		effect: Effect.gen(function* () {
			const project = yield* Effect.try({
				try() {
					return new Project({ useInMemoryFileSystem: true });
				},
				catch(error) {
					return new TsMorphError({ cause: error });
				},
			});

			return {
				project,
			};
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
