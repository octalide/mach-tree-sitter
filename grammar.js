/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// Precedence levels matching Mach's operator precedence (lowest to highest)
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
    CAST: 13,
    POSTFIX: 14,
    PRIMARY: 15,
};

// Numeric type suffix pattern used by integer and float literals.
// The Mach lexer accepts any of these suffixes on numeric literals.
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

    conflicts: ($) => [
        // field access chain in comptime paths
        [$.comptime_expression],
        // comptime expression can appear as both a statement and an expression
        [$.comptime_expression_statement, $._expression],
        // comptime_field_path vs comptime_expression (call vs path ambiguity)
        [$.comptime_expression, $.comptime_field_path],
        // identifier can be either a primary expression (value) or a type_identifier
        [$._primary_expression, $.type_identifier],
        // identifier { can start both a primary expression and a typed literal
        [$._primary_expression, $.typed_literal],
        // After identifier [, the parser must fork between _primary_expression
        // (reduce, then extend into index_expression), generic_type (shift [
        // for type params), and type_identifier (reduce for qualified type).
        [$._primary_expression, $.generic_type, $.type_identifier],
        // In type position, identifier [ could start generic_type or end type_identifier
        [$.generic_type, $.type_identifier],
        // After type_identifier, [ could continue into generic_type or end the type
        [$._type, $.generic_type],
        // rec/uni { } can be field_declaration_list (type) or initializer_list (literal)
        [$.field_declaration_list, $.initializer_list],
        // function type optional return type lookahead
        [$.function_type],
    ],

    word: ($) => $.identifier,

    rules: {
        // =========================================================================
        // Top-level
        // =========================================================================
        source_file: ($) => repeat($._top_level_item),

        _top_level_item: ($) =>
            choice(
                $.use_declaration,
                $.public_declaration,
                $.extern_declaration,
                $.type_alias_declaration,
                $.record_declaration,
                $.union_declaration,
                $.value_declaration,
                $.variable_declaration,
                $.function_declaration,
                $.test_declaration,
                $.comptime_if_statement,
                $.comptime_expression_statement,
            ),

        // =========================================================================
        // Comments
        // =========================================================================
        comment: ($) => token(seq("#", /.*/)),

        // =========================================================================
        // Declarations
        // =========================================================================

        // use [alias:] module.path;
        use_declaration: ($) =>
            seq(
                "use",
                optional(seq(field("alias", $.identifier), ":")),
                field("path", $.module_path),
                ";",
            ),

        module_path: ($) => sep1($.identifier, "."),

        // pub <declaration>
        public_declaration: ($) =>
            seq(
                "pub",
                choice(
                    $.extern_declaration,
                    $.type_alias_declaration,
                    $.record_declaration,
                    $.union_declaration,
                    $.value_declaration,
                    $.variable_declaration,
                    $.function_declaration,
                ),
            ),

        // ext "ABI:linkage" name: type;
        extern_declaration: ($) =>
            seq(
                "ext",
                field("abi", $.string_literal),
                field("name", $.identifier),
                ":",
                field("type", $._type),
                ";",
            ),

        // def Alias: type;
        type_alias_declaration: ($) =>
            seq(
                "def",
                field("name", $.identifier),
                ":",
                field("type", $._type),
                ";",
            ),

        // rec Name[T, U] { field: type; ... }
        record_declaration: ($) =>
            seq(
                "rec",
                field("name", $.identifier),
                optional($.type_parameters),
                $.field_declaration_list,
            ),

        // uni Name[T, U] { variant: type; ... }
        union_declaration: ($) =>
            seq(
                "uni",
                field("name", $.identifier),
                optional($.type_parameters),
                $.field_declaration_list,
            ),

        field_declaration_list: ($) =>
            seq("{", repeat($.field_declaration), "}"),

        field_declaration: ($) =>
            seq(field("name", $.identifier), ":", field("type", $._type), ";"),

        type_parameters: ($) => seq("[", sep1($.identifier, ","), "]"),

        // val name: type = expr;
        value_declaration: ($) =>
            seq(
                "val",
                field("name", $.identifier),
                ":",
                field("type", $._type),
                "=",
                field("value", $._expression),
                ";",
            ),

        // var name: type [= expr];
        variable_declaration: ($) =>
            seq(
                "var",
                field("name", $.identifier),
                ":",
                field("type", $._type),
                optional(seq("=", field("value", $._expression))),
                ";",
            ),

        // fun [(receiver: type)] name[T](params) [return_type] { body }
        function_declaration: ($) =>
            seq(
                "fun",
                optional($.method_receiver),
                field("name", $.identifier),
                optional($.type_parameters),
                $.parameter_list,
                optional(field("return_type", $._type)),
                $.block,
            ),

        method_receiver: ($) =>
            seq(
                "(",
                field("receiver_name", $.identifier),
                ":",
                field("receiver_type", $._type),
                ")",
            ),

        parameter_list: ($) =>
            seq(
                "(",
                optional(sep1(choice($.parameter, $.variadic_parameter), ",")),
                ")",
            ),

        parameter: ($) =>
            seq(field("name", $.identifier), ":", field("type", $._type)),

        variadic_parameter: ($) => "...",

        // test "name" { body }
        test_declaration: ($) =>
            seq("test", field("name", $.string_literal), $.block),

        // =========================================================================
        // Compile-time constructs
        // =========================================================================

        // $if (cond) { ... } $or (cond) { ... } $or { ... }
        comptime_if_statement: ($) =>
            seq(
                "$if",
                "(",
                field("condition", $._expression),
                ")",
                $.block,
                repeat($.comptime_or_clause),
            ),

        comptime_or_clause: ($) =>
            choice(
                seq(
                    "$or",
                    "(",
                    field("condition", $._expression),
                    ")",
                    $.block,
                ),
                seq("$or", $.block),
                seq("or", "(", field("condition", $._expression), ")", $.block),
                seq("or", $.block),
            ),

        // $symbol.attr = value; or $error("msg") etc at top level
        comptime_expression_statement: ($) =>
            seq($.comptime_expression, optional(";")),

        // $identifier.path... or $intrinsic(args) or $identifier.attr = value
        comptime_expression: ($) =>
            seq(
                "$",
                choice(
                    // $error("message")
                    seq(
                        field("name", $.identifier),
                        "(",
                        optional(sep1($._expression, ",")),
                        ")",
                    ),
                    // $symbol.attr = value
                    seq($.comptime_field_path, "=", $._expression),
                    // $mach.build.target.os.id  (just a path)
                    $.comptime_field_path,
                ),
            ),

        comptime_field_path: ($) => sep1($.identifier, "."),

        // =========================================================================
        // Statements
        // =========================================================================

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
                $.comptime_expression_statement,
                // bare { ... } scope block
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

        // ret [expr];
        return_statement: ($) => seq("ret", optional($._expression), ";"),

        // brk;
        break_statement: ($) => seq("brk", ";"),

        // cnt;
        continue_statement: ($) => seq("cnt", ";"),

        // fin statement;
        defer_statement: ($) => seq("fin", $._statement),

        // asm { ... } or asm { isa { ... } }
        asm_statement: ($) =>
            seq(
                "asm",
                "{",
                repeat(choice($.asm_isa_block, $.string_literal)),
                "}",
            ),

        asm_isa_block: ($) =>
            seq(field("isa", $.identifier), "{", repeat($.string_literal), "}"),

        // =========================================================================
        // Expressions
        // =========================================================================

        // _expression is the top-level expression rule. It includes assignment
        // and all non-assignment forms. Binary/unary/cast operate on _expression
        // directly so precedence climbing works naturally.
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

        // _postfix_expression groups call, index, field access, and primary
        // atoms into a single left-recursive chain. This ensures the LR parser
        // keeps [ ( . as valid shifts after reducing an identifier, rather than
        // eagerly reducing through _expression into expression_statement.
        _postfix_expression: ($) =>
            choice(
                $.call_expression,
                $.index_expression,
                $.field_expression,
                $.parenthesized_expression,
                $._primary_expression,
            ),

        _primary_expression: ($) =>
            choice(
                $.identifier,
                $.integer_literal,
                $.float_literal,
                $.char_literal,
                $.string_literal,
                $.nil_literal,
                $.varargs_expression,
            ),

        // a = b
        assignment_expression: ($) =>
            prec.right(
                PREC.ASSIGNMENT,
                seq(
                    field("left", $._expression),
                    "=",
                    field("right", $._expression),
                ),
            ),

        // a + b, a && b, etc.
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

        // !x, -x, ~x, ?x, @x
        unary_expression: ($) =>
            prec(
                PREC.UNARY,
                seq(
                    field("operator", choice("!", "-", "~", "?", "@")),
                    field("operand", $._expression),
                ),
            ),

        // expr::type
        cast_expression: ($) =>
            prec.left(
                PREC.CAST,
                seq(
                    field("value", $._expression),
                    "::",
                    field("type", $._type),
                ),
            ),

        // expr(args) or expr[types](args)
        // Takes _postfix_expression so it chains left-recursively with other
        // postfix operations (index, field) without going through _expression.
        call_expression: ($) =>
            prec.left(
                PREC.POSTFIX,
                seq(
                    field("function", $._postfix_expression),
                    optional($.type_arguments),
                    $.argument_list,
                ),
            ),

        type_arguments: ($) => seq("[", sep1($._type, ","), "]"),

        argument_list: ($) => seq("(", optional(sep1($._expression, ",")), ")"),

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

        // (expr)
        parenthesized_expression: ($) => seq("(", $._expression, ")"),

        // Type{ field: value, ... } or GenericType[T]{ field: value, ... }
        typed_literal: ($) =>
            prec.dynamic(
                1,
                seq(
                    field("type", choice($.identifier, $.generic_type)),
                    $.initializer_list,
                ),
            ),

        // [N]Type{ values }
        array_literal: ($) =>
            prec.dynamic(2, seq($.array_type, $.initializer_list)),

        // rec { field: value, ... }
        record_literal: ($) =>
            prec.dynamic(
                1,
                seq(
                    "rec",
                    choice(
                        // rec { type_def }{ init } — anonymous typed then initialized
                        seq($.field_declaration_list, $.initializer_list),
                        // rec { field: value, ... } — anonymous literal
                        $.initializer_list,
                    ),
                ),
            ),

        // uni { field: value, ... }
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

        // ...
        varargs_expression: ($) => "...",

        // nil
        nil_literal: ($) => "nil",

        // =========================================================================
        // Types
        // =========================================================================

        _type: ($) =>
            choice(
                $.primitive_type,
                $.pointer_type,
                $.readonly_pointer_type,
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

        // *type
        pointer_type: ($) => prec.left(seq("*", $._type)),

        // &type
        readonly_pointer_type: ($) => prec.left(seq("&", $._type)),

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

        // fun(params) return_type
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

        // Name[T, U]
        // No prec.left here — this lets tree-sitter GLR-fork between
        // generic_type (identifier [ type ]) and index_expression
        // (identifier [ expression ]) when it sees identifier [.
        generic_type: ($) =>
            seq(
                field("name", choice($.identifier, $.type_identifier)),
                "[",
                sep1($._type, ","),
                "]",
            ),

        // Anonymous rec { ... } used as type
        record_type: ($) => seq("rec", $.field_declaration_list),

        // Anonymous uni { ... } used as type
        union_type: ($) => seq("uni", $.field_declaration_list),

        // Type name (same as identifier but semantically a type).
        // Supports both simple names (Point) and qualified paths (allocator.Allocator).
        type_identifier: ($) => sep1($.identifier, "."),

        // =========================================================================
        // Literals
        // =========================================================================

        // Integer literals: decimal, hex, binary, octal, with optional underscores
        // and optional numeric type suffix (u8, i64, f32, etc.)
        //
        // Examples: 42, 0xFF, 0b1010, 0o77, 1_000_000, 42i64, 0xFFu32
        integer_literal: ($) =>
            token(
                choice(
                    // Hex with optional suffix
                    seq(
                        "0",
                        choice("x", "X"),
                        /[0-9a-fA-F][0-9a-fA-F_]*/,
                        optional(TYPE_SUFFIX),
                    ),
                    // Binary with optional suffix
                    seq(
                        "0",
                        choice("b", "B"),
                        /[01][01_]*/,
                        optional(TYPE_SUFFIX),
                    ),
                    // Octal with optional suffix
                    seq(
                        "0",
                        choice("o", "O"),
                        /[0-7][0-7_]*/,
                        optional(TYPE_SUFFIX),
                    ),
                    // Decimal with optional suffix
                    seq(/[0-9][0-9_]*/, optional(TYPE_SUFFIX)),
                ),
            ),

        // Float literals: must contain a decimal point, with optional exponent
        // and optional numeric type suffix.
        //
        // Examples: 3.14, 1.0, 0.5e10, 1.5E-3, 3.14f64, 1_000.5_0
        float_literal: ($) =>
            token(
                seq(
                    /[0-9][0-9_]*/,
                    ".",
                    /[0-9][0-9_]*/,
                    // Optional exponent part: e/E followed by optional sign and digits
                    optional(seq(/[eE]/, optional(/[+-]/), /[0-9][0-9_]*/)),
                    optional(TYPE_SUFFIX),
                ),
            ),

        // Character literals: 'c' with escape sequences
        //
        // Escape sequences: \n \t \r \\ \' \" \0 \xNN
        char_literal: ($) =>
            token(
                seq(
                    "'",
                    choice(
                        // Simple escape sequences
                        /\\['"\\ntr0]/,
                        // Hex escape: \xNN
                        /\\x[0-9a-fA-F]{2}/,
                        // Any single character except backslash and single quote
                        /[^'\\]/,
                    ),
                    "'",
                ),
            ),

        // String literals: "..." with escape sequences.
        // Includes single-line strings and triple-quoted multiline strings.
        //
        // Single-line: "hello\nworld"
        // Multiline:   """multi
        //                 line"""
        //
        // Escape sequences: \n \t \r \\ \' \" \0 \xNN
        string_literal: ($) =>
            token(
                choice(
                    // Triple-quoted multiline string: """..."""
                    // Content can include newlines, single quotes, double quotes (as
                    // long as fewer than three in a row without backslash escape).
                    seq(
                        '"""',
                        repeat(
                            choice(
                                /\\./, // any escape sequence
                                /[^"\\]/, // any char except quote or backslash
                                /"[^"\\]/, // single quote followed by non-quote
                                /""[^"\\]/, // two quotes followed by non-quote
                            ),
                        ),
                        optional(/""/), // trailing quotes before the close
                        '"""',
                    ),
                    // Regular single-line string: "..."
                    seq(
                        '"',
                        repeat(
                            choice(
                                // Simple escape sequences
                                /\\['"\\ntr0]/,
                                // Hex escape: \xNN
                                /\\x[0-9a-fA-F]{2}/,
                                // Any character except backslash, double quote, and newline
                                /[^"\\\n]/,
                            ),
                        ),
                        '"',
                    ),
                ),
            ),

        // =========================================================================
        // Identifiers
        // =========================================================================

        identifier: ($) => /[a-zA-Z_][a-zA-Z0-9_]*/,
    },
});

/**
 * Comma-separated list of one or more items.
 */
function sep1(rule, separator) {
    return seq(rule, repeat(seq(separator, rule)));
}
