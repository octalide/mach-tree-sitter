; =============================================================================
; Mach Tree-sitter Highlight Queries
; =============================================================================

; =============================================================================
; Comments
; =============================================================================

(comment) @comment.line

; =============================================================================
; Keywords
; =============================================================================

; Declaration keywords
"use" @keyword.import
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

; =============================================================================
; Literals
; =============================================================================

(integer_literal) @number
(float_literal) @number.float
(char_literal) @character
(string_literal) @string
(nil_literal) @constant.builtin
(varargs_expression) @punctuation.special

; =============================================================================
; Types
; =============================================================================

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

; =============================================================================
; Functions
; =============================================================================

(function_declaration
  name: (identifier) @function.definition)

(method_receiver
  receiver_name: (identifier) @variable.parameter)

(parameter
  name: (identifier) @variable.parameter)

(call_expression
  function: (identifier) @function.call)

(call_expression
  function: (field_expression
    field: (identifier) @function.method.call))

; =============================================================================
; Fields and variables
; =============================================================================

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

; =============================================================================
; Modules
; =============================================================================

(use_declaration
  alias: (identifier) @variable.module)

(module_path
  (identifier) @module)

; =============================================================================
; Extern declarations
; =============================================================================

(extern_declaration
  abi: (string_literal) @string.special)

(extern_declaration
  name: (identifier) @function)

; =============================================================================
; Test declarations
; =============================================================================

(test_declaration
  name: (string_literal) @string.special)

; =============================================================================
; Compile-time
; =============================================================================

(comptime_expression) @keyword.directive

(comptime_if_statement
  "$if" @keyword.directive)

(comptime_or_clause
  "$or" @keyword.directive)

(comptime_expression
  "$" @keyword.directive)

(comptime_expression
  name: (identifier) @function.builtin)

(comptime_field_path
  (identifier) @variable.builtin)

; =============================================================================
; Assembly
; =============================================================================

(asm_isa_block
  isa: (identifier) @attribute)

(asm_statement
  (string_literal) @string.special)

(asm_isa_block
  (string_literal) @string.special)

; =============================================================================
; Operators
; =============================================================================

(binary_expression
  operator: _ @operator)

(unary_expression
  operator: _ @operator)

(cast_expression
  "::" @operator)

(assignment_expression
  "=" @operator)

; =============================================================================
; Punctuation
; =============================================================================

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
