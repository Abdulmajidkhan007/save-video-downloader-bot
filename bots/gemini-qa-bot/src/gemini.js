'use strict';

const { GoogleGenAI } = require('@google/genai');
const config = require('./config');

// Bitta marta klient yaratamiz
const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

/**
 * Gemini'dan javob oladi.
 * @param {Array<{role: 'user'|'model', text: string}>} history
 *   Suhbat tarixi. Oxirgi element — joriy (yangi) savol bo'lishi kerak.
 * @returns {Promise<string>} model javobi (matn)
 */
async function askGemini(history) {
  // Bizning ichki formatni Gemini "contents" formatiga o'giramiz
  const contents = history.map((m) => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: String(m.text || '') }],
  }));

  const response = await ai.models.generateContent({
    model: config.geminiModel,
    contents,
    config: {
      systemInstruction: config.systemPrompt,
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
    },
  });

  const text = response && response.text;
  if (!text || !text.trim()) {
    // Javob bo'sh bo'lsa (masalan xavfsizlik filtri to'sib qo'ysa)
    return "Kechirasiz, bu savolga javob bera olmadim. Boshqacha qilib so'rab ko'ring.";
  }
  return text.trim();
}

module.exports = { askGemini, ai };
