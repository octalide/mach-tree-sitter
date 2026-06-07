#include "tree_sitter/parser.h"

// External token kinds, in the order declared in grammar.js `externals`.
enum TokenType {
    ASM_BODY,
};

void *tree_sitter_mach_external_scanner_create(void) { return NULL; }

void tree_sitter_mach_external_scanner_destroy(void *payload) {}

unsigned tree_sitter_mach_external_scanner_serialize(void *payload, char *buffer) {
    return 0;
}

void tree_sitter_mach_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {}

// Scans the raw body of an inline-asm block: every character after the opening
// `{` up to its brace-matched `}`, which is left unconsumed for the grammar.
// Nested `{ }` are balanced by depth; `#` line comments and string/char
// literals inside the body are skipped so their braces never affect depth.
bool tree_sitter_mach_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {
    if (!valid_symbols[ASM_BODY]) {
        return false;
    }

    int depth = 0;
    bool consumed = false;

    while (lexer->lookahead != 0) {
        if (lexer->lookahead == '}' && depth == 0) {
            break;
        }

        if (lexer->lookahead == '#') {
            // line comment: skip to end of line
            while (lexer->lookahead != 0 && lexer->lookahead != '\n') {
                lexer->advance(lexer, false);
            }
            consumed = true;
            continue;
        }

        if (lexer->lookahead == '"' || lexer->lookahead == '\'') {
            int32_t quote = lexer->lookahead;
            lexer->advance(lexer, false);
            while (lexer->lookahead != 0 && lexer->lookahead != quote) {
                if (lexer->lookahead == '\\') {
                    lexer->advance(lexer, false);
                    if (lexer->lookahead == 0) {
                        break;
                    }
                }
                lexer->advance(lexer, false);
            }
            if (lexer->lookahead == quote) {
                lexer->advance(lexer, false);
            }
            consumed = true;
            continue;
        }

        if (lexer->lookahead == '{') {
            depth++;
        } else if (lexer->lookahead == '}') {
            depth--;
        }

        lexer->advance(lexer, false);
        consumed = true;
    }

    if (!consumed) {
        return false;
    }

    lexer->result_symbol = ASM_BODY;
    return true;
}
