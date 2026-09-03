# Security policy

Wapi Pesa handles highly sensitive financial documents when statement processing is explicitly enabled. The public showcase keeps uploads and every external write or payment path disabled by default.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting feature for this repository. Do not include a real statement, password, phone number, transaction record, credential, or generated report in a public issue.

If private reporting is unavailable, open a public issue containing only a request for a private contact channel and no vulnerability details.

## Supported version

Security fixes target the default branch. This project is currently a technical showcase and is not approved for production processing of financial documents.

## Repository data policy

- Only synthetic statement fixtures may be committed.
- Runtime secrets belong in ignored environment files or a deployment secret manager.
- Public examples must use invented names, identifiers, dates, and amounts.
- Before publishing history, scan every commit—not only the current tree—for statements, extracted text, credentials, and generated reports.
