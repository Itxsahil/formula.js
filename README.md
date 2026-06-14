# formula.js

A spreadsheet-style formula evaluator in ~300 lines of vanilla JS. No `eval`, no `new Function`, no dependencies.

```
SUM(A1:A5) / COUNT(A1:A5) * 100
IF(AVG(B1:B10) > 50, "high", "low")
CONCAT(UPPER(C1), " — ", LOWER(C2))
```

## How it works

```
formula string → Lexer → tokens → Parser → AST → Evaluator → result
                                                      ↕
                                              cell data object
```

- **Lexer** breaks the formula into tokens (`IDENTIFIER`, `NUMBER`, `CELL_REF`, `+`, `(`, etc.)
- **Parser** builds an Abstract Syntax Tree via recursive descent
- **Evaluator** walks the AST, resolving cell references against your data and calling registered functions

## Install

Copy `formula.js` into your project. No build step needed.

```html
<script src="formula.js"></script>
```

Or import as an ES module (add `export` to the functions you need).

## Usage

```js
// Basic evaluation
run('SUM(A1:A3)', { A1: 10, A2: 20, A3: 30 })
// → 60

// Compile once, evaluate many times
const ast = compile('A1 + B2 * 2')
evaluate(ast, { A1: 10, B2: 15 })  // → 40
evaluate(ast, { A1: 5, B2: 3 })    // → 11

// Cell ranges expand automatically
run('AVG(A1:C3)', { A1: 1, A2: 2, A3: 3, B1: 4, B2: 5, B3: 6, C1: 7, C2: 8, C3: 9 })
// → 5

// Functions mix with arithmetic
run('ROUND(SUM(A1:A5) / COUNT(A1:A5), 2)', data)
```

## API

### `run(formula, cellData?)`

Parse and evaluate a formula in one call.

- `formula` — string like `"SUM(A1:A5)"` or `"A1 + B2 * 2"`
- `cellData` — object mapping cell refs to values, e.g. `{ A1: 10, B1: "hello" }`

Returns the computed value (number, string, or array for ranges).

### `compile(formula)`

Parse a formula into an AST. Useful when the same formula runs against different data.

```js
const ast = compile('A1 + B1')
evaluate(ast, { A1: 5, B1: 3 })  // → 8
evaluate(ast, { A1: 2, B1: 9 })  // → 11
```

### `evaluate(node, cellData?)`

Walk a compiled AST and produce a value.

### `tokenize(formula)`

For debugging — returns the raw token stream.

```js
tokenize('SUM(A1, 2)')
// → [
//   { type: 'IDENTIFIER', value: 'SUM' },
//   { type: 'LPAREN' },
//   { type: 'CELL_REF', value: 'A1' },
//   { type: 'COMMA' },
//   { type: 'NUMBER', value: 2 },
//   { type: 'RPAREN' },
//   { type: 'EOF' },
// ]
```

### `FUNCTIONS`

The function registry object. Add your own:

```js
FUNCTIONS.PERCENT = (a, b) => (a / b) * 100
run('PERCENT(25, 200)')  // → 12.5
```

Overwrite or remove built-ins as needed.

### `ASTNode`

Constructor for AST nodes. Used internally but exposed if you want to build or inspect trees.

```js
new ASTNode('Number', { value: 42 })
new ASTNode('FunctionCall', { name: 'SUM', args: [...] })
```

Node types: `Number`, `String`, `CellRef`, `CellRange`, `UnaryOp`, `BinaryOp`, `FunctionCall`.

### `TOKEN_TYPES`

Token type constants (`NUMBER`, `STRING`, `IDENTIFIER`, `CELL_REF`, `PLUS`, `MINUS`, etc.)

## Formula syntax

### Literals

| Example | Type |
|---------|------|
| `42` | Number |
| `3.14` | Number |
| `"hello"` | String (double or single quotes) |
| `'hello'` | String |

### Cell references

| Example | Meaning |
|---------|---------|
| `A1` | Single cell |
| `A1:A5` | Range (expands to A1,A2,A3,A4,A5) |
| `A1:C3` | 2D range (9 cells) |
| `Z100` | Column Z, row 100 |

Case-insensitive. Columns go A–Z, AA–ZZ, etc.

### Operators

| Operator | Description |
|----------|-------------|
| `+` | Addition / string concat with `&` |
| `-` | Subtraction or unary negation |
| `*` | Multiplication |
| `/` | Division |
| `&` | String concatenation |
| `==` | Equality (strict) |
| `!=` | Not equal |
| `>` `<` `>=` `<=` | Comparisons |

Comparisons return `1` (true) or `0` (false).

### Precedence (highest to lowest)

1. Unary `-`
2. `*` `/`
3. `+` `-`
4. `&`
5. `==` `!=` `>` `<` `>=` `<=`

Use parentheses `( )` to override.

## Built-in functions

### Math

| Function | Description |
|----------|-------------|
| `SUM(n1, n2, ...)` | Sum of values |
| `SUB(a, b)` | a minus b |
| `MUL(n1, n2, ...)` | Product of values |
| `DIV(a, b)` | a divided by b |
| `ABS(x)` | Absolute value |
| `ROUND(x, [digits])` | Round to N decimal places |
| `INT(x)` | Floor to integer |
| `POWER(base, exp)` | Raise to power |
| `SQRT(x)` | Square root |
| `MOD(a, b)` | Remainder of a / b |
| `PI()` | π (3.141592653589793) |

### Stats

| Function | Description |
|----------|-------------|
| `AVG(n1, n2, ...)` | Arithmetic mean |
| `MIN(n1, n2, ...)` | Minimum value |
| `MAX(n1, n2, ...)` | Maximum value |
| `COUNT(v1, v2, ...)` | Count of numeric values |

### Logic

| Function | Description |
|----------|-------------|
| `IF(cond, trueVal, falseVal)` | Conditional |

### Text

| Function | Description |
|----------|-------------|
| `CONCAT(s1, s2, ...)` | Join strings |
| `UPPER(s)` | Convert to uppercase |
| `LOWER(s)` | Convert to lowercase |
| `LEN(s)` | String length |
| `TRIM(s)` | Strip leading/trailing whitespace |

All functions accept cell references and ranges — the engine flattens ranges automatically.

## Extending

### Add a custom function

```js
FUNCTIONS.PERCENT = (a, b) => (a / b) * 100
FUNCTIONS.RAND = () => Math.random()
FUNCTIONS.FACTORIAL = (n) => n <= 1 ? 1 : n * FUNCTIONS.FACTORIAL(n - 1)

run('PERCENT(SUM(A1:A5), 200)', data)
```

### Add a custom operator

Add the token in `TOKEN_TYPES`, handle it in the lexer, add a precedence level in the parser, and handle it in the evaluator.

## Cell data resolution

Cell data is a plain object mapping ref → value:

```js
{ A1: 10, B2: "hello", C5: 3.14 }
```

- Missing/undefined refs evaluate to `0`
- String values that look like numbers (`"42"`) are auto-coerced when used in arithmetic
- String values stay as strings for text functions and `&` concat

## Browser support

Any browser from the last ~10 years. No transpilation needed if you use the file as-is. If your target is IE11, run through Babel for arrow functions and `Object.assign`.

## License

GNU General Public License v3.0. See `LICENSE`.
