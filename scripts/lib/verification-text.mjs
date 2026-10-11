/** Logical verification text only: preserve every byte except the declared line terminators.
 * Never use for transport bodies, binary artifacts, raw hashes, or authored runtime strings.
 * loneCR is opt-in only for owners whose existing contract already canonicalized standalone CR.
 * @param {string} text
 * @param {{ loneCR?: boolean }} [options]
 * @returns {string}
 */
export function normalizeVerificationText(text, { loneCR = false } = {}) {
  return text.replace(loneCR ? /\r\n?/g : /\r\n/g, "\n");
}
