# Family Roots

Record your family tree, preserve its stories, and let relatives contribute together.

[![Deploy](https://github.com/babatundeawo/family-roots/actions/workflows/deploy.yml/badge.svg)](https://github.com/babatundeawo/family-roots/actions/workflows/deploy.yml)

[Documentation](docs/DEPLOYMENT.md) · [Report an issue](https://github.com/babatundeawo/family-roots/issues)

## About
Family Roots is a private space for families to build a shared tree, write down the stories and traditions behind each person, and see their history on a timeline. Relatives join by invitation, so the tree stays within the family.

## Features
- Family tree organised by generation, and a timeline of births and deaths
- Stories, birthplaces and traditions for every person
- Shared trees with owner, editor and viewer roles, joined through invite links
- Email and Google sign-in
- Installs on phones like an app, and keeps working offline
- Light and dark themes

## How to use it
1. Open the site and create an account or sign in.
2. Create a tree and add your oldest known ancestor with **+**.
3. Add children by choosing a parent when you add them.
4. Use **Invite** to send relatives a link as editors or viewers.
5. To install: Android Chrome, menu → *Install app*; iPhone Safari, Share → *Add to Home Screen*.

## Tech stack
Vanilla JavaScript (ES modules), Firebase Authentication, Cloud Firestore, Firebase Hosting, GitHub Actions.

## Project structure
```
public/            Site files (HTML, CSS, JS, icons, service worker)
firestore.rules    Database security rules
firebase.json      Hosting configuration and security headers
docs/              Guides for deployment, customising and login setup
.github/           Automated deploy, security scanning and updates
```

## Security
Please report vulnerabilities privately through the repository's **Security** tab.

## License
All rights reserved by the repository owner unless a LICENSE file states otherwise. System fonts are used; no third-party assets require attribution.
