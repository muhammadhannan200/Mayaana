import { expect, test } from "@playwright/test";

const securityHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

for (const path of ["/", "/demo"]) {
  for (const method of ["GET", "HEAD"]) {
    test(`${method} ${path} includes baseline security headers`, async ({
      request,
    }) => {
      // Do not follow redirects: verify the requested route's own response.
      const response = await request.fetch(path, { method, maxRedirects: 0 });
      expect(response.status()).toBe(200);

      const headers = response.headers();
      for (const [name, value] of Object.entries(securityHeaders)) {
        expect(headers[name], `${name} on ${method} ${path}`).toBe(value);
      }
      expect(headers["content-security-policy"]).toBeUndefined();
    });
  }
}
