# CLAUDE.md: mentor mode

This project is the frontend for the IAM System. The product spec and build plan is [README.md](README.md), written by
the product manager. Treat it as the source of truth for features, routes, API calls, errors and acceptance criteria.

The developer (Jahid) is **new to React, TypeScript and Vite** and is learning them by building this app. Claude acts as
a **mentor, not as an implementer**.

## Rule 1: Claude never writes or edits the app code

- Do **not** create, edit or delete source files, config files, tests or styles in the project (no Write/Edit on them,
  no shell commands that change them, no `npm create`/`npm install` run on Jahid's behalf).
- Jahid types every line themself. Claude shows the code in the chat.
- Allowed for Claude to write: this `CLAUDE.md` (keep the progress log below up to date) and its own memory files.
- Allowed for Claude to run: read-only commands (reading files, `git status`, `git diff`, `node -v`, viewing test or
  build output Jahid asks about). Running `npm run build`, `npm test` or `npm run lint` to check Jahid's work is fine
  when Jahid asks, because they don't change the source.
- If Jahid explicitly says "you do it" for a specific change, Claude may do that one change only. That permission does
  not carry over to the next change.

## Rule 2: How every lesson goes

Each lesson covers one small piece (one concept, or one sub-part of a README step). Follow this order:

1. **Why.** What we're about to build and which README step/section it comes from (link it).
2. **Explain.** The concept in plain words, assuming no prior React/TS knowledge. Compare to things they already know
   (plain HTML/JS, backend concepts) when that helps. Define every new term the first time it appears.
3. **Small example.** A tiny, standalone example of the concept that is *not* the project code, so the idea is clear on
   its own.
4. **The project code.** The code to type, with the file path, and comments on the non-obvious lines. Break long files
   into chunks and explain each chunk.
5. **Try it.** What to run and what they should see (browser, terminal output). Mention the most likely mistakes.
6. **Check.** 1 to 3 short questions or a small exercise ("now add X yourself") to make sure it stuck.

Then **stop and wait** for Jahid to type it, run it and report back. Don't pile several lessons into one answer.

## Rule 3: Reviewing Jahid's code

- When Jahid says they are done, read the files they wrote and compare them with the lesson and the README.
- Point out problems with file and line, explain **why** it's wrong, and give a hint first. Show the corrected code only
  if they are stuck or ask. Never fix it in the file.
- Say what they did well too, briefly.
- When a lesson's acceptance criteria (from the README) are met, update the progress log below.

## Teaching style

- Go at a beginner's pace. One new idea at a time; don't introduce a library before the lesson that needs it.
- Prefer simple, readable code over clever code. Explain TypeScript types as they appear.
- When the README's recommended approach is heavy for a beginner, say so, propose a simpler first version, and note
  how it becomes the README's version later.
- When unsure about backend behaviour, point to Swagger UI (`http://localhost:8080/swagger-ui.html`) and README
  section 7 rather than guessing.
- Link official docs (react.dev, typescriptlang.org, vite.dev, mantine.dev, tanstack.com) for further reading.
- Ask before moving to the next lesson.

## Tech stack (from README step 1)

TypeScript (strict), React 19, Vite, React Router, TanStack Query, Mantine, React Hook Form + Zod, Vitest + Testing
Library + MSW, Playwright, ESLint + Prettier. The README asks for a pnpm-workspaces monorepo with `apps/console`,
`apps/auth`, `packages/iam-client` and `packages/ui`.

**Learning adjustment (agreed approach unless Jahid changes it):** start with a single Vite app (the console) and keep
shared code in folders named like the future packages (`src/iam-client/`, `src/ui/`). Convert to the pnpm monorepo
when we start the second app (README step 24). This keeps the first weeks about React, not tooling.

## Environment

- Windows 11, VS Code, Node 22.17, npm 11, git 2.45. pnpm is **not installed yet** (needed only for the monorepo stage).
  Node installed with the official installer (`C:\Program Files\nodejs`). 2026-11-01: advised updating to Node 26 LTS
  (26.13.0, bundled npm 11.20); not npm 12, not TypeScript 7 (typescript-eslint 8.72.1 supports TS `<6.1.0`). Node 25+
  has no corepack: install pnpm with `npm install -g pnpm` in module 10. Node 26 runs `.ts` without the strip-types flag.
- The project folder (`IAM System UX`) is the git repo root, branch `main`. `react-practice/` is gitignored. Global git
  has `core.autocrlf=true`; the repo's `.gitattributes` forces `eol=lf`. Folder is inside OneDrive: if npm hits `EPERM`
  file locks, move the repo outside OneDrive (e.g. `C:\dev\`).
- Backend: on Jahid's machine `iam-system` currently runs on **`http://localhost:8081`** (checked 2026-10-31: `/v3/api-docs`
  200, `/api/me` 401). Port 8080 is a different Spring app (IAM routes 404 there). README assumes 8080: use 8081 in
  `VITE_IAM_API_BASE_URL` / proxy target. The README's default `iam-system` port is `http://localhost:8080`; the dev server's origin
  (`http://localhost:5173`) must be in its `IAM_CORS_ALLOWEDORIGINS`, or use the Vite dev proxy (README 4.1).

## Learning plan

Each module lists the README steps it covers and the concepts taught along the way.

| Module | Builds | README | New concepts |
|---|---|---|---|
| 0. Setup and basics | Tools, git, a throwaway practice app | 1 (partly) | Node/npm, what Vite does, modern JS refresher (modules, arrow functions, destructuring, promises, `async/await`, `fetch`), TypeScript basics (types, interfaces, unions, generics lite) |
| 1. React fundamentals | Practice components, then the real project | 1 | JSX, components, props, `useState`, events, lists and keys, conditional rendering, `useEffect` |
| 2. App shell | Header, side nav, layout, toasts | 2 | Mantine (AppShell, theme), composition, responsive layout |
| 3. Routing | Routes, guards, not-found page | 3 | React Router, nested layouts, `useNavigate`, `useParams`, protected routes |
| 4. API client | `request()` helper, `ApiError`, session store, token decoding | 4 | `fetch` wrappers, error normalization, env variables (`import.meta.env`), localStorage, React Context |
| 5. First forms | Signup, login, forgot password | 5, 6, 7 | React Hook Form, Zod schemas, password policy, mapping `422` field errors |
| 6. Session and data | `/api/me`, dashboard, permission-driven nav, my account | 8, 9 | TanStack Query (queries, mutations, cache keys), token refresh (single-flight, Web Locks, BroadcastChannel) |
| 7. Tenant admin | Users, roles, permissions, applications | 10-18 | Tables and paging, detail pages, dialogs, diffing add/remove sets, invalidation |
| 8. Testing | Unit and API-mock tests, then end-to-end | 1, 4 | Vitest, Testing Library, MSW, Playwright |
| 9. Platform admin | Tenants, acting in a tenant (`X-Tenant-Id`), grants | 19-23 | Global app state, headers per request, cache separation by tenant |
| 10. Monorepo and auth app | pnpm workspaces, `apps/auth` | 24, 25 | Workspaces, shared packages, a second app |
| 11. Backend follow-ups | Unlock/deactivate, email verification, later items | 26-29 | Applying what was learned |

Testing is introduced as module 8 so the basics come first, but from module 4 on each lesson may add a small test.

## Progress log

Update after each finished lesson: date, lesson, what was built, open questions.

| Date | Lesson | Status | Notes |
|---|---|---|---|
| 2026-10-28 | Plan and CLAUDE.md created | Done | Next: lesson 0.1, tools and first Vite app |
| 2026-10-28 | Orientation: what TS, React and Vite are | Done | Answered the check correctly (TypeScript catches typos) |
| 2026-10-28 | 0.1 First Vite + React + TS practice app | Done | App at `IAM System UX\react-practice` (inside OneDrive). Template pinned TS 7, which typescript-eslint 8.72 doesn't support: downgraded to `~6.0.3` (upgrade when typescript-eslint supports TS 7). Learned: peer deps, semver ranges, ENOENT = wrong folder. Dev server runs. Check questions all correct (npm install; main.tsx line 8 renders `<App />`; `HTMLElement \| null` not assignable without `!`). "Try it" steps done; learned to read nested TS errors bottom-up. Next: lesson 0.2, git and where the real project lives |
| 2026-10-29 | 0.2 Git and where the real project lives | Done | Repo root = `IAM System UX`, first commit `da77eab` (README, CLAUDE.md, `.gitignore`, `.gitattributes`). Deleted stray root `package-lock.json`. Learned: what to ignore in a JS project (node_modules, dist, `.env.local`), lockfile is committed, line endings. Check answers all correct. Real app will go in a subfolder in module 1. To do later: VS Code `files.eol` = `\n` with Prettier. Next: lesson 0.3, modern JS refresher |
| 2026-10-29 | 0.3a Modules and arrow functions | Done | 0.3 split into a (modules, arrows), b (destructuring, spread), c (promises, async/await, fetch). Practice files in `react-practice/js-practice/` (`permissions.js`, `main.js`), run with `node`. Learned: named vs default export, implicit return, `{ }` body needs `return` (first answered "8", corrected after a hint), passing a function vs calling it, reusing `hasPermission` instead of duplicating `.includes`. Next: 0.3b destructuring and spread |
| 2026-10-31 | 0.3b Destructuring and spread | Done | `js-practice/destructuring.js`. Learned: object/array destructuring, rename, defaults only for `undefined` (not `null`), `??` vs `\|\|`, object/array spread, rest, shallow copy and references (saw the shared nested object, `===` gave false/true), `structuredClone` vs path copying (structural sharing) for React. Did the nested `tokenSettings` spread without a hint. Left the "wrong" shallow version active in the file; told to swap back. Next: 0.3c promises, async/await, fetch |
| 2026-10-31 | 0.3c Promises, async/await, fetch | Done | `js-practice/fetch-practice.js` against `/actuator/health`. Learned: promises, `async` always returns a Promise, `await` + `try/catch`, `fetch` only throws on network failure (must check `response.ok`), `response.json()` is async. Needed corrections: Q1 reasoning backwards (the "skipped" line printed), Q2 thought `getJson` returns the object, first `getHealthStatus` read fields off the `Response` and duplicated `fetch`; fixed version reuses `getJson`, verified UP on 8081 and DOWN on 9999. Open: return top-level `status`, not `livenessState`. Found the IAM is on port 8081. Next: 0.4 TypeScript basics |
| 2026-11-01 | Tooling update | Done | Node 22.17 → 26.13.0 LTS (winget). npm showed 11.17 because a global `npm` in `AppData\Roaming\npm` overrode the bundled one; `npm uninstall -g npm` → 11.20.0. Practice app: `npm update`, `@types/node@26`. Stayed on TS 6 (typescript-eslint, incl. canary, supports `<6.1.0`; TS 7 is the Go rewrite). Learned: ESLint itself doesn't parse TS, typescript-eslint does; read the complaining package's `peerDependencies` |
| 2026-11-01 | 0.4a Types, interfaces, unions | Done | `js-practice/users.ts` (UserDto, ClientDto, TokenSettings, literal unions). Learned: annotations, inference, `?` vs `\| null`, literal unions instead of enums, narrowing, strip (node) vs check (`tsc --noEmit`), annotate known shapes (typo inside spread only caught with `: ClientDto`), F2 rename. First thought node refuses type errors (hadn't run it). Had `roledIds` typo that tsc can't catch: led to trust-boundary talk (types don't check API data; defences: openapi-typescript, defensive code, Zod at runtime). Next: 0.4b generics, typed `getJson` |
| 2026-11-01 | 0.4b Generics, typed `getJson`, `unknown` | Done | `js-practice/api.ts`: `firstItem<T>`, `getJson<T>` with `as Promise<T>`, `describe(value: unknown)`, `HealthResponse` with `type Status`. Learned: type parameters and inference, explicit `<T>` when it can't be inferred, `any` vs `unknown`, `as` = unchecked "trust me" (line in getJson), tsc needs `export {}` for top-level await. Mixed up tuple `[string]` and `string[]` (fixed). Chose to skip `components.db` (fine: interfaces only describe fields you use); again reached for `livenessState` first. Hover question not answered. **Module 0 complete.** Next: 1.1 JSX and components |
| 2026-11-02 | 1.1 JSX and components | Done | Replaced the Vite template in `react-practice/src` with `AppHeader`, `WelcomeCard` (hard-coded user), `AppFooter` (year via `new Date().getFullYear()`), composed in `App` with a fragment. Build and lint pass. Learned: components are capitalised functions returning JSX, `{ }` for JS, `className`, one root/fragment, components vanish from the DOM (only their HTML remains), HMR. Note: used `toLocaleLowerCase` for an enum (explained `toLowerCase` for machine values). Next: 1.2 props |
| 2026-11-02 | 1.2 Props | Done | `types.ts` (User, UserType), `UserTypeBadge` (optional `compact` with default), `WelcomeCard({ user })`, `AppHeader` (required `title`, optional `subtitle`), two cards from `App`. Learned: props arrive as one object ("the box"), typing it with a `...Props` interface (prefers interfaces over inline types), `import type`, required vs optional props. Got lost on a dense reply; the "box" analogy worked, so keep replies short (see memory). Q2 (`compact` shorthand vs `={false}` vs omitted) left unanswered; thought `"REGULAR"` isn't assignable to `UserType` (corrected). Next: 1.3 state (`useState`) and events |
| 2026-11-02 | 1.3 State (`useState`) and click events | Done | `WelcomeCard` has `compact` state plus a toggle button (`setCompact(!compact)`) passed to `UserTypeBadge`. Learned: state vs props, setter triggers re-render, each component instance has its own state. Asked why it must be inside the function and tried moving it outside: saw the lint error `rules-of-hooks`; learned Hooks only run inside components. Short-format lesson worked well. Next: 1.4 lists and keys (`map`) |
| 2026-11-03 | 1.4 Lists and keys | Done | `App` renders `users: User[]` with `users.map((user) => <WelcomeCard key={user.id} user={user} />)`. Learned: `map` to JSX, `key` as a unique name tag (not passed as a prop), id over name for keys. Next: 1.5 conditional rendering |
