## Guidance for agents

- Read the relevant app's `AGENTS.md` before changing anything under `apps/*`.
- Do not commit, push, or open pull requests unless asked.
- Never commit secrets, `.env` files, API keys, or customer data.
- Do not delete or force-push `dev` or `main` — and do not attempt to
  work around the rulesets that prevent it.
- Match the surrounding code's style rather than importing conventions from
  elsewhere.
- Keep these files true. When your change makes a statement wrong — a command,
  a port, a version, a test count — update it as part of the same change rather
  than leaving it stale. Put repo-wide facts here and app-specific facts in the
  app's own file.
- Keep comments to a minimum. Never add comments for the sake of it. Do not add JSDoc comments throughout the code.
- Make commits at logical checkpoints, do not allow changes to build up.
