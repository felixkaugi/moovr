# Technical Specification: Stripe Checkout Deprecation Fix

## 1. Technical Context
- **Frontend**: React, Vite, Axios, React Router. Currently imports `loadStripe` from `@stripe/stripe-js`.
- **Backend**: Node.js, Express, Stripe Node.js SDK (`stripe`).
- **Issue**: Since Stripe's `2025-09-30` API and Stripe.js release, `stripe.redirectToCheckout` is fully deprecated and removed. Calling this method throws `IntegrationError: stripe.redirectToCheckout is no longer supported in this version of Stripe.js`.
- **Solution**: The recommended upgrade path is to handle redirection entirely server-side. Create the Checkout Session via the backend API, return the generated `url` property, and redirect the user using native browser navigation (`window.location.href`).

## 2. Implementation Approach
- **Backend Changes**:
  - In `.\moovr-backend\routes\walletRoutes.js`, update the `POST /create-payment-intent` route. In the response, include both the `sessionId` and the `url` from the created Stripe checkout session object:
    ```javascript
    res.json({ sessionId: session.id, url: session.url });
    ```
- **Frontend Changes**:
  - In `.\moovr-web\src\pages\user-panel\Wallet.jsx`:
    - Modify the `addMoney` function to retrieve the `url` from `response.data.url` and redirect the browser using `window.location.href = response.data.url`.
    - Clean up unused `@stripe/stripe-js` imports and the client-side `stripePromise` initializer.
  - In `.\moovr-web\src\pages\driver-panel\Wallet.jsx`:
    - Modify the `addMoney` function to retrieve the `url` from `res.data.url` and redirect using `window.location.href = res.data.url`.
    - Correct the amount bug: In the driver panel, `amountInKobo` was sent to the backend, which multiplied it by 100 again. Change it to send `amount: Number(amount)` in Naira, matching the user panel's behavior and the backend's expectation.
    - Clean up unused `@stripe/stripe-js` imports and the client-side `stripePromise` initializer.

## 3. Source Code Structure Changes
No new files are added. The following existing files are modified:
- `.\moovr-backend\routes\walletRoutes.js`
- `.\moovr-web\src\pages\user-panel\Wallet.jsx`
- `.\moovr-web\src\pages\driver-panel\Wallet.jsx`

## 4. Data Model / API / Interface Changes
- **API `POST /wallet/create-payment-intent`**:
  - Request Payload: `{ amount: number, userId: string }` where `amount` is in Naira.
  - Response Schema:
    ```json
    {
      "sessionId": "cs_test_...",
      "url": "https://checkout.stripe.com/c/pay/..."
    }
    ```

## 5. Verification Approach
- **Linting & Code Quality**:
  - Navigate to `.\moovr-web` and run:
    ```bash
    npm run lint
    ```
- **Build Checks**:
  - Navigate to `.\moovr-web` and run:
    ```bash
    npm run build
    ```
- **Manual Verification**:
  - Click "Add Cash" under both User and Driver Panels.
  - Choose a Stripe payment method and enter an amount.
  - Ensure the browser redirects to Stripe's hosted Checkout screen, and then returns to the success url on payment success.
