export async function GET(): Promise<Response> {
  return Response.json({ ok: true, time: new Date().toISOString() });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}
