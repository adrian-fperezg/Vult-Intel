import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

async function test() {
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key");
    process.exit(1);
  }
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'Return a simple JSON object like {"status": "ok"}' }] }],
      config: { responseMimeType: 'application/json' }
    });
    
    console.log("Response text:", response.text);
    console.log("Usage Metadata:", response.usageMetadata);
    console.log("Full Object keys:", Object.keys(response));
    if (typeof response.text === 'function') {
      console.log("It's a function!");
    } else {
      console.log("Value:", response.text);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
