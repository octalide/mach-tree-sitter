/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// Precedence levels matching Mach's operator precedence (lowest to highest).
const PREC = {
    ASSIGNMENT: 1,
    LOGICAL_OR: 2,
    LOGICAL_AND: 3,
    BITWISE_OR: 4,
    BITWISE_XOR: 5,
    BITWISE_AND: 6,
    EQUALITY: 7,
    COMPARISON: 8,
    SHIFT: 9,
    TERM: 10,
    FACTOR: 11,
    UNARY: 12,
    POSTFIX: 13,
    PRIMARY: 14,
};

// Numeric type suffix accepted on integer and float literals (e.g. 42i64, 3.0f32).
const TYPE_SUFFIX = choice(
    "u8",
    "u16",
    "u32",
    "u64",
    "i8",
    "i16",
    "i32",
    "i64",
    "f32",
    "f64",
);

module.exports = grammar({
    name: "mach",

    extras: ($) => [/\s/, $.comment],

    externals: ($) => [$.asm_body],

    conflicts: ($) => [
        // comptime path can appear as both a statement and an expression atom
        [$.comptime_expression_statement, $._expression],
        // a $-path: single identifier matches both call name and bare path head
        [$.comptime_expression, $.comptime_field_path],
        // a `$` after a comptime-if block: continue the chain or start anew
        [$.comptime_if_declaration],
        [$.comptime_if_statement],
        // an identifier is both a value atom and a type name
        [$._primary_expression, $.type_identifier],
        // identifier `[` forks between index, generic call, and qualified type
        [$._primary_expression, $.generic_type, $.type_identifier],
        // identifier `[` in type position: generic_type or end of type_identifier
        [$.generic_type, $.type_identifier],
        // after a type_identifier, `[` may continue into generic_type or stop
        [$._type, $.generic_type],
        // a primitive name inside `[` is either an index value or a type arg
        [$._primary_expression, $._type],
        // rec/uni `{` is a field block (type) or an initializer list (literal)
        [$.field_declaration_list, $.initializer_list],
        // function type optional return-type lookahead
        [$.function_type],
    ],

    word: ($) => $.identifier,

    rules: {
        source_file: ($) => repeat($._declaration),

        comment: ($) => token(seq("#", /.*/)),

        // backtick decorator: `name` or `name(args)`; attaches to the following decl
        decorator: ($) =>
            seq(
                "`",
                field("name", $.identifier),
                optional(
                    seq(
                        "(",
                        optional(seq(sep1($._expression, ","), optional(","))),
                        ")",
                    ),
                ),
                "`",
            ),

        // any declaration may carry leading pub/ext flags in any order
        _declaration: ($) =>
            choice(
                $.use_declaration,
                $.forward_declaration,
                $.type_alias_declaration,
                $.record_declaration,
                $.union_declaration,
                $.value_declaration,
                $.variable_declaration,
                $.function_declaration,
                $.test_declaration,
                $.comptime_if_declaration,
                $.comptime_expression_statement,
            ),

        // pub / ext visibility and linkage flags, any order, zero or more
        modifiers: ($) => repeat1(choice("pub", "ext")),

        // [flags] use [alias:] module.path;
        use_declaration: ($) =>
            seq(
                optional($.modifiers),
                "use",
                optional(seq(field("alias", $.identifier), ":")),
                field("path", $.module_path),
                ";",
            ),

        // fwd [alias:] module.path;  (re-export; always public, never `pub`)
        forward_declaration: ($) =>
            seq(
                "fwd",
                optional(seq(field("alias", $.identifier), ":")),
                field("path", $.module_path),
                ";",
            ),

        module_path: ($) => sep1($.identifier, "."),

        // [flags] def Alias: type;
        type_alias_declaration: ($) =>
            seq(
                optional($.modifiers),
                "def",
                field("name", $.identifier),
                ":",
                field("type", $._type),
                ";",
            ),

        // [`decorator`...] [flags] rec Name[T, U] { field: type; ... }
        record_declaration: ($) =>
            seq(
                repeat($.decorator),
                optional($.modifiers),
                "rec",
                field("name", $.identifier),
                optional($.type_parameters),
                $.field_declaration_list,
            ),

        // [`decorator`...] [flags] uni Name[T, U] { variant: type; ... }
        union_declaration: ($) =>
            seq(
                repeat($.decorator),
                optional($.modifiers),
                "uni",
                field("name", $.identifier),
                optional($.type_parameters),
                $.field_declaration_list,
            ),

        field_declaration_list: ($) =>
            seq("{", repeat($.field_declaration), "}"),

        // a leading `$` marks a comptime field (shared typed-name grammar)
        field_declaration: ($) =>
            seq(
                optional(field("comptime", "$")),
                field("name", $.identifier),
                ":",
                field("type", $._type),
                ";",
            ),

        type_parameters: ($) =>
            seq("[", optional(seq(sep1($.identifier, ","), optional(","))), "]"),

        // [`decorator`...] [flags] val name [: type] [= expr];
        value_declaration: ($) =>
            seq(
                repeat($.decorator),
                optional($.modifiers),
                "val",
                field("name", $.identifier),
                optional(seq(":", field("type", $._type))),
                optional(seq("=", field("value", $._expression))),
                ";",
            ),

        // [`decorator`...] [flags] var name [: type] [= expr];
        variable_declaration: ($) =>
            seq(
                repeat($.decorator),
                optional($.modifiers),
                "var",
                field("name", $.identifier),
                optional(seq(":", field("type", $._type))),
                optional(seq("=", field("value", $._expression))),
                ";",
            ),

        // [`decorator`...] [flags] fun name[T](params) [return_type] (block | ;)
        function_declaration: ($) =>
            seq(
                repeat($.decorator),
                optional($.modifiers),
                "fun",
                field("name", $.identifier),
                optional($.type_parameters),
                $.parameter_list,
                optional(field("return_type", $._type)),
                choice($.block, ";"),
            ),

        parameter_list: ($) =>
            seq(
                "(",
                optional(
                    choice(
                        // C-style variadic only: fun f(...)
                        $.variadic_parameter,
                        // comptime pack only: fun f(va: ...)
                        $.pack_parameter,
                        seq(
                            sep1($.parameter, ","),
                            optional(
                                seq(
                                    ",",
                                    // trailing C-style ... or named pack va: ...
                                    choice($.variadic_parameter, $.pack_parameter),
                                ),
                            ),
                        ),
                    ),
                ),
                ")",
            ),

        // a leading `$` marks a comptime value parameter
        parameter: ($) =>
            seq(
                optional(field("comptime", "$")),
                field("name", $.identifier),
                ":",
                field("type", $._type),
            ),

        // C-style variadic marker (trailing ...)
        variadic_parameter: ($) => "...",

        // comptime variadic pack parameter: name: ...
        pack_parameter: ($) =>
            seq(field("name", $.identifier), ":", "..."),

        // [flags] test "name" { body }
        test_declaration: ($) =>
            seq(
                optional($.modifiers),
                "test",
                field("name", $.string_literal),
                $.block,
            ),

        // declaration-scope: $if (cond) { decls } $or (cond) { decls } $or { decls }
        comptime_if_declaration: ($) =>
            seq(
                "$",
                "if",
                "(",
                field("condition", $._expression),
                ")",
                $.declaration_block,
                repeat($.comptime_or_declaration_clause),
            ),

        comptime_or_declaration_clause: ($) =>
            choice(
                seq(
                    "$",
                    "or",
                    "(",
                    field("condition", $._expression),
                    ")",
                    $.declaration_block,
                ),
                seq("$", "or", $.declaration_block),
            ),

        declaration_block: ($) => seq("{", repeat($._declaration), "}"),

        // statement-scope: $if (cond) { stmts } $or (cond) { stmts } $or { stmts }
        comptime_if_statement: ($) =>
            seq(
                "$",
                "if",
                "(",
                field("condition", $._expression),
                ")",
                $.block,
                repeat($.comptime_or_clause),
            ),

        comptime_or_clause: ($) =>
            choice(
                seq(
                    "$",
                    "or",
                    "(",
                    field("condition", $._expression),
                    ")",
                    $.block,
                ),
                seq("$", "or", $.block),
            ),

        // $each iterator in iterable { body } — comptime unroll over a pack or $fields(T)
        comptime_each_statement: ($) =>
            seq(
                "$",
                "each",
                field("iterator", $.identifier),
                "in",
                field("iterable", $._expression),
                $.block,
            ),

        // $intrinsic(args);  or  $path.chain;  (attribute-setter `$sym.attr = value` removed in v2.0.0)
        comptime_expression_statement: ($) =>
            seq($.comptime_expression, optional(";")),

        // $intrinsic(args) | $mach.build.os | $project.version | $bin.name
        comptime_expression: ($) =>
            seq(
                "$",
                choice(
                    // $size_of(T), $error("msg"), $fields(T), $type_of(e), $assert(cond, "msg")
                    seq(
                        field("name", $.identifier),
                        "(",
                        optional(seq(sep1($._expression, ","), optional(","))),
                        ")",
                    ),
                    // $mach.build.os, $project.version, $bin.name  (bare comptime path)
                    $.comptime_field_path,
                ),
            ),

        comptime_field_path: ($) => sep1($.identifier, "."),

        block: ($) => seq("{", repeat($._statement), "}"),

        _statement: ($) =>
            choice(
                $.value_declaration,
                $.variable_declaration,
                $.if_statement,
                $.for_statement,
                $.return_statement,
                $.break_statement,
                $.continue_statement,
                $.defer_statement,
                $.asm_statement,
                $.comptime_if_statement,
                $.comptime_each_statement,
                $.comptime_expression_statement,
                $.block,
                $.expression_statement,
            ),

        expression_statement: ($) => prec.right(-1, seq($._expression, ";")),

        // if (cond) { body } [or (cond) { body }]* [or { body }]
        if_statement: ($) =>
            seq(
                "if",
                "(",
                field("condition", $._expression),
                ")",
                $.block,
                repeat($.or_clause),
            ),

        or_clause: ($) =>
            choice(
                seq("or", "(", field("condition", $._expression), ")", $.block),
                seq("or", $.block),
            ),

        // for [(cond)] { body }
        for_statement: ($) =>
            seq(
                "for",
                optional(seq("(", field("condition", $._expression), ")")),
                $.block,
            ),

        return_statement: ($) => seq("ret", optional($._expression), ";"),

        break_statement: ($) => seq("brk", ";"),

        continue_statement: ($) => seq("cnt", ";"),

        // fin statement (runs at scope exit — Mach's defer)
        defer_statement: ($) => seq("fin", $._statement),

        // asm <isa> { raw assembly body }
        asm_statement: ($) =>
            seq(
                "asm",
                field("isa", $.identifier),
                "{",
                field("body", $.asm_body),
                "}",
            ),

        // _expression is the top-level expression rule covering assignment and
        // all non-assignment forms; precedence climbing falls out of the table.
        _expression: ($) =>
            choice(
                $.assignment_expression,
                $.binary_expression,
                $.unary_expression,
                $.cast_expression,
                $.typed_literal,
                $.array_literal,
                $.record_literal,
                $.union_literal,
                $.comptime_expression,
                $._postfix_expression,
            ),

        // call, index, field access, projection, and pack spread form a single
        // left-recursive chain so the LR parser keeps `[ ( . .[` as valid shifts.
        _postfix_expression: ($) =>
            choice(
                $.call_expression,
                $.index_expression,
                $.field_expression,
                $.projection_expression,
                $.pack_spread_expression,
                $.parenthesized_expression,
                $._primary_expression,
            ),

        _primary_expression: ($) =>
            choice(
                $.identifier,
                // primitive type names are ordinary identifiers; they appear in
                // value position as type arguments to intrinsics ($size_of(u32))
                $.primitive_type,
                $.integer_literal,
                $.float_literal,
                $.char_literal,
                $.string_literal,
                $.nil_literal,
            ),

        // a = b  (right-associative)
        assignment_expression: ($) =>
            prec.right(
                PREC.ASSIGNMENT,
                seq(
                    field("left", $._expression),
                    "=",
                    field("right", $._expression),
                ),
            ),

        binary_expression: ($) => {
            const table = [
                [PREC.LOGICAL_OR, "||"],
                [PREC.LOGICAL_AND, "&&"],
                [PREC.BITWISE_OR, "|"],
                [PREC.BITWISE_XOR, "^"],
                [PREC.BITWISE_AND, "&"],
                [PREC.EQUALITY, choice("==", "!=")],
                [PREC.COMPARISON, choice("<", ">", "<=", ">=")],
                [PREC.SHIFT, choice("<<", ">>")],
                [PREC.TERM, choice("+", "-")],
                [PREC.FACTOR, choice("*", "/", "%")],
            ];

            return choice(
                ...table.map(([prec_level, operator]) =>
                    prec.left(
                        prec_level,
                        seq(
                            field("left", $._expression),
                            field("operator", operator),
                            field("right", $._expression),
                        ),
                    ),
                ),
            );
        },

        // -x, !x, ~x, ?x (address-of), @x (dereference)
        unary_expression: ($) =>
            prec(
                PREC.UNARY,
                seq(
                    field("operator", choice("-", "!", "~", "?", "@")),
                    field("operand", $._expression),
                ),
            ),

        // expr::type (value conversion) or expr:~type (bit reinterpret)
        cast_expression: ($) =>
            prec.left(
                PREC.POSTFIX,
                seq(
                    field("value", $._expression),
                    field("operator", choice("::", ":~")),
                    field("type", $._type),
                ),
            ),

        // expr(args) or expr[types](args)
        call_expression: ($) =>
            prec.left(
                PREC.POSTFIX,
                seq(
                    field("function", $._postfix_expression),
                    optional($.type_arguments),
                    $.argument_list,
                ),
            ),

        type_arguments: ($) =>
            seq("[", optional(seq(sep1($._type, ","), optional(","))), "]"),

        argument_list: ($) =>
            seq(
                "(",
                optional(seq(sep1($._expression, ","), optional(","))),
                ")",
            ),

        // expr[index]
        index_expression: ($) =>
            prec.left(
                PREC.POSTFIX,
                seq(
                    field("object", $._postfix_expression),
                    "[",
                    field("index", $._expression),
                    "]",
                ),
            ),

        // expr.field
        field_expression: ($) =>
            prec.left(
                PREC.POSTFIX,
                seq(
                    field("object", $._postfix_expression),
                    ".",
                    field("field", $.identifier),
                ),
            ),

        // v.[f] — comptime field projection; `.` then `[` disambiguates from member
        projection_expression: ($) =>
            prec.left(
                PREC.POSTFIX,
                seq(
                    field("object", $._postfix_expression),
                    ".",
                    "[",
                    field("index", $._expression),
                    "]",
                ),
            ),

        // expr... — pack spread; used as the trailing argument in a pack-tailed call
        pack_spread_expression: ($) =>
            prec.left(
                PREC.POSTFIX,
                seq(field("pack", $._postfix_expression), "..."),
            ),

        parenthesized_expression: ($) => seq("(", $._expression, ")"),

        // Name{...}, module.Name{...}, or Name[T]{...}
        typed_literal: ($) =>
            prec.dynamic(
                1,
                seq(
                    field("type", choice($.type_identifier, $.generic_type)),
                    $.initializer_list,
                ),
            ),

        // [N]Type{ values }
        array_literal: ($) =>
            prec.dynamic(2, seq($.array_type, $.initializer_list)),

        // rec { field: value, ... } — anonymous record literal
        record_literal: ($) =>
            prec.dynamic(
                1,
                seq(
                    "rec",
                    choice(
                        seq($.field_declaration_list, $.initializer_list),
                        $.initializer_list,
                    ),
                ),
            ),

        // uni { field: value, ... } — anonymous union literal
        union_literal: ($) =>
            prec.dynamic(
                1,
                seq(
                    "uni",
                    choice(
                        seq($.field_declaration_list, $.initializer_list),
                        $.initializer_list,
                    ),
                ),
            ),

        initializer_list: ($) =>
            seq(
                "{",
                optional(sep1($.initializer_field, ",")),
                optional(","),
                "}",
            ),

        initializer_field: ($) =>
            choice(
                seq(
                    field("name", $.identifier),
                    ":",
                    field("value", $._expression),
                ),
                field("value", $._expression),
            ),

        nil_literal: ($) => "nil",

        _type: ($) =>
            choice(
                $.primitive_type,
                $.pointer_type,
                $.array_type,
                $.function_type,
                $.generic_type,
                $.record_type,
                $.union_type,
                $.type_identifier,
            ),

        primitive_type: ($) =>
            choice(
                "u8",
                "u16",
                "u32",
                "u64",
                "i8",
                "i16",
                "i32",
                "i64",
                "f32",
                "f64",
                "ptr",
            ),

        // *type (nesting **type falls out of the recursion)
        pointer_type: ($) => prec.left(seq("*", $._type)),

        // [N]type
        array_type: ($) =>
            prec.left(
                seq(
                    "[",
                    field("size", $._expression),
                    "]",
                    field("element", $._type),
                ),
            ),

        // fun(params) [return_type]
        function_type: ($) =>
            seq(
                "fun",
                "(",
                optional(
                    sep1(
                        choice(
                            $._type,
                            seq($.identifier, ":", $._type),
                            $.variadic_parameter,
                        ),
                        ",",
                    ),
                ),
                ")",
                optional(field("return_type", $._type)),
            ),

        // Name[T, U]; no prec.left so tree-sitter can GLR-fork between a generic
        // type and an index expression after `identifier [`.
        generic_type: ($) =>
            seq(
                field("name", choice($.identifier, $.type_identifier)),
                "[",
                sep1($._type, ","),
                optional(","),
                "]",
            ),

        // anonymous rec { ... } used as a type
        record_type: ($) => seq("rec", $.field_declaration_list),

        // anonymous uni { ... } used as a type
        union_type: ($) => seq("uni", $.field_declaration_list),

        // a type name; supports simple (Point) and qualified (core.Thing) paths
        type_identifier: ($) => sep1($.identifier, "."),

        // 42, 0xFF, 0b1010, 0o77, 1_000_000, 42i64, 0xFFu32
        integer_literal: ($) =>
            token(
                choice(
                    seq(
                        "0",
                        choice("x", "X"),
                        /[0-9a-fA-F][0-9a-fA-F_]*/,
                        optional(TYPE_SUFFIX),
                    ),
                    seq(
                        "0",
                        choice("b", "B"),
                        /[01][01_]*/,
                        optional(TYPE_SUFFIX),
                    ),
                    seq(
                        "0",
                        choice("o", "O"),
                        /[0-7][0-7_]*/,
                        optional(TYPE_SUFFIX),
                    ),
                    seq(/[0-9][0-9_]*/, optional(TYPE_SUFFIX)),
                ),
            ),

        // 3.14, 1.0, 0.5e10, 1.5E-3, 3.14f64
        float_literal: ($) =>
            token(
                seq(
                    /[0-9][0-9_]*/,
                    ".",
                    /[0-9][0-9_]*/,
                    optional(seq(/[eE]/, optional(/[+-]/), /[0-9][0-9_]*/)),
                    optional(TYPE_SUFFIX),
                ),
            ),

        // 'c' with escapes \n \t \r \\ \' \0 \xNN
        char_literal: ($) =>
            token(
                seq(
                    "'",
                    choice(
                        /\\['"\\ntr0]/,
                        /\\x[0-9a-fA-F]{2}/,
                        /[^'\\]/,
                    ),
                    "'",
                ),
            ),

        // "..." with escapes \n \t \r \\ \' \" \0 \xNN; may span lines
        string_literal: ($) =>
            token(
                seq(
                    '"',
                    repeat(
                        choice(
                            /\\['"\\ntr0]/,
                            /\\x[0-9a-fA-F]{2}/,
                            /[^"\\]/,
                        ),
                    ),
                    '"',
                ),
            ),

        identifier: ($) => /[a-zA-Z_][a-zA-Z0-9_]*/,
    },
});

// Comma-separated list of one or more items.
function sep1(rule, separator) {
    return seq(rule, repeat(seq(separator, rule)));
}
