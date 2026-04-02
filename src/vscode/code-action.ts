import { pipe } from "effect";
import * as Arr from "effect/Array";
import * as Cause from "effect/Cause";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import {
	type CancellationToken,
	type CodeActionKind,
	type DocumentSelector,
	languages,
	type Range,
	type TextDocument,
	CodeAction as VsCodeAction,
} from "vscode";
import { Runtime, type SharedRuntimeContext } from "$/runtime";
import { asError } from "$/utils/error";

export class CodeAction extends Data.TaggedClass("CodeAction")<{
	readonly title: string;
	readonly kind: CodeActionKind;
	readonly task: (
		data: CodeAction.CodeActionData,
	) => Effect.Effect<VsCodeAction | null, unknown, SharedRuntimeContext>;
}> {}

export namespace CodeAction {
	export interface CodeActionData {
		readonly action: VsCodeAction;
		readonly document: TextDocument;
		readonly range: Range;
	}

	export class Provider extends Data.TaggedClass("CodeActionProvider")<{
		readonly id: string;
		readonly actions: ReadonlyArray<CodeAction>;
		readonly selector: DocumentSelector;
	}> {}

	export namespace Provider {
		export const registerCodeProvider = Effect.fn("registerCodeProvider")(
			function* (provider: Provider) {
				const run = yield* Runtime;

				return yield* CodeAction.tryPromise(() =>
					languages.registerCodeActionsProvider(
						provider.selector,
						{
							provideCodeActions(document, range, _context, token) {
								const TokenCancellationEffect = createCancellationEffect(
									token,
								).pipe(
									Effect.tapError(() =>
										Effect.logWarning(
											`Actions cancelled for provider: ${provider.id}`,
										),
									),
								);

								return pipe(
									provider.actions,
									Arr.map((action) => {
										return action
											.task({
												action: new VsCodeAction(action.title, action.kind),
												document,
												range,
											})
											.pipe(
												Effect.tapError((cause) =>
													Effect.logError(
														`Action "${action.title}" of provider ${provider.id} failed`,
														cause,
													),
												),
												Effect.orElseSucceed(() => null),
											);
									}),
									Effect.allWith(),
									Effect.raceFirst(TokenCancellationEffect),
									Effect.map(Arr.filter(Predicate.isNotNull)),
									// Effect.orElseSucceed(() => []),
									run,
								);
							},
						},
						{
							providedCodeActionKinds: Arr.map(
								provider.actions,
								(action) => action.kind,
							),
						},
					),
				);
			},
		);
	}

	function createCancellationEffect(token: CancellationToken) {
		return Effect.async<never, Cause.InterruptedException>((resume) => {
			if (token.isCancellationRequested) {
				resume(new Cause.InterruptedException());
				return;
			}

			const disposable = token.onCancellationRequested(() => {
				resume(new Cause.InterruptedException());
				cleanup();
			});

			function cleanup() {
				disposable.dispose();
			}

			return Effect.sync(cleanup);
		});
	}

	export const tryPromise = Effect.fn("tryPromise")(
		<R>(run: () => R | PromiseLike<R>) => {
			return Effect.tryPromise({
				try: async () => run(),
				catch(error) {
					return new CodeActionError({ cause: error });
				},
			});
		},
	);

	class CodeActionError extends Data.TaggedError("CodeActionError")<{
		readonly cause: unknown;
	}> {
		override message = asError(this.cause).message;
	}
}
