export async function GET(request: Request) {
  return Response.redirect(new URL('/payment/pending', request.url), 303);
}

export async function POST(request: Request) {
  // Safepay may return form data here. This route intentionally does not
  // interpret it as payment proof; only the authenticated webhook can do that.
  await request.formData().catch(() => null);
  return Response.redirect(new URL('/payment/pending', request.url), 303);
}
