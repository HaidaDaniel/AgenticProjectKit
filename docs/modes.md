# Modes

## discovery

Used when the user has a rough idea and needs to turn it into requirements.

Focus:

- product idea clarification;
- user personas;
- problem definition;
- key flows;
- constraints;
- risks;
- candidate MVP scope.

## mvp

Used when the goal is to ship quickly.

Rules:

- delivery over perfection;
- minimal abstractions;
- vertical slices;
- no premature scaling;
- strict out-of-scope control;
- only critical tests;
- fast iteration;
- small atomic tasks.

## product

Used after MVP validation.

Rules:

- stabilize architecture;
- improve UX;
- refine the data model;
- add missing tests;
- reduce technical debt;
- improve maintainability;
- prepare for real users.

## production

Used for production-grade development.

Rules:

- safer changes;
- stronger testing;
- security checks;
- observability;
- deployment documentation;
- migration policy;
- backup and restore;
- monitoring;
- error handling;
- no risky changes without an explicit task.

## maintenance

Used for bugfixing, small features, refactoring, and ongoing development.

Rules:

- preserve behavior;
- avoid unnecessary rewrites;
- keep diffs small;
- add regression tests when possible;
- update documentation when behavior changes.

## audit

Used to analyze a repository without changing its code.

Rules:

- inspect project structure;
- infer stack;
- find missing docs;
- find missing agent instructions;
- create a project map;
- create a documentation debt report;
- do not modify source code.

## adopt

Used to add Agentic Project Kit structure to an existing project.

Rules:

- do not rewrite existing code;
- generate docs based on observed structure;
- create an initial AGENTS.md;
- create a project map;
- create tasks for documentation cleanup;
- preserve existing conventions.

