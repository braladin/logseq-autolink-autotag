# Auto-link Auto-tag Plugin for Logseq
A Logseq plugin to auto-link pages in a block and auto-tag the block with the tags of the linked pages.

![Demo](demo.gif)

Backstory: Inspired by the [Automatic Linker](https://github.com/sawhney17/logseq-automatic-linker) plugin, I wanted to have the ability to auto-tag as well. At first, I thought I could just keep using the automatic linker plugin and develop an automatic tagger plugin. However, I realized that I needed to develop a plugin that handles both auto-linking and auto-tagging in order to be able to auto-link and auto-tag in one go.

## Features
- Run when pressing enter
- Run by the slash command `Auto-link Auto-tag`
- Run by a keybinding `Ctrl+Shift+b` (configurable)
- Option to choose to auto-link all occurances of a page or only the first occurrence
- Option to choose between inserting or appending tags
- Option to choose between `[[tag]]` or `#tag` format
- Handle newly created pages and deleted pages
- Handle aliases
- Handle tasks
