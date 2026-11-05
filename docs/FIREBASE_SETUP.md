# Firebase setup (beginner guide, no terminal)

You only use two websites: the **Firebase Console** and **GitHub**. Everything stays on the free plans (Firebase Spark and GitHub Free). Nothing here needs a credit card.

**Already set up before?** If your site already works, you only need **Step 3** (publish the new, stricter database rules). The secrets in Step 4 are the same ones you already have.

## Step 1: Turn on sign-in
1. Open console.firebase.google.com and open your project.
2. Click **Build → Authentication → Get started → Sign-in method**.
3. Click **Email/Password**, switch **Enable** on, click **Save**.
4. Click **Google**, switch **Enable** on, choose a support email, click **Save**.
   *You should see both listed as "Enabled".*

## Step 2: Register the web app and copy its four values
1. Click the gear icon, then **Project settings → General → Your apps → the </> (Web) icon**.
2. Nickname it "Family Roots", leave "Firebase Hosting" unticked, click **Register app**.
3. You will see `apiKey`, `authDomain`, `projectId` and `appId`. Keep this page open for Step 4.

## Step 3: Create the database and publish the rules
1. Click **Build → Firestore Database → Create database**. Choose **production mode** and a region near your family.
2. Open the **Rules** tab. Delete everything in the box.
3. On GitHub, open the file `firestore.rules` in this repository, click the **Copy raw file** icon, and paste it into the Firebase box.
4. Click **Publish**. *You should see "Rules published".*

> The robot publishes the website only. **Every time `firestore.rules` changes, repeat Step 3.** This redesign tightens the rules (it checks the size and type of everything saved), so publish them once after you merge it.

## Step 4: Add the secrets to GitHub
On GitHub open your repository, then **Settings → Secrets and variables → Actions → New repository secret**. Create these five. Names must match exactly.

| Name | Value |
|---|---|
| `FIREBASE_API_KEY` | the `apiKey` from Step 2 |
| `FIREBASE_AUTH_DOMAIN` | the `authDomain` |
| `FIREBASE_PROJECT_ID` | the `projectId` |
| `FIREBASE_APP_ID` | the `appId` |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → gear icon → **Project settings → Service accounts → Generate new private key**. Open the downloaded file and paste ALL of its text. Then delete the file from your computer. |

The first four are public labels that tell the app which Firebase project to use. They are not passwords. Your data is protected by the database rules in Step 3.

## Step 5: Allow your website address to sign in
Firebase Console → **Authentication → Settings → Authorized domains → Add domain**. Your `your-project.web.app` address is normally there already. Add any custom domain too.

## Step 6: Publish
GitHub → **Actions → Deploy → Run workflow → Run workflow**. Wait 2 to 3 minutes. *A green tick means it is live.*

## Test it
1. Open your site and create an account. Sign out and sign in again.
2. Create a tree and add two people.
3. Tap **Invite**, copy the link, open it in a private window, create a second account, and check that you can join.

## Common errors
- **"This website address is not yet allowed to sign in" (auth/unauthorized-domain):** do Step 5.
- **"Missing GitHub secret(s)" in the Deploy run:** do Step 4, then run Step 6 again.
- **"You do not have permission" (permission-denied):** the rules are not published. Do Step 3.
- **The Google window does not open:** allow pop-ups for your site in your browser.
- **"This sign-in method is not turned on yet":** do Step 1.

## Glossary
- **API key and app ID:** public labels naming your Firebase project. Not passwords.
- **Authorized domain:** a website address allowed to use sign-in.
- **Security rules:** the database's rulebook. This is what protects your family's data.
- **Secret:** a value GitHub keeps private and gives only to the robot.

## Never share or commit
The downloaded service-account key file. Paste it only into the GitHub secret, then delete it from your computer.
