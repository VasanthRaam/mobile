# Production Deployment and APK Build Guide

This guide details the step-by-step process of merging code changes from the `develop` branch to the `main` (production) branch and building the live APK/AAB for VHA EduTech.

---

## Part 1: Merging Changes to Production (`main`)

Since you have set up branch protection rules (rulesets) on the `main` branch, you cannot push directly to `main`. You must merge your changes using a Pull Request (PR).

### Step 1: Push latest local changes to `develop`
Make sure all your latest features are committed and pushed to the `develop` branch on GitHub:
```bash
git checkout develop
git push origin develop
```

### Step 2: Open a Pull Request (PR) on GitHub
1. Go to your repository on **GitHub** (e.g., `https://github.com/VasanthRaam/mobile`).
2. You will see a banner saying: **"develop had recent pushes... Compare & pull request"**. Click on it.
3. If the banner doesn't appear:
   - Click the **Pull Requests** tab.
   - Click **New pull request**.
   - Set **base:** `main` and **compare:** `develop`.
4. Add a title (e.g., `Release: Settings, DOB picker, and bug fixes`) and description.
5. Click **Create pull request**.

### Step 3: Approve and Merge the PR
1. As the repository owner/administrator, review the changes.
2. If your ruleset requires merge approvals:
   - Request review / approve the PR (if you allow admins to self-approve or bypass rules).
   - If self-approval is blocked by the ruleset, you may need a teammate to approve, or temporarily bypass it as an administrator to merge.
3. Once approved and status checks (if any) pass, click the **Merge pull request** button, then click **Confirm merge**.

---

## Part 2: Building the Live Android APK

We use **Expo Application Services (EAS)** to build the application binaries.

### Prerequisite: Install EAS CLI
Make sure you have `eas-cli` installed globally on your machine:
```bash
npm install -g eas-cli
```
And log in to your Expo account:
```bash
eas login
```

### Option A: Build a Testable APK (Recommended for testing on devices)
To build a standalone `.apk` file that you can download and install directly on any Android device:
1. Open your terminal in the `mobile` directory.
2. Run the EAS build command using the `preview` profile:
   ```bash
   eas build --profile preview --platform android
   ```
3. Once the build finishes, EAS will output a QR code and a direct download link to the `.apk` file.

### Option B: Build a Production AAB (For Google Play Store upload)
To build the `.aab` bundle required for uploading to the Google Play Console:
1. Run the EAS build command using the `production` profile:
   ```bash
   eas build --profile production --platform android
   ```
2. Download the resulting `.aab` file from your Expo dashboard to submit to Google Play.
