// Joern reachability query template (placeholder).
// This script is intentionally lightweight for offline/partial-code environments.
// Expected params:
//   project: absolute project root
//   file: finding file path
//   line: finding line number
//
// Implementers can replace this with real CPG queries and keep output contract:
// {
//   "path_found": bool,
//   "path_score": number,
//   "call_chain": string[],
//   "control_conditions": string[],
//   "taint_paths": string[],
//   "entry_inferred": bool,
//   "blocked_reasons": string[]
// }

import io.joern.console.*

println("{}")
