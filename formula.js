// formula.js — spreadsheet-style formula evaluator
// Copyright (C) 2024  Your Name
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

// 1. LEXER: turns "SUM(A1, B2*3)" into tokens
const TOKEN_TYPES = {
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  IDENTIFIER: 'IDENTIFIER',
  CELL_REF: 'CELL_REF',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  COMMA: 'COMMA',
  PLUS: 'PLUS',
  MINUS: 'MINUS',
  STAR: 'STAR',
  SLASH: 'SLASH',
  EQ: 'EQ',
  NEQ: 'NEQ',
  GT: 'GT',
  LT: 'LT',
  GTE: 'GTE',
  LTE: 'LTE',
  COLON: 'COLON',
  EOF: 'EOF',
}

const CELL_REF_RE = /^[A-Za-z]+\d+$/

function tokenize(input) {
  const tokens = []
  let i = 0
  while (i < input.length) {
    if (input[i] === ' ') { i++; continue }
    if (input[i] === '\t' || input[i] === '\n') { i++; continue }

    if (input[i] === '(') { tokens.push({ type: TOKEN_TYPES.LPAREN }); i++; continue }
    if (input[i] === ')') { tokens.push({ type: TOKEN_TYPES.RPAREN }); i++; continue }
    if (input[i] === ',') { tokens.push({ type: TOKEN_TYPES.COMMA }); i++; continue }
    if (input[i] === '+') { tokens.push({ type: TOKEN_TYPES.PLUS }); i++; continue }
    if (input[i] === '*') { tokens.push({ type: TOKEN_TYPES.STAR }); i++; continue }
    if (input[i] === '/') { tokens.push({ type: TOKEN_TYPES.SLASH }); i++; continue }
    if (input[i] === ':') { tokens.push({ type: TOKEN_TYPES.COLON }); i++; continue }

    if (input[i] === '=' && input[i + 1] === '=') { tokens.push({ type: TOKEN_TYPES.EQ }); i += 2; continue }
    if (input[i] === '!' && input[i + 1] === '=') { tokens.push({ type: TOKEN_TYPES.NEQ }); i += 2; continue }
    if (input[i] === '>' && input[i + 1] === '=') { tokens.push({ type: TOKEN_TYPES.GTE }); i += 2; continue }
    if (input[i] === '<' && input[i + 1] === '=') { tokens.push({ type: TOKEN_TYPES.LTE }); i += 2; continue }
    if (input[i] === '>') { tokens.push({ type: TOKEN_TYPES.GT }); i++; continue }
    if (input[i] === '<') { tokens.push({ type: TOKEN_TYPES.LT }); i++; continue }
    if (input[i] === '-') {
      if (tokens.length === 0 || (tokens[tokens.length - 1].type !== TOKEN_TYPES.NUMBER && tokens[tokens.length - 1].type !== TOKEN_TYPES.RPAREN && tokens[tokens.length - 1].type !== TOKEN_TYPES.CELL_REF)) {
        const num = consumeNumber(input, i)
        tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseFloat(num) })
        i += num.length
        continue
      }
      tokens.push({ type: TOKEN_TYPES.MINUS }); i++; continue
    }

    const num = consumeNumber(input, i)
    if (num) { tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseFloat(num) }); i += num.length; continue }

    const str = consumeString(input, i)
    if (str) { tokens.push({ type: TOKEN_TYPES.STRING, value: str.slice(1, -1) }); i += str.length; continue }

    const word = consumeWord(input, i)
    if (word) {
      if (CELL_REF_RE.test(word)) {
        tokens.push({ type: TOKEN_TYPES.CELL_REF, value: word.toUpperCase() })
      } else {
        tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value: word.toUpperCase() })
      }
      i += word.length; continue
    }

    throw new Error(`Unexpected character: '${input[i]}' at position ${i}`)
  }
  tokens.push({ type: TOKEN_TYPES.EOF })
  return tokens
}

function consumeNumber(s, i) {
  let j = i
  if (s[j] === '-') j++
  while (j < s.length && /[0-9.]/.test(s[j])) j++
  return j > i ? s.slice(i, j) : null
}

function consumeString(s, i) {
  if (s[i] !== '"' && s[i] !== "'") return null
  const quote = s[i]
  let j = i + 1
  while (j < s.length && s[j] !== quote) j++
  if (j >= s.length) throw new Error('Unterminated string')
  return s.slice(i, j + 1)
}

function consumeWord(s, i) {
  if (!/[A-Za-z_]/.test(s[i])) return null
  let j = i
  while (j < s.length && /[A-Za-z0-9_.]/.test(s[j])) j++
  return s.slice(i, j)
}

// 2. PARSER: tokens -> AST
class ASTNode {
  constructor(type, ...args) {
    this.type = type
    Object.assign(this, ...args)
  }
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens
    this.pos = 0
  }

  peek() { return this.tokens[this.pos] }
  consume() { return this.tokens[this.pos++] }
  expect(type) {
    const t = this.consume()
    if (t.type !== type) throw new Error(`Expected ${type}, got ${t.type} (${t.value || t.type})`)
    return t
  }

  parse() { return this.parseExpression() }

  parseExpression() { return this.parseComparison() }

  parseComparison() {
    let left = this.parseAddSub()
    while (this.peek().type === TOKEN_TYPES.EQ || this.peek().type === TOKEN_TYPES.NEQ ||
           this.peek().type === TOKEN_TYPES.GT || this.peek().type === TOKEN_TYPES.LT ||
           this.peek().type === TOKEN_TYPES.GTE || this.peek().type === TOKEN_TYPES.LTE) {
      const op = this.consume().type
      const right = this.parseAddSub()
      left = new ASTNode('BinaryOp', { op, left, right })
    }
    return left
  }

  parseAddSub() {
    let left = this.parseMulDiv()
    while (this.peek().type === TOKEN_TYPES.PLUS || this.peek().type === TOKEN_TYPES.MINUS) {
      const op = this.consume().type
      const right = this.parseMulDiv()
      left = new ASTNode('BinaryOp', { op, left, right })
    }
    return left
  }

  parseMulDiv() {
    let left = this.parseUnary()
    while (this.peek().type === TOKEN_TYPES.STAR || this.peek().type === TOKEN_TYPES.SLASH) {
      const op = this.consume().type
      const right = this.parseUnary()
      left = new ASTNode('BinaryOp', { op, left, right })
    }
    return left
  }

  parseUnary() {
    if (this.peek().type === TOKEN_TYPES.MINUS) {
      this.consume()
      return new ASTNode('UnaryOp', { op: TOKEN_TYPES.MINUS, operand: this.parseUnary() })
    }
    if (this.peek().type === TOKEN_TYPES.PLUS) {
      this.consume()
      return this.parseUnary()
    }
    return this.parsePrimary()
  }

  parsePrimary() {
    const t = this.peek()

    if (t.type === TOKEN_TYPES.NUMBER) {
      this.consume()
      return new ASTNode('Number', { value: t.value })
    }

    if (t.type === TOKEN_TYPES.STRING) {
      this.consume()
      return new ASTNode('String', { value: t.value })
    }

    if (t.type === TOKEN_TYPES.CELL_REF) {
      this.consume()
      let rangeEnd = null
      if (this.peek().type === TOKEN_TYPES.COLON) {
        this.consume()
        rangeEnd = this.expect(TOKEN_TYPES.CELL_REF).value
        return new ASTNode('CellRange', { start: t.value, end: rangeEnd })
      }
      return new ASTNode('CellRef', { ref: t.value })
    }

    if (t.type === TOKEN_TYPES.IDENTIFIER) {
      this.consume()
      this.expect(TOKEN_TYPES.LPAREN)
      const args = []
      if (this.peek().type !== TOKEN_TYPES.RPAREN) {
        args.push(this.parseExpression())
        while (this.peek().type === TOKEN_TYPES.COMMA) {
          this.consume()
          args.push(this.parseExpression())
        }
      }
      this.expect(TOKEN_TYPES.RPAREN)
      return new ASTNode('FunctionCall', { name: t.value, args })
    }

    if (t.type === TOKEN_TYPES.LPAREN) {
      this.consume()
      const expr = this.parseExpression()
      this.expect(TOKEN_TYPES.RPAREN)
      return expr
    }

    throw new Error(`Unexpected token: ${t.type} (${t.value || ''})`)
  }
}

// 3. EVALUATOR: AST -> result
function evaluate(node, cellData = {}) {
  switch (node.type) {
    case 'Number':
      return node.value

    case 'String':
      return node.value

    case 'CellRef': {
      const val = cellData[node.ref]
      if (val === undefined || val === null) return 0
      if (typeof val === 'number') return val
      if (typeof val === 'string') {
        const n = parseFloat(val)
        return isNaN(n) ? val : n
      }
      return val
    }

    case 'CellRange': {
      const { start, end } = node
      const values = []
      const startCol = start.match(/[A-Z]+/)[0]
      const startRow = parseInt(start.match(/\d+/)[0], 10)
      const endCol = end.match(/[A-Z]+/)[0]
      const endRow = parseInt(end.match(/\d+/)[0], 10)

      const colToNum = c => c.split('').reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0)
      const numToCol = n => {
        let s = ''
        while (n > 0) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26) }
        return s
      }

      const sc = colToNum(startCol), ec = colToNum(endCol)
      const sr = Math.min(startRow, endRow), er = Math.max(startRow, endRow)

      for (let r = sr; r <= er; r++) {
        for (let c = Math.min(sc, ec); c <= Math.max(sc, ec); c++) {
          const ref = numToCol(c) + r
          values.push(evaluate(new ASTNode('CellRef', { ref }), cellData))
        }
      }
      return values
    }

    case 'UnaryOp': {
      const val = evaluate(node.operand, cellData)
      if (node.op === TOKEN_TYPES.MINUS) return -val
      return val
    }

    case 'BinaryOp': {
      const left = evaluate(node.left, cellData)
      const right = evaluate(node.right, cellData)
      switch (node.op) {
        case TOKEN_TYPES.PLUS: return left + right
        case TOKEN_TYPES.MINUS: return left - right
        case TOKEN_TYPES.STAR: return left * right
        case TOKEN_TYPES.SLASH: return left / right
        case TOKEN_TYPES.EQ: return left === right ? 1 : 0
        case TOKEN_TYPES.NEQ: return left !== right ? 1 : 0
        case TOKEN_TYPES.GT: return left > right ? 1 : 0
        case TOKEN_TYPES.LT: return left < right ? 1 : 0
        case TOKEN_TYPES.GTE: return left >= right ? 1 : 0
        case TOKEN_TYPES.LTE: return left <= right ? 1 : 0
        default: throw new Error(`Unknown operator: ${node.op}`)
      }
    }

    case 'FunctionCall': {
      const args = node.args.map(a => evaluate(a, cellData))
      const fn = FUNCTIONS[node.name]
      if (!fn) throw new Error(`Unknown function: ${node.name}`)
      return fn(...args)
    }

    default:
      throw new Error(`Unknown node type: ${node.type}`)
  }
}

// 4. FUNCTION REGISTRY
const FUNCTIONS = {
  SUM: (...args) => args.flat(Infinity).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0),
  SUB: (a, b) => a - b,
  MUL: (...args) => args.flat(Infinity).reduce((a, b) => a * (typeof b === 'number' ? b : 1), 1),
  DIV: (a, b) => a / b,
  AVG: (...args) => { const flat = args.flat(Infinity).filter(v => typeof v === 'number'); return flat.length ? FUNCTIONS.SUM(...flat) / flat.length : 0 },
  MIN: (...args) => Math.min(...args.flat(Infinity).filter(v => typeof v === 'number')),
  MAX: (...args) => Math.max(...args.flat(Infinity).filter(v => typeof v === 'number')),
  COUNT: (...args) => args.flat(Infinity).filter(v => typeof v === 'number' && !isNaN(v)).length,
  ABS: (x) => Math.abs(x),
  ROUND: (x, d) => Math.round(x * 10 ** (d || 0)) / 10 ** (d || 0),
  IF: (cond, t, f) => cond ? t : f,
  CONCAT: (...args) => args.flat(Infinity).join(''),
  UPPER: (s) => String(s).toUpperCase(),
  LOWER: (s) => String(s).toLowerCase(),
  LEN: (s) => String(s).length,
}

// 5. PUBLIC API
function compile(formula) {
  const tokens = tokenize(formula)
  const parser = new Parser(tokens)
  return parser.parse()
}

function run(formula, cellData = {}) {
  const ast = compile(formula)
  return evaluate(ast, cellData)
}

// 6. DEMO
const data = {
  A1: 10, A2: 20, A3: 30,
  B1: 5, B2: 15, B3: 25,
  C1: 'hello',
}

const tests = [
  'SUM(A1, A2, A3)',
  'SUM(A1:A3)',
  'A1 + B2 * 2',
  '(A1 + A2) / B1',
  'AVG(A1:A3)',
  'IF(A1 > 5, "big", "small")',
  'UPPER(C1)',
  'CONCAT(C1, " world")',
  'ROUND(SUM(A1:A3) / 3, 1)',
  'A1 == 10',
  'A1 > B1',
]

for (const t of tests) {
  console.log(`${t.padEnd(30)} => ${run(t, data)}`)
}
