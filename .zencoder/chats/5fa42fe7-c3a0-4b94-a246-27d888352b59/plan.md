# Spec and build

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:

- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

---

## Workflow Steps

### [x] Step: Technical Specification

Assess the task's difficulty, as underestimating it leads to poor outcomes.

- easy: Straightforward implementation, trivial bug fix or feature
- medium: Moderate complexity, some edge cases or caveats to consider
- hard: Complex logic, many caveats, architectural considerations, or high-risk changes

Create a technical specification for the task that is appropriate for the complexity level:

- Review the existing codebase architecture and identify reusable components.
- Define the implementation approach based on established patterns in the project.
- Identify all source code files that will be created or modified.
- Define any necessary data model, API, or interface changes.
- Describe verification steps using the project's test and lint commands.

Save the output to `c:\Users\Admin\Desktop\odare\.zencoder\chats\5fa42fe7-c3a0-4b94-a246-27d888352b59/spec.md` with:

- Technical context (language, dependencies)
- Implementation approach
- Source code structure changes
- Data model / API / interface changes
- Verification approach

If the task is complex enough, create a detailed implementation plan based on `c:\Users\Admin\Desktop\odare\.zencoder\chats\5fa42fe7-c3a0-4b94-a246-27d888352b59/spec.md`:

- Break down the work into concrete tasks (incrementable, testable milestones)
- Each task should reference relevant contracts and include verification steps
- Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function).

Save to `c:\Users\Admin\Desktop\odare\.zencoder\chats\5fa42fe7-c3a0-4b94-a246-27d888352b59/plan.md`. If the feature is trivial and doesn't warrant this breakdown, keep the Implementation step below as is.

**Stop here.** Present the specification (and plan, if created) to the user and wait for their confirmation before proceeding.

---

### [x] Step: Backend Implementation
Update backend Stripe Checkout Session route `POST /wallet/create-payment-intent` in `.\moovr-backend\routes\walletRoutes.js` to return `session.url` in the response JSON alongside `sessionId`.

Verification:
- Perform static check of backend files.

### [x] Step: User-Panel Wallet Implementation
Update the user-panel Wallet component `.\moovr-web\src\pages\user-panel\Wallet.jsx`:
- Modify the `addMoney` function to directly redirect to the URL returned from the backend (`response.data.url`) using `window.location.href`.
- Remove the unused `@stripe/stripe-js` imports and the client-side `stripePromise` initializer.

Verification:
- Ensure the component loads properly.

### [x] Step: Driver-Panel Wallet Implementation
Update the driver-panel Wallet component `.\moovr-web\src\pages\driver-panel\Wallet.jsx`:
- Modify the `addMoney` function to directly redirect to the URL returned from the backend (`res.data.url`) using `window.location.href`.
- Remove the unused `@stripe/stripe-js` imports and the client-side `stripePromise` initializer.
- Fix the amount conversion bug so `amount` in Naira is passed directly to the backend instead of multiplying by 100 on both client and server side.

Verification:
- Ensure the component loads properly.

### [x] Step: Quality Assurance and Build Verification
Verify the codebase health:
- Run `npm run lint` inside `.\moovr-web` to check for linter issues.
- Run `npm run build` inside `.\moovr-web` to confirm the application builds cleanly without errors.
- Manual test checkout flow redirection.
- Upon completion, write a report to `c:\Users\Admin\Desktop\odare\.zencoder\chats\5fa42fe7-c3a0-4b94-a246-27d888352b59/report.md` describing:
   - What was implemented
   - How the solution was tested
   - The biggest issues or challenges encountered
