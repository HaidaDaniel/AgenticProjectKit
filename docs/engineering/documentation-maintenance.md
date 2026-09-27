# Documentation Maintenance Checks

Run `node scripts/check-docs-consistency.mjs` directly, or use `pnpm quality`. The hosted quality workflow runs `pnpm quality`, so it invokes the same documentation check and test fixtures.

The checker applies deterministic rules to these sources:

- `package.json` supplies the current version, package name, repository URL, and local quality command. The release index, README, maturity policy, roadmap, and documentation home must identify the same validated release; the versioned current note must exist and match its heading.
- The README quickstart install line is derived from the package name, repository URL, and version. A tag pin that differs from those values fails with the expected command.
- Inline relative links and heading anchors are checked only in the README, documentation home, roadmap, progress page, CLI reference, release index, and maturity policy. External URL availability, reference-style links, raw HTML links, and image targets are not checked. A missing `SECURITY.md` target remains optional; when that root file exists, in-scope links to it are checked normally.
- Fenced `--context` examples in the CLI reference must name paths present in the checkout.
- The generated CLI reference block is compared byte-for-byte with the renderer in `src/cli/command-registry.ts`.
- Rows in the roadmap's **Task state rows** table link one task contract each. The checker discovers task IDs and `State` metadata from `.tasks/` (including archived task files) and compares each row without a maintained ID list.
- The release index's current package version, validated tag, table row, and release-note link must agree with `package.json`. Historical versioned release-note bodies and ADR prose are not scanned for current-value drift.

The rules do not infer product truth from prose, check external links over the network, rewrite documentation, or decide whether an unstructured milestone description is semantically accurate. Keep current task lifecycle state in the structured roadmap table and use review for claims that cannot be decided from exact values. Failures name the source file and line with a concrete correction.
