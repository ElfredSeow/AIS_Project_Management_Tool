#!/usr/bin/env bash
# Self-healing test loop for the AIS Project Tracker.
#
# Runs typecheck → lint → build in sequence.
# If any check fails, the error output is piped to Claude Code which edits
# the source files to fix the issues. The loop repeats until all checks pass
# or MAX_ITERATIONS is reached.
#
# Usage:
#   chmod +x self-test-loop.sh
#   ./self-test-loop.sh
#
# Optional env vars:
#   MAX_ITERATIONS=10   (default: 10) — stop after this many fix attempts

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MAX_ITERATIONS=${MAX_ITERATIONS:-10}
ITERATION=0

# ── Locate Claude Code CLI ───────────────────────────────────────────────────
if command -v claude &>/dev/null; then
  CLAUDE="claude"
else
  CLAUDE="npx --yes @anthropic-ai/claude-code"
fi

# ── Colour helpers ───────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

separator() { echo -e "${CYAN}────────────────────────────────────────────${RESET}"; }

# ── Run all checks; return 0 if clean, 1 if errors; print errors on stdout ──
run_checks() {
  local errors="" failed=0 output=""

  echo -e "  ${BOLD}typecheck${RESET}  (tsc -b)..."
  if ! output=$(npm run typecheck 2>&1); then
    errors+="### TypeScript Errors\n\`\`\`\n${output}\n\`\`\`\n\n"
    failed=1
    echo -e "  ${RED}✗ typecheck failed${RESET}"
  else
    echo -e "  ${GREEN}✓ typecheck passed${RESET}"
  fi

  echo -e "  ${BOLD}lint${RESET}       (eslint)..."
  if ! output=$(npm run lint 2>&1); then
    errors+="### ESLint Errors\n\`\`\`\n${output}\n\`\`\`\n\n"
    failed=1
    echo -e "  ${RED}✗ lint failed${RESET}"
  else
    echo -e "  ${GREEN}✓ lint passed${RESET}"
  fi

  echo -e "  ${BOLD}build${RESET}      (vite build)..."
  if ! output=$(npm run build 2>&1); then
    errors+="### Build Errors\n\`\`\`\n${output}\n\`\`\`\n\n"
    failed=1
    echo -e "  ${RED}✗ build failed${RESET}"
  else
    echo -e "  ${GREEN}✓ build passed${RESET}"
  fi

  if [ "$failed" -eq 0 ]; then
    return 0
  fi

  # Print collected errors to stdout so the caller can capture them
  printf "%b" "$errors"
  return 1
}

# ── Main loop ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   AIS Tracker — Self-Healing Test Loop       ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${RESET}"
echo -e "  Max fix attempts : ${BOLD}${MAX_ITERATIONS}${RESET}"
echo -e "  Working directory: ${SCRIPT_DIR}"
echo ""

while [ "$ITERATION" -lt "$MAX_ITERATIONS" ]; do
  ITERATION=$((ITERATION + 1))
  separator
  echo -e "${BOLD}Iteration ${ITERATION} / ${MAX_ITERATIONS}${RESET}"
  separator
  echo ""

  # Capture errors; if run_checks returns 0 the loop is done
  if ERRORS=$(run_checks); then
    echo ""
    separator
    echo -e "${GREEN}${BOLD}✅  All checks passed after ${ITERATION} iteration(s). App is healthy.${RESET}"
    separator
    exit 0
  fi

  echo ""
  echo -e "${YELLOW}⚠  Errors detected. Invoking Claude Code to fix...${RESET}"
  echo ""

  PROMPT="You are fixing a Power Apps Code App (Vite + React 19 + TypeScript strict + Tailwind CSS + shadcn/ui).

The app lives at: ${SCRIPT_DIR}
Source files are under: ${SCRIPT_DIR}/src

The following checks failed. Fix ALL errors by editing the source files directly.
Rules:
- Edit only files under src/ unless a config file (tsconfig, vite.config, eslint) is clearly at fault.
- Do not add 'any' types as a shortcut — fix the actual type issue.
- Do not disable eslint rules with comments — fix the underlying code.
- Do not run any shell commands; the loop will re-run checks after you finish.
- Do not explain your changes — just fix.

${ERRORS}"

  $CLAUDE -p "$PROMPT" \
    --allowedTools "Read,Edit,Write" \
    --add-dir "$SCRIPT_DIR"

  echo ""
  echo -e "  Claude finished. Re-running checks..."
  echo ""
done

separator
echo -e "${RED}${BOLD}❌  Could not fix all issues after ${MAX_ITERATIONS} iteration(s).${RESET}"
echo -e "    Review the remaining errors above and fix manually."
separator
exit 1
