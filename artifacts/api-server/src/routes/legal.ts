import { Router } from "express";

const router = Router();

const HTML_STYLE = `
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #f9f9f9; color: #222; line-height: 1.7; }
    .container { max-width: 780px; margin: 0 auto; padding: 40px 24px 80px; background: #fff;
                 min-height: 100vh; border-left: 1px solid #eee; border-right: 1px solid #eee; }
    h1 { font-size: 28px; font-weight: 700; color: #E8742A; margin-bottom: 6px; }
    .subtitle { font-size: 13px; color: #888; margin-bottom: 36px; }
    h2 { font-size: 16px; font-weight: 600; margin-top: 32px; margin-bottom: 8px; color: #111; }
    p, li { font-size: 14px; color: #444; margin-bottom: 8px; }
    ul { padding-left: 20px; margin-bottom: 8px; }
    a { color: #E8742A; text-decoration: none; }
    hr { border: none; border-top: 1px solid #eee; margin: 36px 0; }
    .footer { font-size: 12px; color: #999; margin-top: 48px; }
  </style>
`;

// ─── Privacy Policy ──────────────────────────────────────────────────────────
router.get("/privacy", (_req, res) => {
  const lastUpdated = "1 May 2026";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy – RentZilla</title>
  ${HTML_STYLE}
</head>
<body>
<div class="container">
  <h1>Privacy Policy</h1>
  <p class="subtitle">RentZilla &nbsp;·&nbsp; Last updated: ${lastUpdated}</p>

  <p>
    RentZilla ("we", "our", or "us") operates a peer-to-peer rental marketplace that connects
    customers with equipment providers and service professionals across Punjab, India.
    This Privacy Policy explains how we collect, use, store, share, and protect your personal
    information when you use our mobile application and related services.
  </p>
  <p>
    By creating an account or using RentZilla, you agree to the practices described in this policy.
    If you do not agree, please do not use the app.
  </p>

  <h2>1. Information We Collect</h2>
  <p><strong>Account information:</strong> First name, last name, email address, mobile number,
  and password (stored as a secure hash — we never store your plain-text password).</p>
  <p><strong>Profile information:</strong> Profile photo, role (customer / provider), and any
  additional details you choose to provide.</p>
  <p><strong>Location data:</strong> With your explicit permission we collect your approximate
  device location to show nearby listings and auto-fill service addresses. Location is not
  collected in the background.</p>
  <p><strong>Listings and bookings:</strong> Content you post as a provider (photos, descriptions,
  pricing) and booking records including dates, amounts, and status history.</p>
  <p><strong>Payment information:</strong> We process payments through Razorpay. We do not store
  full card numbers or UPI credentials on our servers. We retain transaction IDs, amounts, and
  status for billing and dispute resolution.</p>
  <p><strong>Communications:</strong> In-app messages between customers and providers, and support
  tickets you submit.</p>
  <p><strong>Device and usage data:</strong> Device type, operating system version, app version,
  IP address, and anonymised usage analytics to improve the service.</p>
  <p><strong>Documents:</strong> Identity documents (e.g. Aadhaar) and insurance certificates
  submitted by providers for trust verification. These are stored securely and reviewed only by
  our verification team.</p>

  <h2>2. How We Use Your Information</h2>
  <ul>
    <li>Create and manage your account.</li>
    <li>Match customers with relevant providers and listings.</li>
    <li>Process payments and manage your in-app wallet.</li>
    <li>Send booking confirmations, status updates, and support replies.</li>
    <li>Detect and prevent fraud, spam, and policy violations.</li>
    <li>Improve search relevance, pricing models, and app features.</li>
    <li>Comply with applicable laws and respond to legal requests.</li>
    <li>Send push notifications (only if you grant permission; you can disable them at any time
        in your device settings).</li>
  </ul>

  <h2>3. Information Sharing</h2>
  <p>We do not sell your personal data. We share information only in the following circumstances:</p>
  <ul>
    <li><strong>Between users:</strong> Provider name, photo, listings, and ratings are visible to
    customers. Customer name is shared with a provider when a booking is confirmed.</li>
    <li><strong>Service providers:</strong> We use Razorpay (payments), Google Maps (location
    services), and Expo / Firebase (push notifications). Each has its own privacy policy and
    processes data only as necessary to provide their service.</li>
    <li><strong>Legal obligations:</strong> We may disclose data when required by law, court order,
    or to protect the safety of our users or the public.</li>
    <li><strong>Business transfers:</strong> In the event of a merger or acquisition, your data
    may be transferred, subject to the same protections described here.</li>
  </ul>

  <h2>4. Data Retention</h2>
  <p>
    We retain your account data for as long as your account is active. If you delete your account,
    we remove your personal information within 30 days, except where retention is required by law
    (e.g. financial records). Anonymised, aggregated data may be retained indefinitely for analytics.
  </p>

  <h2>5. Your Rights</h2>
  <ul>
    <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
    <li><strong>Correction:</strong> Update inaccurate or incomplete information via your profile
    settings.</li>
    <li><strong>Deletion:</strong> Delete your account from Settings → Delete Account. This
    permanently removes your profile, listings, and personal data from our systems within 30 days.
    </li>
    <li><strong>Portability:</strong> Request a structured export of your data.</li>
    <li><strong>Opt-out:</strong> Disable marketing emails or push notifications at any time.</li>
  </ul>
  <p>To exercise these rights, email us at <a href="mailto:privacy@rentzilla.in">privacy@rentzilla.in</a>.</p>

  <h2>6. Security</h2>
  <p>
    We use HTTPS for all data in transit and encrypt sensitive fields at rest. Passwords are hashed
    using bcrypt. Access to production systems is restricted to authorised personnel. Despite these
    measures, no system is completely secure — please use a strong, unique password.
  </p>

  <h2>7. Children</h2>
  <p>
    RentZilla is not directed at children under the age of 18. We do not knowingly collect personal
    information from minors. If you believe a child has created an account, contact us and we will
    remove it promptly.
  </p>

  <h2>8. Third-Party Services</h2>
  <ul>
    <li><a href="https://razorpay.com/privacy/" target="_blank">Razorpay Privacy Policy</a></li>
    <li><a href="https://policies.google.com/privacy" target="_blank">Google Privacy Policy</a> (Maps &amp; Sign-In)</li>
    <li><a href="https://expo.dev/privacy" target="_blank">Expo Privacy Policy</a> (push notifications &amp; updates)</li>
  </ul>

  <h2>9. Changes to This Policy</h2>
  <p>
    We may update this policy from time to time. When we do, we will update the "Last updated" date
    at the top and notify you via the app or email for material changes. Continued use of RentZilla
    after changes take effect constitutes acceptance of the revised policy.
  </p>

  <h2>10. Contact Us</h2>
  <p>
    If you have questions, concerns, or requests about this Privacy Policy, please contact:<br/>
    <strong>RentZilla Privacy Team</strong><br/>
    Email: <a href="mailto:privacy@rentzilla.in">privacy@rentzilla.in</a><br/>
    Address: Punjab, India
  </p>

  <hr/>
  <p class="footer">
    &copy; ${new Date().getFullYear()} RentZilla. All rights reserved.
    &nbsp;·&nbsp; <a href="/terms">Terms of Service</a>
    &nbsp;·&nbsp; <a href="/privacy">Privacy Policy</a>
  </p>
</div>
</body>
</html>`);
});

// ─── Terms of Service ────────────────────────────────────────────────────────
router.get("/terms", (_req, res) => {
  const lastUpdated = "1 May 2026";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terms of Service – RentZilla</title>
  ${HTML_STYLE}
</head>
<body>
<div class="container">
  <h1>Terms of Service</h1>
  <p class="subtitle">RentZilla &nbsp;·&nbsp; Last updated: ${lastUpdated}</p>

  <p>
    These Terms of Service ("Terms") govern your use of the RentZilla mobile application and
    website (collectively, the "Service"), operated by RentZilla ("we", "us", "our").
    By registering for an account or using the Service, you agree to be bound by these Terms.
  </p>

  <h2>1. Eligibility</h2>
  <p>
    You must be at least 18 years old to use RentZilla. By using the Service you represent that
    you meet this requirement and that the information you provide is accurate.
  </p>

  <h2>2. User Accounts</h2>
  <p>
    You are responsible for maintaining the confidentiality of your account credentials and for all
    activity that occurs under your account. Notify us immediately at
    <a href="mailto:support@rentzilla.in">support@rentzilla.in</a> if you suspect unauthorised access.
  </p>

  <h2>3. Provider Listings</h2>
  <ul>
    <li>Providers may list equipment and services for rent. All listings must be accurate,
    lawful, and your own property or lawfully authorised for subletting.</li>
    <li>Providers are solely responsible for the condition, legality, and safety of listed items.</li>
    <li>We reserve the right to remove any listing that violates these Terms or our policies.</li>
  </ul>

  <h2>4. Bookings and Payments</h2>
  <ul>
    <li>Customers pay through the in-app wallet or supported payment methods via Razorpay.</li>
    <li>A platform commission of 15 % is deducted from provider earnings per completed booking.</li>
    <li>Payments are held in escrow and released to the provider after job completion.</li>
    <li>Refunds are subject to the provider's cancellation terms and our dispute resolution process.</li>
  </ul>

  <h2>5. Gold Membership</h2>
  <p>
    Gold Membership is a one-time purchase from your wallet. Gold members receive a 4% automatic
    discount on every booking. Membership is non-refundable once activated.
  </p>

  <h2>6. Prohibited Conduct</h2>
  <ul>
    <li>Posting false, misleading, or fraudulent listings.</li>
    <li>Harassing, threatening, or abusing other users.</li>
    <li>Circumventing the platform to transact outside the app.</li>
    <li>Using automated scripts or bots to access the Service.</li>
    <li>Uploading malware or attempting to compromise system security.</li>
    <li>Violating any applicable local, state, or national law.</li>
  </ul>

  <h2>7. Dispute Resolution</h2>
  <p>
    Disputes between customers and providers should first be resolved through in-app messaging.
    If unresolved, either party may raise a formal dispute through the app. Our support team will
    review evidence and make a binding decision within 7 business days.
  </p>

  <h2>8. Limitation of Liability</h2>
  <p>
    RentZilla is a marketplace platform and is not a party to agreements between customers and
    providers. To the maximum extent permitted by law, we are not liable for loss, damage, injury,
    or any other claim arising from transactions between users.
  </p>

  <h2>9. Indemnification</h2>
  <p>
    You agree to indemnify and hold harmless RentZilla and its affiliates from any claims,
    damages, or expenses (including legal fees) arising from your use of the Service or violation
    of these Terms.
  </p>

  <h2>10. Termination</h2>
  <p>
    We may suspend or terminate your account at any time for violation of these Terms or applicable
    law. You may delete your account at any time from Settings → Delete Account.
  </p>

  <h2>11. Governing Law</h2>
  <p>
    These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive
    jurisdiction of the courts in Punjab, India.
  </p>

  <h2>12. Changes to These Terms</h2>
  <p>
    We may update these Terms from time to time. Continued use of the Service after changes take
    effect constitutes acceptance of the revised Terms.
  </p>

  <h2>13. Contact</h2>
  <p>
    Questions about these Terms? Contact us at
    <a href="mailto:support@rentzilla.in">support@rentzilla.in</a>.
  </p>

  <hr/>
  <p class="footer">
    &copy; ${new Date().getFullYear()} RentZilla. All rights reserved.
    &nbsp;·&nbsp; <a href="/terms">Terms of Service</a>
    &nbsp;·&nbsp; <a href="/privacy">Privacy Policy</a>
  </p>
</div>
</body>
</html>`);
});

export default router;
