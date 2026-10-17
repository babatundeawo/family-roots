# Setting up login (beginner guide)

**What this is:** Firebase Authentication is Google's service that checks who people are when they sign in. You will switch it on, create the database that stores trees, and give GitHub the details it needs. You only use two websites: Firebase Console and GitHub.

## 1. Enable sign-in
1. Go to console.firebase.google.com and open your project.
2. **Build → Authentication → Get started → Sign-in method**.
3. Click **Email/Password**, switch **Enable** on, **Save**. Repeat for **Google** (choose a support email). *You should see both listed as "Enabled".*

## 2. Register the web app and copy its details
1. Click the gear icon → **Project settings → General → Your apps → </> (Web)**. Nickname it "Family Roots", skip Hosting, **Register app**.
2. You'll see four values: `apiKey`, `authDomain`, `projectId`, `appId`. Keep this page open.

## 3. Create the database and rules
1. **Build → Firestore Database → Create database**, production mode, pick a nearby region.
2. Open the **Rules** tab, delete everything, paste the full contents of `firestore.rules` from this repo, click **Publish**. *You should see "Rules published".*

## 4. Authorized domains
**Authentication → Settings → Authorized domains → Add domain**: add your `*.web.app` address if missing, and any custom domain.

## 5. Give GitHub the details (secrets)
GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**. Create these five:
| Name | Value |
|---|---|
| `FIREBASE_API_KEY` | apiKey |
| `FIREBASE_AUTH_DOMAIN` | authDomain |
| `FIREBASE_PROJECT_ID` | projectId |
| `FIREBASE_APP_ID` | appId |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → Project settings → **Service accounts → Generate new private key**; open the downloaded file and paste ALL of its text |

## 6. Deploy
Repo → **Actions → Deploy → Run workflow**. *A green tick means it's live.*

## Test login
Open your site, create an account, sign out, sign in again. Create a tree, then try Invite with a second account.

## Common errors
- **auth/unauthorized-domain:** add the site's domain in step 4.
- **auth/invalid-api-key:** a secret is missing or has a typo; re-check step 5, then re-run the deploy.
- **permission-denied / Missing or insufficient permissions:** rules not published (step 3).
- **Google popup blocked:** allow popups for your site in the browser.

## Glossary
**API key / app ID:** public labels telling the app which Firebase project to talk to; not passwords. **Authorized domain:** a website allowed to use login. **Security rules:** the database's rulebook; this is what actually protects data. **Secret:** a value GitHub stores privately for the robot. **Custom claim:** a special flag on a user (not used here).

## Never share or commit
The downloaded service-account key file. Paste it only into the GitHub secret, then delete the file from your computer.
