import { Console as NodeConsole } from "node:console";
import { Writable } from "node:stream";
import { type InspectOptions, inspect } from "node:util";
import * as Predicate from "effect/Predicate";

export namespace ConsoleUtils {
	export function createConsole(write: (message: string) => void) {
		const stream = new Writable({
			write(chunk, _, callback) {
				if (chunk instanceof Buffer) {
					write(chunk.toString());
					return callback(null);
				}

				write(format(chunk));
				return callback(null);
			},
		});

		return new NodeConsole(stream);
	}

	function format(value: unknown) {
		if (Predicate.isString(value)) {
			return value;
		}

		return inspect(value, DefaultInspectOptions);
	}

	const DefaultInspectOptions: InspectOptions = {
		depth: 5,
		numericSeparator: true,
		sorted: true,
	};
}
