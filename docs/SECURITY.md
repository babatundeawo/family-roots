# How your family's data is protected

## What protects the data
- **Database rules** (`firestore.rules`) run on Google's servers. Only members can read a tree. Only owners and editors can change people. Only owners can invite, rename or delete. Every save is checked for the right fields and sizes.
- **Security headers** (`firebase.json`) stop the site being framed by other sites and block scripts from unknown places.
- **No trackers.** The page loads no advertising or analytics scripts. Fonts are served from the site itself.
- **Secrets.** The four Firebase values in the build are public labels, not passwords. The service-account key lives only in GitHub secrets.

## Things to know
- Rules are not published by the robot. After any change to `firestore.rules`, publish them in the Firebase Console (FIREBASE_SETUP.md, Step 3).
- Anyone holding an invite link can join once signed in. Treat links like keys, and share them privately.
- Invite links stay valid until deleted. Deleting a tree does not remove its old invite codes, but they stop working because the tree no longer exists.
- Deleting an account removes the sign-in. Trees you own stay until you delete them.
- Tell your relatives that the story field is readable by everyone in the tree.

## What I could not verify
The rules are covered by automatic tests that run in GitHub Actions. I could not run them on the build machine I worked from, and I did not test against your live Firebase project. Check the **Rules** job in the pull request: it must be green before you merge.

## Reporting a problem
Use the repository's **Security** tab (see the root `SECURITY.md`).
