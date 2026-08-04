import * as admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./server/serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function getLiveToken() {
  try {
    const uid = 'test-railway-debug-' + Date.now();
    const customToken = await admin.auth().createCustomToken(uid);
    
    // We need the web API key
    const env = fs.readFileSync('.env', 'utf8');
    const match = env.match(/VITE_FIREBASE_API_KEY=(.+)/);
    const apiKey = match ? match[1].trim() : null;
    
    if (!apiKey) throw new Error("No API key found in .env");

    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });
    
    const data = await res.json() as any;
    const idToken = data.idToken;
    
    if (!idToken) throw new Error("Failed to get ID token");
    
    console.log("Got ID token, calling Railway backend...");
    const payload = {
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: "Act as a world-class SEO strategist. Perform keyword and competitor research for the seed keyword: \"dentist in miami\"." }] }],
      config: { responseMimeType: "application/json" }
    };
    
    const backendRes = await fetch("https://vult-intel-backend-production.up.railway.app/api/generate-content", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(payload)
    });
    
    console.log("Railway Status:", backendRes.status);
    console.log("Railway Content-Type:", backendRes.headers.get('content-type'));
    const text = await backendRes.text();
    console.log("Railway Response Body:", text.substring(0, 500));
    
  } catch (err) {
    console.error(err);
  }
}

getLiveToken();
