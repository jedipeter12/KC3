# Development

## Prerequisites

Application prerequisites are not yet known because the Expo project has not been
scaffolded. Do not infer tool versions or package managers. At present, only Git is
needed to work with the documentation repository.

- Git
- Node.js/package manager version: To be selected and documented during
  scaffolding.
- Expo and platform tooling: To be selected and documented during scaffolding.

## Initial Setup

There is currently no application setup procedure. Add exact, verified commands
after scaffolding; do not leave example commands that appear runnable.

## Running Locally

Not available until the application is scaffolded.

## Building

Not available until the application is scaffolded.

## Testing

### Unit Tests

No unit-test framework or command has been selected.

### Integration / UI Tests

No integration or UI test framework or command has been selected.

## Linting / Formatting

No linting or formatting tools have been selected.

## Environment Variables / Secrets

Never commit production secrets to the repository.

Document required variable names without including their secret values.

No environment variable names are confirmed yet. Document the exact public client
configuration and server-side secrets required by Supabase during scaffolding.
Never place secret values in documentation, source control, or client-exposed
configuration.

## Branching / Git Workflow

- Keep `main` in a reviewable state.
- Create a focused branch for non-trivial work.
- Use descriptive, focused commits and do not mix unrelated changes.
- Do not push, merge, or otherwise modify remote state unless the specific task
  authorizes it.

## Roles and Delivery Workflow

- The user is the Product Owner and approves product behavior and scope.
- ChatGPT may act as PM, architect, and technical translator to turn product intent
  into repository documentation and scoped tickets.
- Codex acts as developer for approved tickets: read repository guidance, make the
  smallest in-scope change, run appropriate checks, and report results.
- Use this flow:
  `idea or decision → repository documentation → scoped Codex ticket → implementation and tests → Product Owner review`.
- `ROADMAP.md` is the PM backlog and should reflect work that is started,
  completed, deferred, or reprioritized.
- Autonomous multi-agent orchestration is not required for the initial workflow.

## Ticket Completion Checklist

Each implementation ticket should direct the developer to:

1. Read `AGENTS.md`, `README.md`, and the relevant files in `docs/`.
2. Confirm the requested behavior is approved and scoped.
3. Avoid unrelated changes and preserve existing behavior.
4. Add or update tests when behavior changes.
5. Run the relevant tests and build checks.
6. Update affected documentation.
7. Report changed files, checks run, and remaining risks or follow-up work.

## Development Conventions

- Language: Write new application logic in TypeScript. JavaScript may remain where
  tooling requires it.
- File organization: Follow the scaffolded project structure once it exists; do
  not invent a parallel structure without a documented reason.
- Error handling: Follow established project patterns once defined.
- Logging: Do not log credentials or sensitive data; a broader strategy is not yet
  defined.
- Dependency policy: Prefer existing dependencies and patterns. Add a dependency
  only for a clear, documented reason.

## Deployment / Release Process

No deployment or release process exists yet. Document exact, verified steps after
hosting and release tooling are selected.

## Troubleshooting

No application-specific troubleshooting guidance exists yet.
