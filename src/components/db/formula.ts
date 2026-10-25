/** Tiny, safe formula language (Notion-like). No eval. */

type Val = string | number | boolean | Date | null | Val[];

interface Tok {
  t: 'num' | 'str' | 'id' | 'op' | 'lp' | 'rp' | 'comma' | 'eof';
  v: string;
}

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.eE]/.test(src[j])) j++;
      out.push({ t: 'num', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\' && j + 1 < src.length) {
          s += src[j + 1];
          j += 2;
          continue;
        }
        s += src[j++];
      }
      out.push({ t: 'str', v: s });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '>=', '<=', '&&', '||'].includes(two)) {
      out.push({ t: 'op', v: two });
      i += 2;
      continue;
    }
    if ('+-*/%^<>!?:'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === '(') out.push({ t: 'lp', v: c });
    else if (c === ')') out.push({ t: 'rp', v: c });
    else if (c === ',') out.push({ t: 'comma', v: c });
    else throw new Error(`Unexpected character ${c}`);
    i++;
  }
  out.push({ t: 'eof', v: '' });
  return out;
}

type Node =
  | { k: 'lit'; v: Val }
  | { k: 'call'; name: string; args: Node[] }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'un'; op: string; a: Node }
  | { k: 'tern'; c: Node; a: Node; b: Node }
  | { k: 'id'; name: string };

function parse(src: string): Node {
  const toks = lex(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const expect = (t: Tok['t']) => {
    const k = next();
    if (k.t !== t) throw new Error(`Expected ${t}`);
    return k;
  };
  const prec: Record<string, number> = { '||': 1, or: 1, '&&': 2, and: 2, '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '^': 7 };
  const primary = (): Node => {
    const k = next();
    if (k.t === 'num') return { k: 'lit', v: parseFloat(k.v) };
    if (k.t === 'str') return { k: 'lit', v: k.v };
    if (k.t === 'lp') {
      const e = ternary();
      expect('rp');
      return e;
    }
    if (k.t === 'op' && (k.v === '-' || k.v === '!')) return { k: 'un', op: k.v, a: unary() };
    if (k.t === 'id') {
      if (k.v === 'true') return { k: 'lit', v: true };
      if (k.v === 'false') return { k: 'lit', v: false };
      if (k.v === 'not') return { k: 'un', op: '!', a: unary() };
      if (peek().t === 'lp') {
        next();
        const args: Node[] = [];
        if (peek().t !== 'rp') {
          args.push(ternary());
          while (peek().t === 'comma') {
            next();
            args.push(ternary());
          }
        }
        expect('rp');
        return { k: 'call', name: k.v, args };
      }
      return { k: 'id', name: k.v };
    }
    throw new Error('Unexpected token');
  };
  const postfix = (): Node => {
    let n = primary();
    // method-call style: prop("x").length()
    while (peek().t === 'op' && peek().v === '.') next();
    return n;
  };
  const unary = (): Node => postfix();
  const binary = (min: number): Node => {
    let a = unary();
    for (;;) {
      const k = peek();
      const op = k.t === 'op' ? k.v : k.t === 'id' && (k.v === 'and' || k.v === 'or') ? k.v : null;
      if (!op || prec[op] === undefined || prec[op] < min) break;
      next();
      const b = binary(prec[op] + (op === '^' ? 0 : 1));
      a = { k: 'bin', op: op === 'and' ? '&&' : op === 'or' ? '||' : op, a, b };
    }
    return a;
  };
  const ternary = (): Node => {
    const c = binary(1);
    if (peek().t === 'op' && peek().v === '?') {
      next();
      const a = ternary();
      const k = next();
      if (k.v !== ':') throw new Error('Expected :');
      const b = ternary();
      return { k: 'tern', c, a, b };
    }
    return c;
  };
  const n = ternary();
  if (peek().t !== 'eof') throw new Error('Unexpected input');
  return n;
}

const num = (v: Val): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
};
const str = (v: Val): string => {
  if (v == null) return '';
  if (v instanceof Date) return v.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  if (Array.isArray(v)) return v.map(str).join(', ');
  if (typeof v === 'number') return String(Math.round(v * 1e10) / 1e10);
  return String(v);
};
const truthy = (v: Val) => !(v === null || v === false || v === 0 || v === '' || (Array.isArray(v) && v.length === 0));

const toDate = (v: Val): Date | null => {
  if (v instanceof Date) return v;
  if (typeof v === 'string' && v) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'number') return new Date(v);
  return null;
};

const UNIT_MS: Record<string, number> = {
  milliseconds: 1,
  seconds: 1000,
  minutes: 60000,
  hours: 3600000,
  days: 86400000,
  weeks: 604800000,
};

function evalNode(n: Node, getProp: (name: string) => Val): Val {
  switch (n.k) {
    case 'lit':
      return n.v;
    case 'id':
      if (n.name === 'pi') return Math.PI;
      if (n.name === 'e') return Math.E;
      throw new Error(`Unknown ${n.name}`);
    case 'un': {
      const a = evalNode(n.a, getProp);
      return n.op === '-' ? -num(a) : !truthy(a);
    }
    case 'tern':
      return truthy(evalNode(n.c, getProp)) ? evalNode(n.a, getProp) : evalNode(n.b, getProp);
    case 'bin': {
      if (n.op === '&&') return truthy(evalNode(n.a, getProp)) && truthy(evalNode(n.b, getProp));
      if (n.op === '||') return truthy(evalNode(n.a, getProp)) || truthy(evalNode(n.b, getProp));
      const a = evalNode(n.a, getProp);
      const b = evalNode(n.b, getProp);
      switch (n.op) {
        case '+':
          if (typeof a === 'string' || typeof b === 'string') return str(a) + str(b);
          return num(a) + num(b);
        case '-':
          return num(a) - num(b);
        case '*':
          return num(a) * num(b);
        case '/':
          return num(b) === 0 ? null : num(a) / num(b);
        case '%':
          return num(a) % num(b);
        case '^':
          return Math.pow(num(a), num(b));
        case '==':
          return typeof a === 'number' || typeof b === 'number' ? num(a) === num(b) : str(a) === str(b);
        case '!=':
          return typeof a === 'number' || typeof b === 'number' ? num(a) !== num(b) : str(a) !== str(b);
        case '<':
          return num(a) < num(b);
        case '>':
          return num(a) > num(b);
        case '<=':
          return num(a) <= num(b);
        case '>=':
          return num(a) >= num(b);
      }
      return null;
    }
    case 'call': {
      const name = n.name;
      const lazy = ['if', 'ifs', 'and', 'or'];
      if (name === 'if') {
        return truthy(evalNode(n.args[0], getProp)) ? evalNode(n.args[1], getProp) : n.args[2] ? evalNode(n.args[2], getProp) : null;
      }
      if (name === 'ifs') {
        for (let i = 0; i + 1 < n.args.length; i += 2) if (truthy(evalNode(n.args[i], getProp))) return evalNode(n.args[i + 1], getProp);
        return n.args.length % 2 ? evalNode(n.args[n.args.length - 1], getProp) : null;
      }
      if (name === 'and') return n.args.every((x) => truthy(evalNode(x, getProp)));
      if (name === 'or') return n.args.some((x) => truthy(evalNode(x, getProp)));
      void lazy;
      const args = n.args.map((a) => evalNode(a, getProp));
      const A = args[0];
      switch (name) {
        case 'prop':
          return getProp(str(A));
        case 'concat':
          return args.map(str).join('');
        case 'join':
          return Array.isArray(A) ? A.map(str).join(str(args[1] ?? '')) : args.slice(1).map(str).join(str(A));
        case 'length':
          return Array.isArray(A) ? A.length : str(A).length;
        case 'lower':
          return str(A).toLowerCase();
        case 'upper':
          return str(A).toUpperCase();
        case 'contains':
          return str(A).includes(str(args[1]));
        case 'replace':
          return str(A).replace(str(args[1]), str(args[2]));
        case 'replaceAll':
          return str(A).split(str(args[1])).join(str(args[2]));
        case 'slice':
        case 'substring':
          return str(A).slice(num(args[1]), args[2] != null ? num(args[2]) : undefined);
        case 'format':
          return str(A);
        case 'toNumber':
          return num(A);
        case 'empty':
          return !truthy(A);
        case 'not':
          return !truthy(A);
        case 'abs':
          return Math.abs(num(A));
        case 'round': {
          const p = Math.pow(10, num(args[1] ?? 0));
          return Math.round(num(A) * p) / p;
        }
        case 'ceil':
          return Math.ceil(num(A));
        case 'floor':
          return Math.floor(num(A));
        case 'sqrt':
          return Math.sqrt(num(A));
        case 'min':
          return Math.min(...args.flat().map(num));
        case 'max':
          return Math.max(...args.flat().map(num));
        case 'sum':
          return args.flat().map(num).reduce((x, y) => x + y, 0);
        case 'mean':
          return args.flat().length ? args.flat().map(num).reduce((x, y) => x + y, 0) / args.flat().length : 0;
        case 'pow':
          return Math.pow(num(A), num(args[1]));
        case 'mod':
          return num(A) % num(args[1]);
        case 'now':
          return new Date();
        case 'today': {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          return d;
        }
        case 'dateBetween': {
          const a = toDate(A);
          const b = toDate(args[1]);
          if (!a || !b) return null;
          const unit = str(args[2] ?? 'days');
          if (unit === 'months') return (a.getFullYear() - b.getFullYear()) * 12 + a.getMonth() - b.getMonth();
          if (unit === 'years') return a.getFullYear() - b.getFullYear();
          return Math.trunc((a.getTime() - b.getTime()) / (UNIT_MS[unit] ?? UNIT_MS.days));
        }
        case 'dateAdd':
        case 'dateSubtract': {
          const a = toDate(A);
          if (!a) return null;
          const amt = num(args[1]) * (name === 'dateSubtract' ? -1 : 1);
          const unit = str(args[2] ?? 'days');
          const d = new Date(a);
          if (unit === 'months') d.setMonth(d.getMonth() + amt);
          else if (unit === 'years') d.setFullYear(d.getFullYear() + amt);
          else d.setTime(d.getTime() + amt * (UNIT_MS[unit] ?? UNIT_MS.days));
          return d;
        }
        case 'formatDate': {
          const a = toDate(A);
          if (!a) return '';
          return a.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        case 'year':
          return toDate(A)?.getFullYear() ?? null;
        case 'month':
          return (toDate(A)?.getMonth() ?? -1) + 1;
        case 'date':
          return toDate(A)?.getDate() ?? null;
        case 'day':
          return toDate(A)?.getDay() ?? null;
        case 'toString':
          return str(A);
      }
      throw new Error(`Unknown function ${name}`);
    }
  }
}

export function evaluateFormula(src: string, getProp: (name: string) => Val): { value: Val; error?: string } {
  if (!src || !src.trim()) return { value: null };
  try {
    return { value: evalNode(parse(src), getProp) };
  } catch (e) {
    return { value: null, error: (e as Error).message };
  }
}

export function formulaToString(v: Val): string {
  if (typeof v === 'boolean') return v ? '✓' : '';
  return str(v);
}

export type { Val as FormulaValue };
