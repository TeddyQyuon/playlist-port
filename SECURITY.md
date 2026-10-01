# Security controls

Verified on 1 October 2026. Security implementation: `ce1b33f83911aeffb85bbcae707ce855db406b8f` and its two preceding hardening commits.

## Application controls

- Browser responses set Content Security Policy, frame restrictions, `nosniff`, a no-referrer policy, Permissions Policy, and same-origin resource restrictions. Express does not disclose `X-Powered-By`.
- Unsafe API methods require the exact configured client Origin and JSON Content-Type. Cross-site fetch metadata is rejected before parsing bodies or changing sessions.
- OAuth start and callback endpoints reject HEAD with 405 and `Allow: GET` before session handling. Normal GET OAuth remains supported.
- API responses use `Cache-Control: no-store`. Account tokens are stored in encrypted, authenticated cookies with Secure, HttpOnly, and SameSite controls; API responses do not expose plaintext tokens. OAuth state expires after ten minutes.
- Spotify Free and Premium accounts use the same playlist-copy authorization path. Both accounts must be allowed by Spotify while the developer app is in development mode.

## Deployed rate limit

The Vercel project `playlist-port` has one enabled custom firewall rule, **Playlist Port sensitive API requests**, published on 1 October 2026:

| Setting | Value |
| --- | --- |
| Request Path | Matches expression `^/api/(auth/start/[^/]+\|transfer)/?$` |
| Method | Is any of GET, POST |
| Algorithm | Fixed Window |
| Window | 60 seconds |
| Limit | 60 requests |
| Counter key | IP Address |
| Action | Too Many Requests (429) |
| Environment | All project environments |

This is project firewall configuration, separate from `vercel.json`; copying or deploying this repository to another project does not install the rule. Configure the same rule before opening another project to traffic. Vercel maintains counters per region, so this is not a single worldwide counter. Users sharing an IP share its allowance. The rule limits request frequency; it does not impose a durable limit on concurrent transfers or total playlists created by an account.

To tune the threshold, edit this existing rule and publish the reviewed change. For a false-positive rollback, change the follow-up action to Log and publish; restore 429 after verifying legitimate traffic. Avoid disabling project authentication or system mitigations to investigate a rate-limit issue.

## Verification

- `npm test`: 34 tests passed, including six security regression tests, encrypted-session checks, OAuth expiry, and Free/Premium transfer behavior. Spotify responses in automated tests are mocked.
- `npm run build`: passed.
- A separate preview deployment returned HTTP 429 with a temporary preview-only threshold of one request per IP per minute. The final published rule was then verified at 60 requests per 60 seconds with no environment restriction.
- After publishing, production returned 200 for the page and health endpoint, 400 for an invalid account slot, 405 for HEAD on sign-in, and 403 for a write without Origin. Browser headers were present and `X-Powered-By` was absent.

The review found no known vulnerabilities in the audited lockfile and no credential-pattern matches in the source and reachable commit history reviewed. These checks are evidence for the examined controls, not a guarantee against every attack. A new live copy between two Spotify accounts was not performed during security verification.
