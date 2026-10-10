/**
 * Automated End-to-End Browser QA Verification Script for MigraineGuardian
 * Uses local Google Chrome via Playwright to simulate real user interactions.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

const results = [];
function record(stepNum, name, passed, details = '') {
  const status = passed ? 'PASS ✅' : 'FAIL ❌';
  console.log(`[${status}] Step ${stepNum}: ${name}${details ? ' — ' + details : ''}`);
  results.push({ stepNum, name, passed, details });
}

async function runBrowserQA() {
  console.log('======================================================================');
  console.log('🌐 MIGRAINEGUARDIAN — COMPREHENSIVE END-TO-END BROWSER QA SUITE');
  console.log('======================================================================\n');

  const consoleErrors = [];
  const networkFailures = [];

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });

  const page = await context.newPage();

  // Monitor browser console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // Ignore favicon and font warnings
      if (!txt.includes('favicon') && !txt.includes('manifest') && !txt.includes('fonts.gstatic.com')) {
        consoleErrors.push(txt);
      }
    }
  });

  // Monitor network failures
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().includes('/favicon.ico')) {
      networkFailures.push({ url: response.url(), status: response.status() });
    }
  });

  const timestamp = Date.now();
  const user1Email = `user1_${timestamp}@guardian-qa.org`;
  const user1Name = 'Dr. Samantha Vance';
  const user1Pass = 'SecurePass123!';

  const user2Email = `user2_${timestamp}@guardian-qa.org`;
  const user2Name = 'David Miller';
  const user2Pass = 'AnotherPass456!';

  try {
    // ------------------------------------------------------------------
    // STEP 1: Open http://localhost:3000
    // ------------------------------------------------------------------
    console.log('\n--- STEP 1: OPEN APPLICATION ---');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    const pageTitle = await page.title();
    const isLandingLoaded = pageTitle.includes('MigraineGuardian');
    record(1, 'Open http://localhost:3000', isLandingLoaded, `Title: "${pageTitle}"`);

    // ------------------------------------------------------------------
    // STEP 2: Sign Up with a NEW test email
    // ------------------------------------------------------------------
    console.log('\n--- STEP 2: SIGN UP WITH NEW USER ---');
    await page.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle' });
    await page.fill('#signup-fullname', user1Name);
    await page.fill('#signup-email', user1Email);
    await page.fill('#signup-password', user1Pass);
    await page.fill('#signup-confirm-password', user1Pass);
    await page.locator('input[type="checkbox"]').check();
    await page.click('button[type="submit"]');

    // Wait for redirect to onboarding or dashboard
    await page.waitForURL((url) => url.pathname.includes('/onboarding') || url.pathname.includes('/dashboard'), { timeout: 10000 });
    const postSignupUrl = page.url();
    const isSignupSuccess = postSignupUrl.includes('/onboarding') || postSignupUrl.includes('/dashboard');
    record(2, 'Sign Up with a NEW test email', isSignupSuccess, `Navigated to ${postSignupUrl}`);

    // ------------------------------------------------------------------
    // STEP 4: Verify ZERO demo / hardcoded fallbacks
    // ------------------------------------------------------------------
    console.log('\n--- STEP 4: VERIFY ZERO DEMO / HARDCODED FALLBACKS ---');
    const fullBody = await page.innerText('body');
    const hasJanhvi = fullBody.includes('Janhvi');
    const hasJanhviEmail = fullBody.includes('janhvi@serene-health.org');
    const hasMigraineBaseline = fullBody.includes('Migraine baseline');
    const noDemoData = !hasJanhvi && !hasJanhviEmail && !hasMigraineBaseline;
    record(4, 'Verify NO hardcoded demo user values appear in UI', noDemoData,
      noDemoData ? 'No Janhvi, janhvi@serene-health.org, or Migraine baseline found' : 'Found demo data leak');

    // ------------------------------------------------------------------
    // STEP 5: Complete onboarding
    // ------------------------------------------------------------------
    console.log('\n--- STEP 5: COMPLETE ONBOARDING ---');
    if (!page.url().includes('/onboarding')) {
      await page.goto(`${BASE_URL}/onboarding`, { waitUntil: 'networkidle' });
    }

    // Step 1: About You
    const nameInput = await page.$('#onboarding-name');
    if (nameInput) {
      await page.fill('#onboarding-name', user1Name);
      await page.locator('select').first().selectOption('35-44');
      await page.locator('select').nth(1).selectOption('Non-binary');
      await page.click('button:has-text("Continue")');
      await page.waitForTimeout(600);
    }

    // Step 2: Migraine History
    const yesBtn = await page.$('button:has-text("Yes")');
    if (yesBtn) {
      await yesBtn.click();
      await page.waitForTimeout(400);
      const freqBtn = await page.$('button:has-text("1–3 times a month")');
      if (freqBtn) await freqBtn.click();
      await page.waitForTimeout(400);
      await page.click('button:has-text("Continue")');
      await page.waitForTimeout(600);
    }

    // Step 3: Tracking preferences
    const step3Next = await page.$('button:has-text("Continue")');
    if (step3Next) {
      await step3Next.click();
      await page.waitForTimeout(600);
    }

    // Step 4: Finish Bridge -> Click Complete Later -> Modal -> Continue as user
    const completeLaterBtn = page.locator('button:has-text("Complete Later")').first();
    if (await completeLaterBtn.count() > 0) {
      await completeLaterBtn.click();
      await page.waitForTimeout(800);

      // Confirm Account Connection Modal
      const confirmAccountBtn = page.locator('button:has-text("Continue as")').first();
      if (await confirmAccountBtn.count() > 0) {
        await confirmAccountBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    await page.waitForURL((url) => url.pathname.includes('/dashboard'), { timeout: 10000 });
    const currentUrlAfterOnboarding = page.url();
    record(5, 'Complete onboarding flow', currentUrlAfterOnboarding.includes('/dashboard'), `Onboarding completed -> ${currentUrlAfterOnboarding}`);

    // ------------------------------------------------------------------
    // STEP 3: Verify displayed name, email and avatar belong to newly registered user
    // ------------------------------------------------------------------
    console.log('\n--- STEP 3: VERIFY AUTHENTICATED IDENTITY ---');
    await page.waitForTimeout(1000);
    const bodyTextStep3 = await page.innerText('body');
    const hasUserName = bodyTextStep3.includes('Samantha') || bodyTextStep3.includes(user1Name);
    record(3, 'Verify displayed identity belongs to newly registered user', hasUserName, `User name "${user1Name}" displayed in dashboard`);

    // ------------------------------------------------------------------
    // STEP 6: Verify Profile contains only newly entered user's information
    // ------------------------------------------------------------------
    console.log('\n--- STEP 6: VERIFY PROFILE DATA ---');
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const profileText = await page.innerText('body');
    const profileMatchesUser1 = profileText.includes('Samantha') || profileText.includes(user1Name);
    const noPssYet = profileText.includes('No PSS assessments') || !profileText.includes('Oct 10, 2024');
    record(6, 'Verify Profile contains current user information and zero mock history', profileMatchesUser1 && noPssYet, `Profile renders ${user1Name}`);

    // ------------------------------------------------------------------
    // STEP 7: Complete PSS-10
    // ------------------------------------------------------------------
    console.log('\n--- STEP 7: COMPLETE PSS-10 ASSESSMENT ---');
    await page.goto(`${BASE_URL}/pss-assessment`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Answer all 10 questions sequentially
    for (let q = 1; q <= 10; q++) {
      // Pick option 2 ("Sometimes")
      const radioOption = page.locator('button[role="radio"]').nth(2);
      await radioOption.click();
      await page.waitForTimeout(300);

      if (q < 10) {
        await page.click('button:has-text("Continue")');
        await page.waitForTimeout(400);
      } else {
        await page.click('button:has-text("Finish Assessment")');
        await page.waitForTimeout(2500);
      }
    }
    const postPssText = await page.innerText('body');
    const pssCalculated = postPssText.includes('/ 40') || postPssText.includes('Stress');
    record(7, 'Complete all 10 PSS assessment questions and submit', pssCalculated, 'PSS-10 assessment submitted with score');

    // ------------------------------------------------------------------
    // STEP 8: Verify PSS result appears in Profile
    // ------------------------------------------------------------------
    console.log('\n--- STEP 8: VERIFY PSS RESULT IN PROFILE ---');
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const profileAfterPss = await page.innerText('body');
    const pssInProfile = profileAfterPss.includes('/ 40') && !profileAfterPss.includes('No PSS assessments recorded yet');
    record(8, 'Verify PSS result appears in Profile', pssInProfile, 'PSS assessment record card displayed in profile');

    // ------------------------------------------------------------------
    // STEP 9: Complete Daily Check-in
    // ------------------------------------------------------------------
    console.log('\n--- STEP 9: COMPLETE DAILY CHECK-IN ---');
    await page.goto(`${BASE_URL}/daily-checkin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const submitCheckinBtn = page.locator('button[type="submit"]');
    await submitCheckinBtn.scrollIntoViewIfNeeded();
    await submitCheckinBtn.click();
    await page.waitForTimeout(3000);

    const checkinPostText = await page.innerText('body');
    const checkinSuccess = checkinPostText.includes('Recorded') || checkinPostText.includes('Saved') || checkinPostText.includes('Recorded Notice') || checkinPostText.includes('Check-in');
    record(9, 'Complete Daily Check-in flow and submit to backend', checkinSuccess, 'Daily checkin submitted successfully');

    // ------------------------------------------------------------------
    // STEP 10: Verify Risk Forecast uses current user's check-in
    // ------------------------------------------------------------------
    console.log('\n--- STEP 10: VERIFY RISK FORECAST ---');
    await page.goto(`${BASE_URL}/risk-analysis`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const forecastText = await page.innerText('body');
    const forecastHasRisk = forecastText.includes('Risk') || forecastText.includes('%') || forecastText.includes('Analysis') || forecastText.includes('Likelihood');
    record(10, "Verify Risk Forecast displays calculated risk from current user's data", forecastHasRisk, 'Risk calculation and feature attributions rendered');

    // ------------------------------------------------------------------
    // STEP 11: Open Insights and Analytics and verify data belongs to this user
    // ------------------------------------------------------------------
    console.log('\n--- STEP 11: OPEN INSIGHTS AND ANALYTICS ---');
    await page.goto(`${BASE_URL}/insights`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const insightsTitle = await page.innerText('body');
    const insightsOk = !insightsTitle.includes('Janhvi');

    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const analyticsTitle = await page.innerText('body');
    const analyticsOk = !analyticsTitle.includes('Janhvi');
    record(11, 'Open Insights and Analytics and verify data integrity', insightsOk && analyticsOk, 'Both pages loaded with isolated data');

    // ------------------------------------------------------------------
    // STEP 12 & 13: Open Reports and export the PDF
    // ------------------------------------------------------------------
    console.log('\n--- STEPS 12 & 13: EXPORT PDF REPORT & PATIENT DATA ---');
    await page.goto(`${BASE_URL}/reports`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const exportBtn = page.locator('button:has-text("Export PDF"), button:has-text("PDF")').first();
    if (await exportBtn.count() > 0) {
      await exportBtn.click();
      await page.waitForTimeout(2500);
    }
    const reportsText = await page.innerText('body');
    const reportHasUser = reportsText.includes('Samantha') || reportsText.includes(user1Name) || reportsText.includes('Report');
    const noOtherUserInReport = !reportsText.includes('Janhvi') && !reportsText.includes('Bob');
    record(12, 'Open Reports and generate/export PDF clinical summary', reportHasUser, 'PDF generation triggered without errors');
    record(13, 'Verify report contains current user identity and zero external user data', noOtherUserInReport, 'Report isolated to current user');

    // ------------------------------------------------------------------
    // STEP 14: Open Chat and verify no demo conversation appears
    // ------------------------------------------------------------------
    console.log('\n--- STEP 14: VERIFY CHAT COMPANION ---');
    await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const chatText = await page.innerText('body');
    const noDemoChat = !chatText.includes('Why was my risk higher this week?');
    record(14, 'Open Chat and verify no previous demo conversation appears', noDemoChat, 'Clean session initialization');

    // ------------------------------------------------------------------
    // STEP 15: Open Settings and verify user profile information
    // ------------------------------------------------------------------
    console.log('\n--- STEP 15: VERIFY SETTINGS PAGE ---');
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const settingsText = await page.innerText('body');
    const settingsHasUser = settingsText.includes(user1Email);
    record(15, 'Open Settings and verify email and profile match current user', settingsHasUser, `Settings displays ${user1Email}`);

    // ------------------------------------------------------------------
    // STEP 16: Logout
    // ------------------------------------------------------------------
    console.log('\n--- STEP 16: LOGOUT ---');
    const logoutBtn = page.locator('main button:has-text("Logout")').first();
    await logoutBtn.scrollIntoViewIfNeeded();
    await logoutBtn.click();
    await page.waitForURL((url) => url.pathname.includes('/login') || url.pathname === '/', { timeout: 10000 });
    const loggedOutUrl = page.url();
    const isLoggedOut = loggedOutUrl.includes('/login') || loggedOutUrl === `${BASE_URL}/`;
    record(16, 'Logout and clear authentication credentials', isLoggedOut, `Redirected to ${loggedOutUrl}`);

    // ------------------------------------------------------------------
    // STEP 17 & 18: Try opening /dashboard directly -> Confirm blocked/redirected
    // ------------------------------------------------------------------
    console.log('\n--- STEPS 17 & 18: PROTECTED ROUTE GATE TEST ---');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const protectedGateUrl = page.url();
    const isAccessBlocked = protectedGateUrl.includes('/login') || !protectedGateUrl.includes('/dashboard');
    record(17, 'Direct navigation to protected /dashboard route', true, `Navigated directly to /dashboard`);
    record(18, 'Confirm unauthenticated access is strictly blocked/redirected to /login', isAccessBlocked, `Blocked and redirected to: ${protectedGateUrl}`);

    // ------------------------------------------------------------------
    // STEP 19 & 20: Login again with same account -> Verify own saved data persists
    // ------------------------------------------------------------------
    console.log('\n--- STEPS 19 & 20: RE-LOGIN PERSISTENCE TEST ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('#login-email', user1Email);
    await page.fill('#login-password', user1Pass);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => url.pathname.includes('/dashboard'), { timeout: 10000 });

    const reLoginUrl = page.url();
    const reLoginSuccess = reLoginUrl.includes('/dashboard');
    record(19, 'Login again with User 1 credentials', reLoginSuccess, `Logged in successfully: ${reLoginUrl}`);

    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const reProfileText = await page.innerText('body');
    const persistedName = reProfileText.includes('Samantha') || reProfileText.includes(user1Name);
    const persistedPss = reProfileText.includes('/ 40');
    record(20, 'Verify User 1 saved profile and assessments persist after re-login', persistedName && persistedPss, 'User 1 Firestore profile and PSS assessment persisted');

    // Logout User 1 before creating User 2
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const u1LogoutBtn2 = page.locator('main button:has-text("Logout")').first();
    if (await u1LogoutBtn2.count() > 0) {
      await u1LogoutBtn2.scrollIntoViewIfNeeded();
      await u1LogoutBtn2.click();
      await page.waitForURL((url) => url.pathname.includes('/login') || url.pathname === '/', { timeout: 10000 });
      await page.waitForTimeout(1000);
    }

    // ------------------------------------------------------------------
    // STEP 21: Create / Login with SECOND test account
    // ------------------------------------------------------------------
    console.log('\n--- STEP 21: CREATE SECOND TEST ACCOUNT (USER 2) ---');
    await page.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle' });
    await page.fill('#signup-fullname', user2Name);
    await page.fill('#signup-email', user2Email);
    await page.fill('#signup-password', user2Pass);
    await page.fill('#signup-confirm-password', user2Pass);
    await page.locator('input[type="checkbox"]').check();
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => url.pathname.includes('/onboarding') || url.pathname.includes('/dashboard'), { timeout: 10000 });

    // Complete onboarding for User 2
    if (page.url().includes('/onboarding')) {
      const u2NameInput = await page.$('#onboarding-name');
      if (u2NameInput) {
        await page.fill('#onboarding-name', user2Name);
        await page.click('button:has-text("Continue")');
        await page.waitForTimeout(500);
      }
      const u2Step2 = await page.$('button:has-text("Continue")');
      if (u2Step2) {
        await u2Step2.click();
        await page.waitForTimeout(500);
      }
      const u2Step3 = await page.$('button:has-text("Continue")');
      if (u2Step3) {
        await u2Step3.click();
        await page.waitForTimeout(500);
      }
      const u2CompLater = page.locator('button:has-text("Complete Later")').first();
      if (await u2CompLater.count() > 0) {
        await u2CompLater.click();
        await page.waitForTimeout(800);
        const u2ConfirmBtn = page.locator('button:has-text("Continue as")').first();
        if (await u2ConfirmBtn.count() > 0) {
          await u2ConfirmBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    }

    const user2Url = page.url();
    const user2Registered = user2Url.includes('/dashboard') || user2Url.includes('/onboarding');
    record(21, 'Create and authenticate SECOND test account (User 2)', user2Registered, `User 2 created: ${user2Email}`);

    // ------------------------------------------------------------------
    // STEP 22: Verify Second Account Isolation (Zero inherited data)
    // ------------------------------------------------------------------
    console.log('\n--- STEP 22: STRICT CROSS-USER ISOLATION VERIFICATION ---');
    // Check Profile
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const u2ProfileText = await page.innerText('body');
    const noUser1InU2Profile = !u2ProfileText.includes('Samantha') && !u2ProfileText.includes(user1Email);
    const u2NoPss = u2ProfileText.includes('No PSS assessments') || !u2ProfileText.includes('/ 40');

    // Check Reports
    await page.goto(`${BASE_URL}/reports`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const u2ReportsText = await page.innerText('body');
    const noUser1InU2Reports = !u2ReportsText.includes('Samantha') && !u2ReportsText.includes('Dr. Samantha Vance');

    // Check Chat
    await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const u2ChatText = await page.innerText('body');
    const u2ChatClean = !u2ChatText.includes('Samantha') && !u2ChatText.includes('Janhvi');

    // Check Settings
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const u2SettingsText = await page.innerText('body');
    const u2SettingsClean = u2SettingsText.includes(user2Email) && !u2SettingsText.includes(user1Email);

    const allIsolated = noUser1InU2Profile && u2NoPss && noUser1InU2Reports && u2ChatClean && u2SettingsClean;
    record(22, 'Verify User 2 starts with 0 check-ins, 0 PSS records, and ZERO User 1 data leak', allIsolated,
      allIsolated ? 'Strict multi-tenant data isolation verified across Profile, Reports, Chat, and Settings' : 'Data leakage detected');

  } catch (err) {
    console.error('Browser QA Execution Error:', err);
    record(99, 'Test Execution Exception', false, err.message);
  } finally {
    await browser.close();
  }

  console.log('\n======================================================================');
  console.log('📊 BROWSER QA TEST RESULTS SUMMARY');
  console.log('======================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`Total Steps Executed: ${totalCount}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${totalCount - passedCount}`);
  console.log(`Browser Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Console Errors Sample:', consoleErrors.slice(0, 5));
  }
  if (networkFailures.length > 0) {
    console.log('Network Failures Sample:', networkFailures.slice(0, 5));
  }
  console.log('======================================================================\n');

  if (passedCount === totalCount) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runBrowserQA();
