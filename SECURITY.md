# Security Policy

## Supported version

Security fixes are applied to the latest code on the `main` branch. The project is currently pre-1.0, so older versions may not receive backports.

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public issue. Use GitHub's private vulnerability reporting feature for this repository when available. If it is unavailable, contact the maintainer through the contact method shown on the maintainer's GitHub profile and clearly mark the message as a private security report.

Include the affected version or commit, reproduction steps, impact, and any suggested mitigation. Do not include real API keys or data belonging to other people.

The maintainer will acknowledge a complete report as soon as practical, investigate it, and coordinate disclosure after a fix or mitigation is available.

## Security-sensitive areas

Reports involving Electron IPC boundaries, local storage and backup recovery, LAN WebSocket collaboration, imported project files, dependency integrity, or user-supplied API credentials are especially useful.
