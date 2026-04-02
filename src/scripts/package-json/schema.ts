import * as Schema from "effect/Schema";

function looseStruct<Fields extends Schema.Struct.Fields>(fields: Fields) {
	return Schema.Struct(fields).pipe(
		Schema.annotations({ parseOptions: { onExcessProperty: "preserve" } }),
	);
}

const CommandDeclaration = looseStruct({
	command: Schema.String,
	title: Schema.String,
	enablement: Schema.String.pipe(Schema.optional),
}).pipe(Schema.annotations({ identifier: "Command" }));

export type CommandDeclaration = typeof CommandDeclaration.Type;

const Contributes = looseStruct({
	commands: Schema.Array(CommandDeclaration),
}).pipe(Schema.annotations({ identifier: "Contributes" }));

export type Contributes = typeof Contributes.Type;

const ActivationEvents = Schema.Array(Schema.String).pipe(
	Schema.annotations({ identifier: "ActivationEvents" }),
);

const PackageJsonFromSelf = looseStruct({
	contributes: Contributes,
	activationEvents: ActivationEvents.pipe(Schema.optional),
});

export const PackageJson = Schema.parseJson(PackageJsonFromSelf).pipe(
	Schema.annotations({ identifier: "PackageJson" }),
);
export type PackageJson = typeof PackageJson.Type;
