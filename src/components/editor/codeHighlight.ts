import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-diff';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-graphql';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-lua';
import 'prismjs/components/prism-r';
import 'prismjs/components/prism-scala';
import 'prismjs/components/prism-haskell';
import 'prismjs/components/prism-elixir';
import 'prismjs/components/prism-dart';
import 'prismjs/components/prism-latex';
import 'prismjs/components/prism-powershell';
import 'prismjs/components/prism-makefile';
import 'prismjs/components/prism-perl';
import 'prismjs/components/prism-objectivec';
import 'prismjs/components/prism-clojure';
import 'prismjs/components/prism-erlang';
import 'prismjs/components/prism-fsharp';
import 'prismjs/components/prism-julia';
import 'prismjs/components/prism-ocaml';
import 'prismjs/components/prism-solidity';
import { escapeHtml } from '../../lib/dom';

export const LANGUAGES = [
  'ABAP', 'Agda', 'Arduino', 'Assembly', 'Bash', 'BASIC', 'BNF', 'C', 'C#', 'C++', 'Clojure', 'CoffeeScript', 'Coq', 'CSS',
  'Dart', 'Dhall', 'Diff', 'Docker', 'EBNF', 'Elixir', 'Elm', 'Erlang', 'F#', 'Flow', 'Fortran', 'Gherkin', 'GLSL', 'Go',
  'GraphQL', 'Groovy', 'Haskell', 'HCL', 'HTML', 'Idris', 'Java', 'JavaScript', 'JSON', 'Julia', 'Kotlin', 'LaTeX', 'Less',
  'Lisp', 'LiveScript', 'LLVM IR', 'Lua', 'Makefile', 'Markdown', 'Markup', 'MATLAB', 'Mathematica', 'Mermaid', 'Nix',
  'Notion Formula', 'Objective-C', 'OCaml', 'Pascal', 'Perl', 'PHP', 'Plain Text', 'PowerShell', 'Prolog', 'Protobuf',
  'PureScript', 'Python', 'R', 'Racket', 'Reason', 'Ruby', 'Rust', 'Sass', 'Scala', 'Scheme', 'SCSS', 'Shell', 'Smalltalk',
  'Solidity', 'SQL', 'Swift', 'TOML', 'TypeScript', 'VB.Net', 'Verilog', 'VHDL', 'Visual Basic', 'WebAssembly', 'XML', 'YAML',
  'Java/C/C++/C#',
];

const MAP: Record<string, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  bash: 'bash',
  shell: 'bash',
  json: 'json',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  html: 'markup',
  xml: 'markup',
  markup: 'markup',
  c: 'c',
  'c++': 'cpp',
  'c#': 'csharp',
  java: 'java',
  'java/c/c++/c#': 'java',
  go: 'go',
  rust: 'rust',
  ruby: 'ruby',
  sql: 'sql',
  yaml: 'yaml',
  markdown: 'markdown',
  swift: 'swift',
  kotlin: 'kotlin',
  diff: 'diff',
  docker: 'docker',
  graphql: 'graphql',
  toml: 'toml',
  lua: 'lua',
  r: 'r',
  scala: 'scala',
  haskell: 'haskell',
  elixir: 'elixir',
  dart: 'dart',
  latex: 'latex',
  powershell: 'powershell',
  makefile: 'makefile',
  perl: 'perl',
  'objective-c': 'objectivec',
  clojure: 'clojure',
  erlang: 'erlang',
  'f#': 'fsharp',
  julia: 'julia',
  ocaml: 'ocaml',
  solidity: 'solidity',
  flow: 'javascript',
  arduino: 'cpp',
};

export function highlightCode(text: string, lang?: string): string {
  const key = MAP[(lang ?? '').toLowerCase()];
  const grammar = key ? Prism.languages[key] : undefined;
  if (!grammar) return escapeHtml(text);
  try {
    return Prism.highlight(text, grammar, key);
  } catch {
    return escapeHtml(text);
  }
}
