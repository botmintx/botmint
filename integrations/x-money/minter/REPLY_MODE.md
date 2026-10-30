# Reply mode (use only if X Money activity does not show payment notes)

1. Collectors pay exactly $10.00 to @brandononchain, then reply to the pinned botmint Genesis post on X with: botmint genesis <choice> <nonce> <public|private>
2. The Mint Desk routine reads the replies to that post and the X Money activity, and writes replies.json: [{ "handle": "@name", "text": "<reply text>", "postedAt": "<ISO time>" }].
3. `botmint claims assign` matches a $10.00 payment to a reply from the same handle posted within 24 hours either side of the payment. The earliest unmatched reply wins.
4. Payments without a matching reply are held for 72 hours, then queued for refund.
5. Reply mode makes the handle public; anyone choosing private must use note mode or the waitlist.
