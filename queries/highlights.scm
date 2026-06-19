; Mach Tree-sitter Highlight Queries

; Comments
(comment) @comment.line

; Declaration keywords
"use" @keyword.import
"fwd" @keyword.import
"pub" @keyword.modifier
"ext" @keyword.modifier
"def" @keyword.type
"rec" @keyword.type
"uni" @keyword.type
"val" @keyword.storage
"var" @keyword.storage
"fun" @keyword.function
"test" @keyword.function

; Control flow keywords
"if" @keyword.conditional
"or" @keyword.conditional
"for" @keyword.repeat
"ret" @keyword.return
"brk" @keyword.control
"cnt" @keyword.control
"fin" @keyword.control

; Assembly
"asm" @keyword

; Literals
(integer_literal) @number
(float_literal) @number.float
(char_literal) @character
(string_literal) @string
(nil_literal) @constant.builtin

; Backtick decorators
(decorator
  "`" @punctuation.special
  name: (identifier) @attribute)

; Types
(primitive_type) @type.builtin

(type_identifier) @type

(record_declaration
  name: (identifier) @type.definition)

(union_declaration
  name: (identifier) @type.definition)

(type_alias_declaration
  name: (identifier) @type.definition)

(type_parameters
  (identifier) @type.parameter)

(type_arguments
  (_) @type)

(generic_type
  name: (identifier) @type)

(generic_type
  name: (type_identifier) @type)

; Functions
(function_declaration
  name: (identifier) @function.definition)

(parameter
  name: (identifier) @variable.parameter)

(pack_parameter
  name: (identifier) @variable.parameter)

(call_expression
  function: (identifier) @function.call)

(call_expression
  function: (field_expression
    field: (identifier) @function.method.call))

; Pack spread (va...)
(pack_spread_expression
  "..." @punctuation.special)

; Comptime field projection (v.[f])
(projection_expression
  "." @punctuation.delimiter
  "[" @punctuation.bracket
  "]" @punctuation.bracket)

; Fields and variables
(field_declaration
  name: (identifier) @property)

(field_expression
  field: (identifier) @property)

(initializer_field
  name: (identifier) @property)

(value_declaration
  name: (identifier) @variable)

(variable_declaration
  name: (identifier) @variable)

; Modules
(use_declaration
  alias: (identifier) @variable.module)

(forward_declaration
  alias: (identifier) @variable.module)

(module_path
  (identifier) @module)

; Test declarations
(test_declaration
  name: (string_literal) @string.special)

; Compile-time
(comptime_if_declaration
  "$" @keyword.directive
  "if" @keyword.directive)

(comptime_or_declaration_clause
  "$" @keyword.directive
  "or" @keyword.directive)

(comptime_if_statement
  "$" @keyword.directive
  "if" @keyword.directive)

(comptime_or_clause
  "$" @keyword.directive
  "or" @keyword.directive)

(comptime_each_statement
  "$" @keyword.directive
  "each" @keyword.directive
  "in" @keyword.directive)

(comptime_expression
  "$" @keyword.directive)

(comptime_expression
  name: (identifier) @function.builtin)

(comptime_field_path
  (identifier) @variable.builtin)

; Assembly
(asm_statement
  isa: (identifier) @attribute)

(asm_body) @string.special

; Operators
(binary_expression
  operator: _ @operator)

(unary_expression
  operator: _ @operator)

(cast_expression
  operator: _ @operator)

(assignment_expression
  "=" @operator)

; Punctuation
"(" @punctuation.bracket
")" @punctuation.bracket
"{" @punctuation.bracket
"}" @punctuation.bracket
"[" @punctuation.bracket
"]" @punctuation.bracket

";" @punctuation.delimiter
":" @punctuation.delimiter
"," @punctuation.delimiter
"." @punctuation.delimiter

"*" @operator
"&" @operator
