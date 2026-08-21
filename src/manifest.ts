//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    Hiisi Digital                    ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0      contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Reading a project's manifests, whichever kind it has.
 *
 * A manifest is not a source file, so viola's crawler does not hand it over: the lints here
 * read it from `projectRoot` instead. That is also why this is its own module rather than a
 * detail of one linter. Both linters need the same answer to "what kind of package is this
 * and what does it declare", and asking twice is how the two would end up disagreeing.
 *
 * @module
 */

import { parse as parseToml } from "@std/toml";
import { join } from "@std/path";

/** Which registry a package is published to, which decides what it must carry. */
export type Ecosystem = "jsr" | "npm" | "cargo";

/** What a manifest says, reduced to the parts publishing cares about. */
export interface Manifest {
  readonly ecosystem: Ecosystem;
  /** The file it was read from, relative to the project root. */
  readonly file: string;
  /** The parsed document, shape depending on the ecosystem. */
  // deno-lint-ignore no-explicit-any
  readonly document: Record<string, any>;
}

/** Reads a JSON document that may carry line comments, as `deno.json` may. */
function parseJsonc(text: string): Record<string, unknown> {
  // Comments only, since that is all deno.json permits beyond JSON. Strings are left alone
  // by requiring the `//` to be preceded by start-of-line or whitespace, which a `://` in a
  // url is not.
  const withoutComments = text.replace(/(^|\s)\/\/[^\n]*/g, "$1");
  return JSON.parse(withoutComments) as Record<string, unknown>;
}

/**
 * Every manifest at the project root.
 *
 * A repository may carry more than one: a deno package that also builds an npm package has
 * a `deno.json` and, after a build, a generated `package.json`. Only manifests that are
 * authored are returned; a generated one under a build directory is not the thing to lint.
 */
export function readManifests(projectRoot: string): Manifest[] {
  const found: Manifest[] = [];

  for (const [file, ecosystem] of [
    ["deno.json", "jsr"],
    ["deno.jsonc", "jsr"],
    ["jsr.json", "jsr"],
    ["package.json", "npm"],
    ["Cargo.toml", "cargo"],
  ] as const) {
    const path = join(projectRoot, file);
    let text: string;
    try {
      text = Deno.readTextFileSync(path);
    } catch {
      continue;
    }
    try {
      const document = ecosystem === "cargo"
        ? parseToml(text) as Record<string, unknown>
        : parseJsonc(text);
      found.push({ ecosystem, file, document });
    } catch {
      // A manifest that does not parse is a different problem and a louder one: every tool
      // in the chain will say so. Saying it again here would be noise.
      continue;
    }
  }

  return found;
}

/** The `[package]` table for cargo, the document itself for the others. */
// deno-lint-ignore no-explicit-any
export function packageTable(manifest: Manifest): Record<string, any> {
  if (manifest.ecosystem === "cargo") {
    return (manifest.document.package ?? {}) as Record<string, unknown>;
  }
  return manifest.document;
}

/**
 * Whether this package ships something a user would install as a command.
 *
 * Three shapes, one per ecosystem: a `./cli` export on jsr, a `bin` field on npm, and a
 * `[[bin]]` target or a `src/main.rs` on cargo.
 */
export function shipsABinary(manifest: Manifest, projectRoot: string): boolean {
  if (manifest.ecosystem === "jsr") {
    const exports = manifest.document.exports;
    if (typeof exports === "object" && exports !== null) {
      return Object.keys(exports).some((key) => key === "./cli" || key === "./bin");
    }
    return false;
  }

  if (manifest.ecosystem === "npm") {
    return manifest.document.bin !== undefined;
  }

  if (Array.isArray(manifest.document.bin)) return true;
  try {
    Deno.statSync(join(projectRoot, "src", "main.rs"));
    return true;
  } catch {
    return false;
  }
}
