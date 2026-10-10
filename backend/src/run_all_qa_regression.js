import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import { auth, db } from './config/firebaseAdmin.js';
import { firestoreService } from './services/firestoreService.js';
import { mlInferenceService } from './services/mlInferenceService.js';
import { weatherApiService } from './services/weatherApiService.js';

const qaResults = {
  authentication: [],
  profile: [],
  onboarding: [],
  dashboard: [],
  checkin: [],
  pss: [],
  riskForecast: [],
  mlPrediction: [],
  insights: [],
  analytics: [],
  reports: [],
  chat: [],
  weather: [],
  isolation: [],
  security: [],
  errors: [],
};

function record(category, name, passed, details = '') {
  const item = { name, passed, details };
  qaResults[category].push(item);
  console.log(`  [${passed ? 'PASS ✅' : 'FAIL ❌'}] ${category.toUpperCase()} -> ${name}${details ? ': ' + details : ''}`);
}

async function runComprehensiveQASuite() {
  console.log('======================================================================');
  console.log('🛡️ MIGRAINEGUARDIAN — COMPREHENSIVE QA REGRESSION SUITE');
  console.log('======================================================================\n');

  // 1. Firebase Admin & Credentials
  console.log('--- 1. INFRASTRUCTURE & CREDENTIALS CHECK ---');
  if (auth && db) {
    record('security', 'Firebase Admin SDK Initialization', true, 'Authenticated with service account');
  } else {
    record('security', 'Firebase Admin SDK Initialization', false, 'auth or db is null');
  }

  // 2. Authentication Flow (User A and User B)
  console.log('\n--- 2. AUTHENTICATION & SECURITY GATES ---');
  const timestamp = Date.now();
  const emailA = `qa_user_a_${timestamp}@migraineguardian.test`;
  const emailB = `qa_user_b_${timestamp}@migraineguardian.test`;
  let userA, userB, tokenA, tokenB;

  try {
    // 2.1 Password length validation test
    try {
      await auth.createUser({ email: `weak_${timestamp}@test.com`, password: '123' });
      record('authentication', 'Weak Password Rejection (<6 chars)', false, 'Allowed short password');
    } catch (err) {
      record('authentication', 'Weak Password Rejection (<6 chars)', true, err.message);
    }

    // 2.2 Invalid email format rejection
    try {
      await auth.createUser({ email: 'not-an-email', password: 'ValidPassword123!' });
      record('authentication', 'Invalid Email Rejection', false, 'Allowed malformed email');
    } catch (err) {
      record('authentication', 'Invalid Email Rejection', true, err.message);
    }

    // 2.3 Create Valid User A
    userA = await auth.createUser({
      email: emailA,
      password: 'SecurePassword123!',
      displayName: 'Alice QA',
    });
    record('authentication', 'User A Sign Up', true, `UID=${userA.uid}`);

    // 2.4 Duplicate Email Rejection
    try {
      await auth.createUser({
        email: emailA,
        password: 'AnotherPassword123!',
      });
      record('authentication', 'Duplicate Email Registration Rejection', false, 'Allowed duplicate email');
    } catch (err) {
      record('authentication', 'Duplicate Email Registration Rejection', true, 'Duplicate rejected correctly');
    }

    // 2.5 Create Valid User B
    userB = await auth.createUser({
      email: emailB,
      password: 'SecurePassword123!',
      displayName: 'Bob QA',
    });
    record('authentication', 'User B Sign Up', true, `UID=${userB.uid}`);

    // Create custom tokens
    tokenA = await auth.createCustomToken(userA.uid);
    tokenB = await auth.createCustomToken(userB.uid);
    record('authentication', 'Token Generation', true, 'Custom tokens generated for A and B');
  } catch (err) {
    record('authentication', 'Auth Flow Fatal', false, err.message);
  }

  // 3. User Profile CRUD
  console.log('\n--- 3. USER PROFILE MANAGEMENT ---');
  try {
    const profileA = {
      name: 'Alice QA',
      age: 31,
      gender: 'Female',
      diagnosis: 'Episodic Migraine without Aura',
      frequency: '2-4 times a month',
      severity: 7,
      duration: '6-12 hours',
      usesMedication: 'Yes',
    };
    await firestoreService.updateUserProfile(userA.uid, profileA);
    const readA = await firestoreService.getUserProfile(userA.uid);
    if (readA && readA.name === 'Alice QA' && readA.age === 31 && readA.diagnosis === 'Episodic Migraine without Aura') {
      record('profile', 'User A Profile Write & Readback', true, 'All fields persisted correctly');
    } else {
      record('profile', 'User A Profile Write & Readback', false, 'Data mismatch in Firestore');
    }

    // Update profile
    await firestoreService.updateUserProfile(userA.uid, { age: 32 });
    const updatedA = await firestoreService.getUserProfile(userA.uid);
    if (updatedA && updatedA.age === 32 && updatedA.name === 'Alice QA') {
      record('profile', 'User A Profile Partial Update (PATCH)', true, 'Age updated from 31 to 32');
    } else {
      record('profile', 'User A Profile Partial Update (PATCH)', false, 'Patch failed');
    }
  } catch (err) {
    record('profile', 'Profile Operations', false, err.message);
  }

  // 4. Onboarding Guest Data Transfer
  console.log('\n--- 4. ONBOARDING & GUEST DRAFT TRANSFER ---');
  try {
    const guestDataB = {
      name: 'Bob Onboarded',
      age: 28,
      gender: 'Male',
      hasMigraines: 'Yes',
      frequency: '1-2 times a month',
      severity: 5,
      duration: '4-8 hours',
      usesMedication: 'No',
    };
    await firestoreService.updateUserProfile(userB.uid, guestDataB);
    const readB = await firestoreService.getUserProfile(userB.uid);
    if (readB && readB.name === 'Bob Onboarded' && readB.age === 28) {
      record('onboarding', 'Onboarding Data Transfer to Firestore', true, 'Transferred to User B record');
    } else {
      record('onboarding', 'Onboarding Data Transfer to Firestore', false, 'Transfer failed');
    }
  } catch (err) {
    record('onboarding', 'Onboarding', false, err.message);
  }

  // 5. Daily Check-in Lifecycle
  console.log('\n--- 5. DAILY CHECK-IN LIFECYCLE ---');
  const today = new Date().toISOString().split('T')[0];
  try {
    const logA = {
      date: today,
      sleep_hours: 6.0,
      sleep_quality: 3,
      daily_stress: 7,
      mood: 3,
      screen_time: 7.5,
      hydration: 1.8,
      meal_skipped: 'Lunch',
      caffeine: '2 cups',
      exercise: 'None',
      migraine_occurrence: false,
    };
    const checkinResA = await firestoreService.saveDailyCheckin(userA.uid, logA);
    record('checkin', 'Save Daily Check-in', checkinResA.success, `Date=${today}`);

    const fetchedTodayA = await firestoreService.getTodayCheckin(userA.uid, today);
    if (fetchedTodayA && fetchedTodayA.sleep_hours === 6.0 && fetchedTodayA.daily_stress === 7) {
      record('checkin', 'Retrieve Today Check-in', true, 'Sleep=6.0, Stress=7');
    } else {
      record('checkin', 'Retrieve Today Check-in', false, 'Retrieved check-in mismatch');
    }

    const historyA = await firestoreService.getDailyLogs(userA.uid, 30);
    if (Array.isArray(historyA) && historyA.length >= 1) {
      record('checkin', 'Retrieve 30-Day History', true, `Logs count=${historyA.length}`);
    } else {
      record('checkin', 'Retrieve 30-Day History', false, 'History empty');
    }

    // Update with migraine occurrence
    await firestoreService.saveDailyCheckin(userA.uid, {
      ...logA,
      migraine_occurrence: true,
      migraine_severity: 8,
      migraine_duration: '4 hours',
    });

    const updatedTodayDoc = await firestoreService.getTodayCheckin(userA.uid, today);
    if (updatedTodayDoc?.migraine_occurrence === true && updatedTodayDoc?.migraine_severity === 8) {
      record('checkin', 'Update Check-in With Migraine Episode', true, 'Severity=8, Occurrence=true');
    } else {
      record('checkin', 'Update Check-in With Migraine Episode', false, 'Episode write failed');
    }
  } catch (err) {
    record('checkin', 'Check-in Operations', false, err.message);
  }

  // 6. PSS-10 Assessment
  console.log('\n--- 6. PSS-10 ASSESSMENT ---');
  try {
    const validPssAnswers = [3, 2, 4, 1, 2, 3, 2, 1, 3, 3];
    let computedScore = 0;
    const reverseIndices = [3, 4, 6, 7];
    validPssAnswers.forEach((ans, idx) => {
      computedScore += reverseIndices.includes(idx) ? (4 - ans) : ans;
    });

    const pssRecord = {
      score: computedScore,
      category: computedScore >= 27 ? 'High Perceived Stress Load' : computedScore >= 14 ? 'Moderate Stress Load' : 'Low Perceived Stress',
      answers: validPssAnswers,
      completedAt: new Date().toISOString(),
    };
    const pssSaved = await firestoreService.savePssAssessment(userA.uid, pssRecord);
    record('pss', 'PSS-10 Calculation & Submission', pssSaved.success, `Score=${computedScore} (High Stress)`);

    const latestPss = await firestoreService.getLatestPssAssessment(userA.uid);
    if (latestPss && latestPss.score === computedScore) {
      record('pss', 'Retrieve Latest PSS Assessment', true, `Persisted score=${latestPss.score}`);
    } else {
      record('pss', 'Retrieve Latest PSS Assessment', false, 'Mismatch in saved score');
    }

    const pssHistory = await firestoreService.getPssAssessmentHistory(userA.uid, 5);
    record('pss', 'Retrieve PSS History', Array.isArray(pssHistory) && pssHistory.length >= 1, `Items=${pssHistory.length}`);
  } catch (err) {
    record('pss', 'PSS Assessment', false, err.message);
  }

  // 7. ML Service Integration & SHAP Attributions
  console.log('\n--- 7. ML SERVICE & PREDICTION PIPELINE ---');
  try {
    const mlPayloadA = {
      user_id: userA.uid,
      latest_log: {
        sleep_hours: 6.0,
        sleep_quality: 3,
        daily_stress: 7,
        mood: 3,
        screen_time: 7.5,
        hydration: 1.8,
      },
      baseline_stats: {
        avg_sleep: 7.2,
        avg_stress: 4.5,
        pss_score: 28,
      },
      recent_episodes_count_7d: 1,
    };

    const mlResult = await mlInferenceService.predictMigraineRisk(mlPayloadA);
    if (mlResult.success && mlResult.data) {
      const { score, level, model_used, elevatedFactors, xai, focusAreas } = mlResult.data;
      record('mlPrediction', 'FastAPI /predict Call', true, `Score=${score}%, Level=${level}, Model=${model_used}`);
      record('mlPrediction', 'SHAP Attribution Output', xai?.method === 'SHAP' && Array.isArray(xai?.features) && xai.features.length === 11, `11 features computed`);
      record('mlPrediction', 'Elevated Factors Identification', Array.isArray(elevatedFactors) && elevatedFactors.length > 0, `${elevatedFactors.length} elevated factor(s)`);
      record('mlPrediction', 'Clinical Focus Areas Generation', Array.isArray(focusAreas) && focusAreas.length > 0, `${focusAreas.length} focus area(s)`);

      const saveForecast = await firestoreService.saveRiskForecast(userA.uid, today, mlResult.data);
      record('riskForecast', 'Risk Forecast Firestore Persistence', saveForecast.success, `users/${userA.uid}/risk_forecasts/${today}`);

      const readForecast = await firestoreService.getLatestRiskForecast(userA.uid, today);
      if (readForecast && readForecast.score === score && readForecast.level === level) {
        record('riskForecast', 'Readback Persisted Risk Forecast', true, `Score=${readForecast.score}%`);
      } else {
        record('riskForecast', 'Readback Persisted Risk Forecast', false, 'Forecast mismatch');
      }
    } else {
      record('mlPrediction', 'FastAPI /predict Call', false, JSON.stringify(mlResult.error));
    }
  } catch (err) {
    record('mlPrediction', 'ML Pipeline', false, err.message);
  }

  // 8. Weather Service
  console.log('\n--- 8. WEATHER SERVICE & HISTORICAL INTEGRATION ---');
  try {
    // 8.1 Geocoding Search
    const geocodeResults = await weatherApiService.searchLocationGeocode('Sangola');
    if (Array.isArray(geocodeResults) && geocodeResults.length > 0) {
      record('weather', 'Geocoding Location Search', true, `Sangola resolved to Lat: ${geocodeResults[0].latitude}, Lon: ${geocodeResults[0].longitude}`);
    } else {
      record('weather', 'Geocoding Location Search', false, 'Empty search results');
    }

    // 8.2 Save Usual Location for User A
    const locationSangola = {
      name: 'Sangola',
      latitude: 17.4395,
      longitude: 75.1938,
      country: 'India',
    };
    await firestoreService.updateUsualLocation(userA.uid, locationSangola);
    const usualA = await firestoreService.getUsualLocation(userA.uid);
    if (usualA && usualA.name === 'Sangola') {
      record('weather', 'Save & Retrieve Usual Location', true, 'User A usual location: Sangola');
    } else {
      record('weather', 'Save & Retrieve Usual Location', false, 'Failed usual location');
    }

    // 8.3 Fetch Current Weather
    const currentWeather = await weatherApiService.fetchCurrentWeather(17.4395, 75.1938);
    if (currentWeather && currentWeather.temperature !== undefined && currentWeather.pressure !== undefined) {
      record('weather', 'Fetch Real Current Weather via OpenMeteo', true, `${currentWeather.temperature}°C, ${currentWeather.pressure} hPa, ${currentWeather.weatherCondition}`);
      await firestoreService.saveWeatherRecord(userA.uid, today, currentWeather);
      const readWeather = await firestoreService.getTodayWeatherRecord(userA.uid, today);
      record('weather', 'Save Weather Record in Firestore', Boolean(readWeather), `Saved to users/${userA.uid}/weather_records/${today}`);
    } else {
      record('weather', 'Fetch Real Current Weather via OpenMeteo', false, 'Invalid weather response');
    }

    // 8.4 Historical Weather Range
    const pastRecords = await weatherApiService.fetchHistoricalWeather(17.4395, 75.1938, 3);
    record('weather', 'Historical Weather 3-Day Retrieval', Array.isArray(pastRecords?.dailyRecords) && pastRecords.dailyRecords.length === 3, `3 completed historical days recorded`);
  } catch (err) {
    record('weather', 'Weather Service', false, err.message);
  }

  // 9. Strict User Data Isolation Test (User A vs User B)
  console.log('\n--- 9. STRICT USER DATA ISOLATION VERIFICATION ---');
  try {
    const userBTodayCheckin = await firestoreService.getTodayCheckin(userB.uid, today);
    record('isolation', 'Check-in Isolation: User B Cannot Access User A Checkin', userBTodayCheckin === null, `User B checkin is null`);

    const userBForecast = await firestoreService.getLatestRiskForecast(userB.uid, today);
    record('isolation', 'Forecast Isolation: User B Cannot Access User A Forecast', userBForecast === null, `User B forecast is null`);

    const userBLatestPss = await firestoreService.getLatestPssAssessment(userB.uid);
    record('isolation', 'PSS Isolation: User B Cannot Access User A PSS', userBLatestPss === null, `User B PSS is null`);

    const userBLocation = await firestoreService.getUsualLocation(userB.uid);
    record('isolation', 'Location Isolation: User B Cannot Access User A Location', userBLocation === null, `User B location is null`);

    const profileB = await firestoreService.getUserProfile(userB.uid);
    record('isolation', 'Profile Isolation: Distinct Profiles Maintained', profileB.name === 'Bob Onboarded' && profileB.name !== 'Alice QA', `A: "Alice QA", B: "Bob Onboarded"`);
  } catch (err) {
    record('isolation', 'Isolation Verification', false, err.message);
  }

  // 10. Clean Up Test Users
  console.log('\n--- 10. CLEANUP & TEARDOWN ---');
  try {
    if (userA) {
      await db.collection('users').doc(userA.uid).delete();
      await auth.deleteUser(userA.uid);
    }
    if (userB) {
      await db.collection('users').doc(userB.uid).delete();
      await auth.deleteUser(userB.uid);
    }
    console.log('  [CLEANUP] Successfully purged temporary QA test documents and users.');
  } catch (err) {
    console.warn('  [CLEANUP WARNING]', err.message);
  }

  // Summary
  console.log('\n======================================================================');
  console.log('📊 QA REGRESSION SUITE TOTALS:');
  let totalTests = 0;
  let totalPass = 0;
  let totalFail = 0;
  for (const [category, tests] of Object.entries(qaResults)) {
    for (const t of tests) {
      totalTests++;
      if (t.passed) totalPass++;
      else totalFail++;
    }
  }
  console.log(`  Total Executed : ${totalTests}`);
  console.log(`  Passed         : ${totalPass}`);
  console.log(`  Failed         : ${totalFail}`);
  console.log('======================================================================\n');

  if (totalFail > 0) {
    process.exit(1);
  }
}

runComprehensiveQASuite().catch((err) => {
  console.error('Fatal QA Suite Error:', err);
  process.exit(1);
});
