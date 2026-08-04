import express from 'express';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(express.json());

app.post('/test', async (req, res) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log("Calling Gemini...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: req.body.contents,
      config: req.body.config
    });
    
    console.log("Gemini returned. Extracting text...");
    let responseText = "";
    try {
      if (typeof (response as any).text === "function") {
        responseText = await (response as any).text();
      } else if (typeof (response as any).text === "string") {
        responseText = (response as any).text;
      } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
        responseText = response.candidates[0].content.parts[0].text;
      } else {
        responseText = JSON.stringify(response.candidates || response);
      }
    } catch (e) {
      console.error("Extraction error", e);
    }
    
    res.json({ text: responseText });
  } catch (err: any) {
    console.error("API error", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(9999, () => {
  console.log("Test server running on 9999");
});
