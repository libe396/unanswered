import { createReportHandler } from './handler.ts';

Deno.serve(createReportHandler({
  url: Deno.env.get('SUPABASE_URL') ?? '',
  key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  salt: Deno.env.get('REPORT_HASH_SALT') ?? '',
  origins: (Deno.env.get('REPORT_ALLOWED_ORIGINS') ?? 'https://libe396.github.io,http://localhost:5173').split(',').map(value => value.trim()),
}));
