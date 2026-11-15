import * as Schema from "effect/Schema";

/** A struct that keeps unknown keys on decode and encode (e.g. the rest of package.json). */
function looseStruct<Fields extends Schema.Struct.Fields>(fields: Fields) {
	return Schema.StructWithRest(Schema.Struct(fields), [
		Schema.Record(Schema.String, Schema.Unknown),
	]);
}

const CommandDeclaration = looseStruct({
	command: Schema.String,
	title: Schema.String,
	enablement: Schema.String.pipe(Schema.optional),
}).pipe(Schema.annotate({ identifier: "Command" }));

export type CommandDeclaration = typeof CommandDeclaration.Type;

const Contributes = looseStruct({
	commands: Schema.Array(CommandDeclaration),
}).pipe(Schema.annotate({ identifier: "Contributes" }));

export type Contributes = typeof Contributes.Type;

const ActivationEvents = Schema.Array(Schema.String).pipe(
	Schema.annotate({ identifier: "ActivationEvents" }),
);

const PackageJsonFromSelf = looseStruct({
	contributes: Contributes,
	activationEvents: ActivationEvents.pipe(Schema.optional),
});

export const PackageJson = Schema.fromJsonString(PackageJsonFromSelf).pipe(
	Schema.annotate({ identifier: "PackageJson" }),
);

export type PackageJson = typeof PackageJson.Type;
