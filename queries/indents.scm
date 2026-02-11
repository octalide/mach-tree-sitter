; =============================================================================
; Mach Tree-sitter Indent Queries
; =============================================================================

; Indent inside blocks (braces)
[
  (block)
  (field_declaration_list)
  (initializer_list)
  (parameter_list)
  (argument_list)
  (asm_isa_block)
] @indent

; Dedent on closing brackets
[
  "}"
  ")"
  "]"
] @outdent
