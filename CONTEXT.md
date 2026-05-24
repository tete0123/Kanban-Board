# Kanban Board

A workspace-local Kanban board for tracking project tasks inside VS Code.

## Language

**Card**:
A task item on the board. A card may have at most one parent card and may have zero or more child cards.
_Avoid_: Task, ticket

**Column**:
A user-defined grouping for cards on the board. A column name does not by itself define whether a card is complete.
_Avoid_: Status, completion state

**Parent-Child Card Relationship**:
A hierarchical relationship where one parent card is split into one or more child cards. Each child card has at most one parent card, child cards may themselves have child cards, and circular relationships are not allowed. A child card may be created from its parent card or attached to a parent card after both cards already exist. A card shows only its direct parent card and direct child cards, without deriving completion or progress from the relationship. Moving a card between columns does not change this relationship. When a parent card is deleted, its child cards remain as cards without a parent card.
_Avoid_: Card link, dependency, related card

## Example Dialogue

Developer: "When a large card is split, should the new card become a child card?"

Domain expert: "Yes. The original card is the parent card, and the split-out work is a child card. From either card, I need to navigate to the other side of the relationship."
