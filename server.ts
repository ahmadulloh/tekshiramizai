import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import fetch from "node-fetch"; // Node v18+ supports fetch natively, but we can also use global fetch or node-fetch. Standard global fetch is supported in Node 18+. Let's just use the global fetch!

const app = express();
const PORT = 3000;

// Set up JSON parsing with size limits to support uploading base64-encoded PDF/Image documents.
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// Initialize Google Gemini API on the server side using the @google/genai package as specified in the guidelines.
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("GEMINI_API_KEY environment variable is not defined. Calls will fail unless configured.");
    }
    geminiClient = new GoogleGenAI({
      apiKey: key || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// REST route for parsing documents
app.post("/api/analyze-documents", async (req, res) => {
  try {
    const { images, preferredModel } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "No images provided for analysis." });
    }

    if (images.length > 4) {
      return res.status(400).json({ error: "A maximum of 4 document images can be analyzed at once." });
    }

    const promptText = "Analyze these deportation/immigration document images. Extract ONLY these fields in JSON format:\n" +
      "{\n" +
      "  \"name_cyrillic\": \"string (Exact name as written in Cyrillic, if present or guessably reconstructed, or empty string)\",\n" +
      "  \"name_latin\": \"string (Exact name as written in Latin)\",\n" +
      "  \"birth_date\": \"string (Date of birth, e.g. 28.07.1996 or DD.MM.YYYY)\",\n" +
      "  \"citizenship\": \"string (Citizenship, e.g. Uzbekistan, Tajikistan, Kyrgyzstan etc)\",\n" +
      "  \"decision_type\": \"string (Type of decision: Ban, deportation, control list, entry refusal etc)\",\n" +
      "  \"article\": \"string (The reason, law article, e.g. пп.2 ч.1 ст.27 ФЗ-114 или утеря патента)\",\n" +
      "  \"decision_date\": \"string (Date of the decision, e.g. 30.04.2021)\",\n" +
      "  \"ban_start\": \"string (Starting date of ban, e.g. 30.04.2021)\",\n" +
      "  \"ban_end\": \"string (When the ban expires / opens, e.g. 13.12.2024. If lifetime, output 'umrbod' or 'muddatsiz')\",\n" +
      "  \"department\": \"string (Initiator department or organ of migration, e.g. ОПВМ ОМВД ТИХВИН)\",\n" +
      "  \"status\": \"string (Current calculation: Active or Expired. E.g. Active if ban end date is in the future. Today's date is " + new Date().toISOString().split('T')[0] + ")\",\n" +
      "  \"record_code\": \"string (System or document record code if visible, e.g. DEC-2021-98 or empty string)\",\n" +
      "  \"has_deport\": true/false,\n" +
      "  \"summary_uz\": \"string (A clear, extremely simple, user-focused official-style summary of this status result written EXCLUSIVELY in Uzbek Cyrillic (Ўзбек кирилл алифбосида). Explain directly if they have a deportation/ban (депорт мавжуд) or clean (депорт йўқ), what article applies (қайси модда), and when it ends (қачон очилади). Keep it brief and authoritative. МУҲИМ ОРФОГРАФИК ҚОИДА: Ўзбек кирилл алифбосидаги махсус ҳарфларни (Қ, Ў, Ғ, Ҳ) ўз ўрнида тўғри ишлатиш мажбурийдир! Масалан: 'ТАҚИҚ' (тақиқлаш), 'ЙЎҚ' (йўқлиги), 'ҚАРОР', 'ҚАЧОН', 'ҚЎЙИЛГАН', 'ҚИЛИНГАН', 'ҲОЛАТ' кўринишида бўлиши керак.)\"\n" +
      "}\n" +
      "Verify the document's dates, names, and law articles extremely carefully to avoid mistakes.\n" +
      "Return ONLY valid, parsable JSON. No HTML markdown wrapping (no ```json code blocks), no greeting text.";

    let parsedResult = null;
    let modelUsedUsed = "";
    let systemNotes = [];

    const requestModel = preferredModel || "anthropic";

    // Standard base64 utility to prepare images
    const preparedImages = images.map((img: { base64: string; mimeType: string }) => {
      // Strip base64 prefix if exists
      const cleanBase64 = img.base64.includes(",") 
        ? img.base64.split(",")[1] 
        : img.base64;
      return {
        base64: cleanBase64,
        mimeType: img.mimeType || "image/jpeg"
      };
    });

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (requestModel === "anthropic" && anthropicApiKey) {
      try {
        console.log("Invoking Anthropic Claude API for document analysis...");
        
        // Prepare content message for Claude API
        const contentArray: any[] = preparedImages.map(img => ({
          type: "image",
          source: {
            type: "base64",
            media_type: img.mimeType,
            data: img.base64
          }
        }));

        contentArray.push({
          type: "text",
          text: promptText
        });

        const claudeResponse = await globalThis.fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": anthropicApiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022", // Sonnet 3.5 provides outstanding image capabilities & support
            max_tokens: 4000,
            messages: [
              {
                role: "user",
                content: contentArray
              }
            ]
          })
        });

        if (!claudeResponse.ok) {
          const rawError = await claudeResponse.text();
          throw new Error(`Anthropic Claude API responded with error status ${claudeResponse.status}: ${rawError}`);
        }

        const claudeData: any = await claudeResponse.json();
        const textResult = claudeData.content?.[0]?.text || "";
        
        // Extract JSON string
        const jsonMatch = textResult.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : textResult;
        parsedResult = JSON.parse(jsonString);
        modelUsedUsed = "Claude 3.5 Sonnet";
      } catch (claudeError: any) {
        console.error("error during Anthropic Claude analysis. Falling back to Gemini:", claudeError.message);
        systemNotes.push(`Anthropic API call failed (${claudeError.message}). Safely fell back to Google Gemini.`);
      }
    } else {
      if (requestModel === "anthropic") {
        systemNotes.push("Anthropic API Key (ANTHROPIC_API_KEY) is not defined in backend settings. Fell back to pre-configured Google Gemini.");
      }
    }

    // Fallback to Gemini if requestModel was gemini OR Anthropic step failed/was skipped
    if (!parsedResult) {
      try {
        console.log("Invoking Google Gemini API for document analysis...");
        const ai = getGeminiClient();

        const parts: any[] = preparedImages.map(img => ({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64
          }
        }));

        parts.push({
          text: promptText
        });

        const geminiResponse = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: { parts },
          config: {
            responseMimeType: "application/json",
          }
        });

        const textResult = geminiResponse.text || "";
        const jsonMatch = textResult.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : textResult;
        parsedResult = JSON.parse(jsonString);
        modelUsedUsed = "Gemini 3.5 Flash";
      } catch (geminiError: any) {
        throw new Error(`Fallback Google Gemini analysis failed: ${geminiError.message}`);
      }
    }

    res.json({
      success: true,
      data: parsedResult,
      modelUsed: modelUsedUsed,
      warnings: systemNotes
    });

  } catch (error: any) {
    console.error("Analysis route error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred during immigration document analysis."
    });
  }
});

// Configure Vite or Static Asset delivery
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting development backend in Vite middleware mode...");
    const viteInstance = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteInstance.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distFolder = path.join(process.cwd(), "dist");
    app.use(express.static(distFolder));
    // Serve index.html for undefined requests
    app.get("*", (req, res) => {
      res.sendFile(path.join(distFolder, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TEKSHIRAMIZ AI Server is actively running on port ${PORT}`);
  });
}

initServer().catch(err => {
  console.error("Critical server bootstrap failure:", err);
  process.exit(1);
});
