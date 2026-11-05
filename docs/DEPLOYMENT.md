# Deployment guide (no terminal needed)

**How it works:** whenever a change lands on the `main` branch, a robot (GitHub Actions) builds the site and publishes it to Firebase Hosting. You never build anything yourself.

## Review and publish the redesign
1. Open the pull request named **Premium redesign** (GitHub → **Pull requests**).
2. Check the **Checks** at the bottom. Green ticks mean the site builds, every link and icon is found, and the database rules pass their tests.
3. Happy? Click **Merge pull request → Confirm merge**. Within about 3 minutes the **Deploy** robot publishes it.
4. Then publish the new database rules once: follow **Step 3** in [FIREBASE_SETUP.md](FIREBASE_SETUP.md).
5. Not happy? Click **Close pull request**. Nothing changes.

This setup does **not** create preview links for pull requests, to stay inside the free limits. See "Optional previews" below if you want them back.

## Did it work?
GitHub → **Actions**. A green tick means published; a red cross means it failed. Click the run, then the failed step, to read the message. The most common cause is a missing secret (see [FIREBASE_SETUP.md](FIREBASE_SETUP.md), Step 4).

## Update something
Open a file on GitHub, click the pencil icon, edit, then **Commit changes**. The site updates in a few minutes. See [CUSTOMIZING.md](CUSTOMIZING.md) for the files you will most likely want.

## Roll back
GitHub → **Pull requests → Closed**, open the one you want to undo, click **Revert**, then merge the new pull request it creates.

## Free-plan limits (Firebase Spark)
Hosting: 10 GB stored and about 360 MB sent per day. Firestore: 1 GiB stored, 50,000 reads and 20,000 writes per day. Sign-in: 50,000 monthly users. A family tree is far below these. If you ever pass them, the app pauses until the next day rather than charging you. I did not measure your live usage; check **Firebase Console → Usage** if you are curious.

## Optional previews
Firebase can publish a private preview link for each pull request. To turn that on, ask Claude to add a preview step to `.github/workflows/checks.yml`. It is off by default because it needs secrets that pull requests from outside contributors do not get.

## Custom domain
Firebase Console → **Build → Hosting → Add custom domain**, then add the DNS records it shows at your domain provider. Afterwards add the domain under **Authentication → Settings → Authorized domains**.

## Why Firebase Hosting and not GitHub Pages?
Sign-in sessions, installed copies of the app and invite links are tied to the website address, so moving it would sign everyone out and break links already sent. Firebase Hosting also sends real security headers, which GitHub Pages cannot.
