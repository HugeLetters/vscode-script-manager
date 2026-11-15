import * as Cause from "effect/Cause";
import * as Data from "effect/Data";
import type { Node } from "ts-morph";
import { getNodeLocator } from "./nodes";

/** A ts-morph call threw. `cause` is always an `Error`; non-errors are wrapped in `Cause.UnknownError`. */
export class TsMorphError extends Data.TaggedError("TsMorphError")<{
	readonly cause: Error;
}> {
	static fromUnknown(error: unknown): TsMorphError {
		const cause =
			error instanceof Error ? error : new Cause.UnknownError(error);
		return new TsMorphError({ cause });
	}

	override get message() {
		return `${this.cause.constructor.name}: ${this.cause.message}`;
	}
}

/**
 * A node is missing or not what was expected. With a `node`, the message starts with its
 * locator (`name at /path.ts:line:col`), e.g. `{ node, detail: "is not an array literal" }`.
 */
export class TsMorphNodeError extends Data.TaggedError("TsMorphNodeError")<{
	readonly detail: string;
	readonly node?: Node;
}> {
	override get message() {
		return this.node === undefined
			? this.detail
			: `${getNodeLocator(this.node)} ${this.detail}`;
	}
}
