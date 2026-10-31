# Mint with X Money

A Genesis number is a claim that someone paid $10, not an NFT. Installing a bot from the gallery is free. Claims are closed until Genesis launches (`claims.state.json` has `"open": false`). The test-setup ownership token in [loader-and-test-mint.md](loader-and-test-mint.md) is separate. It is not a Genesis launch, and this repository does not call X Money.

X Money is available to eligible customers in the United States. This repository has no X Money client. It does not read balances, send payments, or request money. The shipped skills in `integrations/x-money/` are text a person can install later. Nothing here calls them.

`botmint mint nonce genesis random` prints `$10.00`, the payee `@brandononchain`, and a note. It does not check a live registry beyond the local file, and it does not create a payment.

```text
botmint genesis random bm-7KQ2-9XPA private
```

Up to three preferred numbers are allowed: `botmint genesis #0001,#0002,#0003 <nonce> public`.

Assignment (`botmint claims assign`) matches a local transaction export. While claims are closed, a payment is rejected and queued for a refund the project owner approves by hand. The CLI never sends the refund.

See `docs/refunds.md`. The legal checklist (terms, business account, published refund policy) is not done, and it blocks opening claims. It does not block this offline build.
