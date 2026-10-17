# Deployment guide (no terminal needed)

**How it works:** every time a change is saved to the `main` branch on GitHub, a robot (GitHub Actions) publishes the site to Firebase Hosting. Changes proposed in a pull request get a private **preview link** first.

## Review and publish the redesign
1. Upload these files to a new branch: GitHub repo → **Add file → Upload files**, choose *Create a new branch* named `rebrand/premium-redesign`, then **Propose changes** → **Create pull request**.
2. Wait 2–3 minutes. In the pull request, a bot comment shows a **preview URL**. Open it and look around. The live site is unchanged.
3. Happy? Click **Merge pull request**. Not happy? Click **Close pull request**; nothing changes.

## Did it work?
Repo → **Actions** tab. A green tick means published; a red cross means failed. Click the run, then the failed step, to read the message (most often a missing secret; see FIREBASE_LOGIN_SETUP.md).

## Update content
Open a file on GitHub → pencil icon → edit → **Commit changes**. The site updates in a few minutes.

## Roll back
Repo → **Pull requests → Closed**, open the one you want to undo, click **Revert**, then merge the new pull request it creates.

## Deploying database rules
The robot publishes the website only. After editing `firestore.rules`, copy its contents into Firebase Console → Build → Firestore Database → **Rules** → **Publish**.

## Custom domain
Firebase Console → Build → Hosting → **Add custom domain**, then add the DNS records it shows at your domain provider. Afterwards add the domain under Authentication → Settings → Authorized domains.
