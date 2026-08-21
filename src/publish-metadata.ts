//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    Hiisi Digital                    ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0      contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Whether a manifest carries what its registry needs and what its readers want.
 *
 * The fields a registry rejects a publish over are easy: the publish fails and somebody
 * fixes it. The ones this exists for are the fields nothing rejects and everything is worse
 * without, which get left out because the package works fine from the repository the whole
 * time it is being written. A crate with no keywords is unfindable, and a crate whose
 * interesting surface is behind a feature flag documents an empty shell on docs.rs.
 *
 * @module
 */

import {
  BaseLinter,
  type CodebaseData,
  type Issue,
  type IssueCatalog,
  type LinterConfig,
  type LinterDataRequirements,
  type LinterMeta,
} from "@hiisi/viola";

import { type Ecosystem, type Manifest, packageTable, readManifests } from "./manifest.ts";

/** What each registry refuses to publish without. */
const REQUIRED: Record<Ecosystem, readonly string[]> = {
  jsr: ["name", "version", "exports", "license"],
  npm: ["name", "version", "license"],
  cargo: ["name", "version", "description", "license"],
};

/**
 * What nothing enforces and every reader wants.
 *
 * `documentation` is deliberately absent for cargo: leaving it out makes crates.io link
 * docs.rs, which is what you want, so demanding it would be demanding the worse option.
 */
const RECOMMENDED: Record<Ecosystem, readonly string[]> = {
  jsr: ["description"],
  npm: ["description", "repository", "homepage", "keywords"],
  cargo: ["description", "repository", "keywords", "categories", "rust-version", "readme"],
};

/** At most five, twenty characters, ASCII, starting alphanumeric. */
const KEYWORD = /^[A-Za-z0-9][A-Za-z0-9_+-]{0,19}$/;

export class PublishMetadataLinter extends BaseLinter {
  readonly meta: LinterMeta = {
    id: "publish-metadata",
    name: "Publish Metadata",
    description: "Manifest fields a registry needs, and the ones nothing enforces",
  };

  readonly catalog: IssueCatalog = {
    "publish-metadata/missing-required": {
      category: "correctness",
      impact: "critical",
      description: "A field the registry refuses to publish without is absent",
    },
    "publish-metadata/missing-recommended": {
      category: "maintainability",
      impact: "major",
      description: "A field nothing enforces and every reader wants is absent",
    },
    "publish-metadata/invalid-keyword": {
      category: "correctness",
      impact: "major",
      description: "A keyword breaks the registry's rules and will be refused at publish",
    },
    "publish-metadata/too-many": {
      category: "correctness",
      impact: "major",
      description: "More keywords or categories than the registry accepts",
    },
    "publish-metadata/docs-rs-default-features-only": {
      category: "maintainability",
      impact: "major",
      description: "A crate with features documents only its default surface on docs.rs",
    },
    "publish-metadata/deprecated-field": {
      category: "maintainability",
      impact: "trivial",
      description: "A manifest field the ecosystem has deprecated",
    },
  };

  readonly requirements: LinterDataRequirements = { files: true };

  lint(data: CodebaseData, _config: LinterConfig): Issue[] {
    const issues: Issue[] = [];

    for (const manifest of readManifests(data.projectRoot)) {
      issues.push(...this.checkFields(manifest));
      if (manifest.ecosystem === "cargo") {
        issues.push(...this.checkCargoSpecifics(manifest));
      }
    }

    return issues;
  }

  /** The required and recommended lists, per ecosystem. */
  private checkFields(manifest: Manifest): Issue[] {
    const issues: Issue[] = [];
    const table = packageTable(manifest);
    const at = { file: manifest.file, line: 1, column: 1 };

    for (const field of REQUIRED[manifest.ecosystem]) {
      if (table[field] === undefined) {
        issues.push({
          kind: "publish-metadata/missing-required",
          location: at,
          confidence: 100,
          message: `${manifest.file} has no \`${field}\`, which ${manifest.ecosystem} requires`,
          suggestion: `Add \`${field}\`. Publishing fails without it.`,
        });
      }
    }

    for (const field of RECOMMENDED[manifest.ecosystem]) {
      if (table[field] === undefined) {
        issues.push({
          kind: "publish-metadata/missing-recommended",
          location: at,
          confidence: 95,
          message: `${manifest.file} has no \`${field}\``,
          suggestion:
            `Nothing rejects a publish over this, which is why it gets left out. Add \`${field}\`.`,
        });
      }
    }

    return issues;
  }

  /** Keyword and category limits, docs.rs features, and the deprecated `authors`. */
  private checkCargoSpecifics(manifest: Manifest): Issue[] {
    const issues: Issue[] = [];
    const table = packageTable(manifest);
    const at = { file: manifest.file, line: 1, column: 1 };

    for (const [field, limit] of [["keywords", 5], ["categories", 5]] as const) {
      const value = table[field];
      if (!Array.isArray(value)) continue;
      if (value.length > limit) {
        issues.push({
          kind: "publish-metadata/too-many",
          location: at,
          confidence: 100,
          message: `${value.length} ${field}, and crates.io accepts at most ${limit}`,
          suggestion: `Keep the ${limit} that a searcher would actually type.`,
        });
      }
    }

    for (const keyword of (table.keywords ?? []) as string[]) {
      if (!KEYWORD.test(keyword)) {
        issues.push({
          kind: "publish-metadata/invalid-keyword",
          location: at,
          confidence: 100,
          message: `the keyword "${keyword}" is not one crates.io accepts`,
          suggestion:
            "ASCII, at most 20 characters, starting alphanumeric, then letters, numbers, " +
            "`_`, `-` or `+`. A publish is rejected outright, not warned about.",
        });
      }
    }

    // docs.rs builds with default features only. A crate whose surface is behind a flag
    // therefore publishes documentation for the shell around it.
    const hasFeatures = Object.keys(
      (manifest.document.features ?? {}) as Record<string, unknown>,
    ).some((name) => name !== "default");
    const docsRs = ((manifest.document.package as Record<string, unknown> | undefined)
      ?.metadata as Record<string, unknown> | undefined)?.["docs.rs"] as
        | Record<string, unknown>
        | undefined;
    if (hasFeatures && docsRs === undefined) {
      issues.push({
        kind: "publish-metadata/docs-rs-default-features-only",
        location: at,
        confidence: 90,
        message: "the crate has features and no `[package.metadata.docs.rs]`",
        suggestion:
          "docs.rs builds with default features only, so anything behind a flag is missing " +
          "from the published documentation. `all-features = true`, or name the set.",
      });
    }

    if (table.authors !== undefined) {
      issues.push({
        kind: "publish-metadata/deprecated-field",
        location: at,
        confidence: 100,
        message: "`authors` is deprecated",
        suggestion: "Drop it. The repository and the commit history carry this better.",
      });
    }

    return issues;
  }
}

/** The linter, ready to add. */
export const publishMetadataLinter: PublishMetadataLinter = new PublishMetadataLinter();
