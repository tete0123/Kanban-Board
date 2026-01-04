# Kanban Board for VS Code

A lightweight Kanban board inside Visual Studio Code for managing TODOs.

## Overview

Manage tasks on a Kanban board without leaving VS Code. Columns and cards are
stored in your workspace and can be versioned with your project.

![Kanban Demo](https://raw.githubusercontent.com/tete0123/Kanban-Board/main/images/demo.gif)

## Features

- Create, rename, reorder, and delete columns (drag the handle to reorder).
- Create, edit (double click), delete, and move cards with drag and drop.
- Set optional due dates on cards.
- Persist data in your workspace as Markdown with front matter.

## Usage

1. Open the Command Palette.
2. Run `Kanban: Open Board`.
3. Use `+ Add Column` to add columns.
4. Use `+ Add` in a column to create cards.
5. Double click a card to edit it.

## Commands

- `Kanban: Open Board` (`kanban.openBoard`) in the Command Pallete (`ctrl+shift+P`).

## Data Storage

Data is stored under your workspace:

- `.vscode-kanban/index.json` for column metadata and ordering
- `.vscode-kanban/cards/*.md` for cards (front matter + body)

## Notes / Limitations

- A workspace must be open.
- The last column cannot be deleted.

## Requirements

- VS Code `^1.88.0`

## Release Notes

- 0.0.1 Initial release
