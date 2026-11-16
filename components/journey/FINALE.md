# Finale → project conversation

The six opening panels return after station six. Three closed torus paths draw
around them segment by segment, each led by a light tip. Circuit traces and six
small station-colored nodes complete the artifact. All geometry is procedural.

The conversation uses the same artifact, camera, renderer, and sticky stage.
After the route ends, another 2.2 viewports of native scrolling turn the whole
artifact through 360 degrees, bring it into the upper center, and crossfade the
studio into a dark field. The input appears after the turn. Reverse scrolling
retraces the transition. Reduced motion removes the turn and idle motion.

The question form supports starter prompts, Enter to submit, Shift+Enter for a
new line, a loading state, and a contained reply. A personal email link preserves
the visitor’s question, but does not send mail automatically.

## Optional AI configuration

Set `OPENAI_API_KEY` in the server environment (for local development, `.env.local`).
Optionally set `OPENAI_CONCIERGE_MODEL`; the default is `gpt-4.1-mini`.
The key stays on the server. `/api/journey-concierge` validates questions, limits
output, sets a 20-second provider timeout, and requests `store: false`.
Without a configured key, or when the provider is unavailable, the input offers
a personal conversation instead of fabricating an AI answer.

TypeScript validation: `npx tsc --noEmit`. No production build is required.
