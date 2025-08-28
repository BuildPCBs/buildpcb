<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Development server:

Runs via pnpm dev, but I keep it running — you DON'T need to start it yourself.

New terminal tabs: When testing, open new terminals instead of stopping existing processes.

Hot reload: Development server automatically restarts on changes.

Logging: Use structured logging with appropriate levels.

### Documentation Rules

No new markdown files:\*\* Never create or commit a new `.md` file after adding a feature unless explicitly instructed

- Always add any md file created to gitignore
- Never add any test file, not even to test
- Never add a comment at the top of any file — place documentation where it belongs within the code

## Code Editing & Rewriting

When rewriting a file completely, always verify that the result is not empty and preserves essential logic.

Never remove unrelated code during a fix unless explicitly instructed.

When creating new files, confirm they are placed in the correct folder based on the file structure guidelines.

## Response Format

Before taking any action or writing code, always begin with a short summary of what I understand from your request and how I plan to execute it.

The summary should clearly confirm:

The main task you are asking for.

The approach or steps I will take to solve it.

Example:

Summary: You want me to create a new API route /users/:id that returns a user profile in JSON format, with role-based access control and Swagger documentation.

How I would solve: I will set up the route in Express, add authentication middleware for role-based access, define a Swagger schema, and return the user profile from the database.
THEN PROCEED

When generating code, please follow these patterns and maintain consistency with the existing codebase. Always consider the health-focused nature of the application and implement appropriate safety measures for medical content.

The approach or steps I will take to solve it.

Example:

Summary: You want me to create a new API route /users/:id that returns a user profile in JSON format, with role-based access control and Swagger documentation.

How I would solve: I will set up the route in Express, add authentication middleware for role-based access, define a Swagger schema, and return the user profile from the database.
THEN PROCEED

When generating code, please follow these patterns and maintain consistency with the existing codebase. Always consider the health-focused nature of the application and implement appropriate safety measures for medical content.
