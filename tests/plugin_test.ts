/**
 * The plugin shape, the manifest reader, and the one thing worth being sure of:
 * that `viola().use()` accepts what this package hands it.
 *
 * Type-checking `mod.ts` proves the file parses. It does not prove the object
 * satisfies the interface `use()` actually takes, because that interface lives
 * in another package and a structural mismatch there is a runtime failure in a
 * consumer's config rather than a compile error here.
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { viola } from "@hiisi/viola";
import publishLints, { publishLints as named, readManifests, shipsABinary } from "../mod.ts";

Deno.test("the plugin is accepted by viola's use()", () => {
  const config = viola().use(publishLints()).build();
  assertExists(config, "use() returned nothing for this plugin");
});

Deno.test("the default export and the named export are the same factory", () => {
  assertEquals(publishLints, named);
});

Deno.test("the factory returns a fresh object each call", () => {
  assert(publishLints() !== publishLints(), "two calls shared one object");
});

Deno.test("the plugin puts its linter on the builder it is handed", () => {
  const added: unknown[] = [];
  // a stand-in builder, so what the plugin does is observable rather than inferred
  publishLints().build({ add: (l: unknown) => added.push(l) } as never);
  assert(added.length > 0, "the plugin added nothing to the builder");
});

Deno.test("readManifests finds a deno.json and names its ecosystem", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/deno.json`, JSON.stringify({ name: "@x/y", version: "0.0.1" }));
  const found = readManifests(dir);
  assertEquals(found.length, 1);
  assertEquals(found[0].ecosystem, "jsr");
});

Deno.test("readManifests finds nothing where there is nothing", async () => {
  const dir = await Deno.makeTempDir();
  assertEquals(readManifests(dir).length, 0);
});

Deno.test("readManifests reads all three ecosystems from one directory", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/deno.json`, JSON.stringify({ name: "@x/y", version: "0.0.1" }));
  await Deno.writeTextFile(`${dir}/package.json`, JSON.stringify({ name: "y", version: "0.0.1" }));
  await Deno.writeTextFile(`${dir}/Cargo.toml`, '[package]\nname = "y"\nversion = "0.0.1"\n');
  const kinds = readManifests(dir).map((m) => m.ecosystem).sort();
  assertEquals(kinds, ["cargo", "jsr", "npm"]);
});

Deno.test("shipsABinary is false for a package that declares no command", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/deno.json`, JSON.stringify({ name: "@x/y", version: "0.0.1" }));
  const [m] = readManifests(dir);
  assertEquals(shipsABinary(m, dir), false);
});
