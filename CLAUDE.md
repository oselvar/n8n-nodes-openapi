# Guidelines for Claude

## Development Commands

```bash
# Install dependencies
pnpm build

# Typecheck and fix
pnpm lint:fix

# Run tests
pnpm test

# Run a single test file
pnpx vitest path/to/test.ts

```

## Coding workflow

The project uses TDD: Red-green-refactor.

- A test should always be written before writing any new code.
- Run the tests before and after making a change
- Refactor long functions and duplications after all tests are green

We avoid using vitest's mocking API. Never import vi from vitest.

After finishing a change, run `make` to generate code.
After running `make` you should run `npm run check` to ensure all code is compiled, linted and formatted.

## Imports and npm modules

- Always import node libraries with the `node:` prefix.
- Always install npm modules with --exact

## Exception handling

Do not use try/catch if the error cannot be handled adequately - let errors bubble up.

## Code style

- Use `readonly` as much as possible for array types
- Prefer short functions - split long functions into shorter ones with call to smaller functions.
- Put helper functions at the bottom of the file
- For file access, use `node:fs/promises`
- Do not comment the code. Write self-documenting code with revealing function and variable names.
- Do not define functions or methods with optional parameters.
- Only use `interface` when there are methods. Otherwise use `type`.
