# Contributing to Game Planner Pro

Thanks for helping improve Game Planner Pro. Bug reports, focused feature proposals, documentation fixes, tests, and code contributions are welcome.

## Before opening an issue

- Search existing issues to avoid duplicates.
- Include the platform, app version, reproduction steps, expected result, and actual result.
- Remove API keys, project secrets, and personal data from logs and screenshots.
- Follow [SECURITY.md](SECURITY.md) for vulnerabilities or other sensitive reports.

## Development workflow

1. Fork the repository and create a focused branch.
2. Install dependencies with `npm install`.
3. Run the app with `npm run dev`.
4. Add or update tests for behavior changes.
5. Run the quality checks before opening a pull request:

   ```bash
   npm run lint
   npm test
   npm run build
   ```

6. Open a pull request that explains the problem, the approach, verification performed, and any user-facing change.

Keep pull requests small when practical. Maintainers may ask for changes to preserve local-first behavior, data compatibility, accessibility, or cross-platform support.

## Commit guidance

Use concise, descriptive commit messages. Do not commit generated build outputs, editor state, credentials, user projects, or local environment files.

By contributing, you agree that your contribution is licensed under the repository's [MIT License](LICENSE).
