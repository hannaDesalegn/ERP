# Security Policy

Thank you for helping keep this project and its users safe. This document
explains how to report a security vulnerability and what to expect afterwards.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
pull requests, discussions, or any other public channel.**

Report them privately by email to:

**hannadesalegn21@gmail.com**

If you do not receive an acknowledgement, please follow up at the same address
rather than disclosing the issue publicly.

## What to include

A report that can be reproduced is far more useful than a description. Where
possible, include:

- **Summary** — the type of issue (for example broken authorisation, injection,
  information disclosure) and the component affected.
- **Location** — the endpoint, page, file or function involved, and the commit
  or branch you tested.
- **Steps to reproduce** — the exact sequence needed to trigger the issue,
  including request and response pairs where relevant.
- **Impact** — what an attacker could achieve, and under what conditions.
- **Severity** — your own assessment, if you have one.
- **Suggested fix** — optional, but welcome.

Remove or redact any credentials, tokens, personal data or other secrets from
your report before sending it. Placeholders are sufficient to describe where a
value was used.

## Handling secrets

If, during your research, you come across a credential, API key, token,
connection string or other secret — in this repository, its history, a build
artefact or anywhere else:

- **Do not publish it**, in an issue, pull request, commit, forum or anywhere
  else.
- **Do not use it** to access systems or data beyond the minimum needed to
  confirm that it is valid.
- **Report its location privately**, using the address above, without
  including the secret value itself.

## Responsible disclosure

We ask that you:

- give us a reasonable opportunity to investigate and address the issue before
  any public disclosure;
- make a good-faith effort to avoid privacy violations, data destruction, and
  interruption or degradation of service;
- access or modify only the data needed to demonstrate the issue, and only data
  you are authorised to access;
- test only against your own local instance, or against a deployment you have
  explicit written permission to test.

In return, we will:

- acknowledge your report as soon as practical;
- keep you informed about our assessment and progress;
- let you know when the issue has been resolved;
- credit you for the discovery if you would like to be credited.

This is a training project maintained on a best-effort basis, so we cannot
commit to fixed response times.

## Supported versions

Security fixes are applied to the `main` branch only. Older commits, forks and
unofficial copies are not supported.

## Scope

**In scope**

- Source code in this repository: the Express API under `backend/` and the
  React application under `frontend/`.
- Authentication, authorisation, input validation, data exposure and other
  weaknesses in that code.
- Secrets or sensitive information exposed through the repository or its
  history.

**Out of scope**

- Vulnerabilities in third-party hosting, database or infrastructure providers.
  Please report those directly to the vendor concerned.
- Denial-of-service, load or stress testing.
- Social engineering, phishing or physical attacks against maintainers or
  contributors.
- The frontend's mock API mode (`VITE_USE_MOCKS=true`). It runs entirely in the
  browser with in-memory fixtures and is a development aid, not a security
  boundary.
- Reports based solely on automated scanner output or dependency version
  numbers, without a demonstrated, exploitable impact on this project.
- Missing best-practice configuration with no demonstrated security impact.

## Data

This project holds no real data. All records in the repository and its
development datasets are invented. If you believe you have found real personal
or business data, please report it privately as a security issue.
