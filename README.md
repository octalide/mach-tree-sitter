# tree-sitter-mach

[Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for the [Mach](https://github.com/octalide/mach) programming language.

## Overview

This grammar provides parsing support for Mach source files (`.mach`), enabling:

- **Syntax highlighting** in editors that support Tree-sitter (Zed, Neovim, Helix, Emacs, etc.)
- **Code folding** and **indentation** based on language structure
- **Structural queries** over Mach source code

## Usage

### In Zed

This grammar is consumed by the [mach-zed](https://github.com/octalide/mach-zed) extension. You don't need to install it separately — the Zed extension references this repository directly.

### In Neovim

Add the parser to your `nvim-treesitter` configuration:

```lua
local parser_config = require("nvim-treesitter.parsers").get_parser_configs()
parser_config.mach = {
  install_info = {
    url = "https://github.com/octalide/tree-sitter-mach",
    files = { "src/parser.c" },
    branch = "main",
  },
  filetype = "mach",
}
```

Then copy the `queries/` directory into your Neovim runtime path under `queries/mach/`.

### In Helix

Add an entry to your `languages.toml`:

```toml
[[language]]
name = "mach"
scope = "source.mach"
file-types = ["mach"]
comment-token = "#"

[[grammar]]
name = "mach"
source = { git = "https://github.com/octalide/tree-sitter-mach", rev = "main" }
```

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [tree-sitter-cli](https://github.com/tree-sitter/tree-sitter/tree/master/cli)

Install the CLI globally or use the project-local version:

```bash
npm install
```

### Generate the parser

```bash
npm run generate
```

This reads `grammar.js` and produces the C parser source under `src/`.

### Run tests

```bash
npm test
```

Tests are defined in `test/corpus/` as Tree-sitter test files. Each file contains input/output pairs showing the expected parse tree for a given snippet of Mach code.

### Parse a file

```bash
npx tree-sitter parse path/to/file.mach
```

### Preview highlighting

```bash
npx tree-sitter highlight path/to/file.mach
```

## Language Coverage

The grammar covers the full Mach language surface:

| Feature | Status |
|---|---|
| Comments (`#`) | ✅ |
| Imports (`use`) | ✅ |
| Declarations (`val`, `var`, `def`, `ext`) | ✅ |
| Records and unions (`rec`, `uni`) | ✅ |
| Functions and methods (`fun`) | ✅ |
| Control flow (`if`, `or`, `for`, `ret`, `brk`, `cnt`, `fin`) | ✅ |
| Generics (`Type[T]`, `fun name[T]()`) | ✅ |
| Pointers (`*T`, `&T`, `?`, `@`) | ✅ |
| Arrays (`[N]T`) | ✅ |
| Type casting (`::`) | ✅ |
| Composite literals (`Type{ ... }`, `[N]T{ ... }`) | ✅ |
| Inline assembly (`asm`) | ✅ |
| Compile-time (`$if`, `$mach.*`, `$size_of`, etc.) | ✅ |
| Tests (`test "name" { ... }`) | ✅ |
| All operators and precedence levels | ✅ |

## Project Structure

```
tree-sitter-mach/
├── grammar.js              # Grammar definition
├── queries/
│   ├── highlights.scm      # Syntax highlighting queries
│   └── indents.scm         # Auto-indentation queries
├── test/
│   └── corpus/             # Tree-sitter test cases
├── package.json
└── README.md
```

## License

[MIT](../mach/LICENSE)