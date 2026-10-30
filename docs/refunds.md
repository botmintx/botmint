# Refunds

Draft. Not in effect. Claims are closed, and no payment has been taken.

When claims are open, the assignment engine queues a refund for:

- a payment while claims are closed
- a note that cannot be read, after a 72 hour hold
- a duplicate nonce
- an underpayment (under $10.00)
- a handle already at the cap of 5
- a sold-out number
- an overpayment, for the excess only

Failed or reversed payments are released and not refunded again. The project owner approves each queued refund. `botmint claims refunds` prints the recipient, amount, and note. It does not send money.

This draft is not a promise. The published policy has to be reviewed before `claims open` is used.
