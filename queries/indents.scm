; =============================================================================
; Mach Tree-sitter Indent Queries
; =============================================================================

; Indent inside blocks (braces)
[
  (block)
  (declaration_block)
  (field_declaration_list)
  (initializer_list)
  (parameter_list)
  (argument_list)
] @indent

; Dedent on closing brackets
[
  "}"
  ")"
  "]"
] @outdent
