#!/usr/bin/env bash
# Runs every end-to-end scenario against the dev server (npm run dev) and fails on any console error.
set -u
cd "$(dirname "$0")/.."
fail=0
for f in s2 s4 s5 s6 s8 s9 s10 s11 s12 s13; do
  out=$(node tests/$f.mjs 2>&1)
  if [ $? -ne 0 ] || ! echo "$out" | tail -1 | grep -q '^\[\]$'; then echo "FAIL $f"; echo "$out" | tail -5; fail=1; else echo "ok   $f"; fi
done
for seed in 1 2 3 4 5; do
  out=$(node tests/fuzz.mjs $seed 2>&1)
  echo "$out" | grep -q "problems: \[\] } \[\]" && echo "ok   fuzz $seed" || { echo "FAIL fuzz $seed"; echo "$out"; fail=1; }
done
exit $fail
