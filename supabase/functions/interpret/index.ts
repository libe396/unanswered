import { createInterpretHandler } from './handler.ts';

Deno.serve(createInterpretHandler({
  key: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
  model: Deno.env.get('INTERPRET_MODEL') ?? '',
  // Its own name first, so widening this function's origins never quietly
  // widens the reports function's — project secrets are shared.
  origins: (Deno.env.get('INTERPRET_ALLOWED_ORIGINS') || Deno.env.get('REPORT_ALLOWED_ORIGINS') || 'https://libe396.github.io,http://localhost:5173,http://localhost:5199').split(',').map(value => value.trim()),
}));
