# Store parent-child card relationships on the child card

Parent-child card relationships support splitting a large card into smaller cards while allowing navigation from either side of the relationship. We will store the relationship as a `parentId` on the child card's Markdown front matter, and derive a parent's direct child cards by scanning cards for matching `parentId` values.

This keeps the saved relationship canonical in one place, which matters because card files are user-editable Markdown and may be changed outside the webview. Storing `childIds` on parent cards, or storing both sides of the relationship, would make parent and child files easier to desynchronize and would require heavier repair rules. The UI can still present the relationship bidirectionally even though the persisted source of truth is one directional.

## Consequences

- Each child card can have at most one parent card.
- Parent cards show direct child cards by deriving them from loaded card state.
- Circular relationships must be rejected when assigning a parent.
- Missing or invalid `parentId` values should be treated as no parent and removed when the card is saved.
