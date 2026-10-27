// Turns a plain numbered list ("1. Open the cart", "2) Add an item", ...) into test plan steps.
// A non-empty line that isn't numbered continues the step above it (a wrapped line). Text before
// the first numbered line (a heading, say) and numbered lines with no text are ignored.
const NUMBERED_LINE = /^\s*\d+\s*[.)]\s*(.*?)\s*$/;

function parseNumberedList(text) {
  const steps = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(NUMBERED_LINE);
    if (match) {
      current = match[1] ? steps.push(match[1]) - 1 : null;
    } else if (line.trim() && current !== null) {
      steps[current] += ` ${line.trim()}`;
    }
  }
  return steps;
}

module.exports = { parseNumberedList };
