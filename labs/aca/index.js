const express = require('express');
const { AzureOpenAI } = require('openai');

// In production (Container Apps/AKS), these will be injected by the environment.
// For local development, you would use the 'dotenv' package.
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const DEPLOYMENT_NAME = process.env.DEPLOYMENT_NAME || "gpt-4o-mini"; // Name of your deployment in Foundry
const API_VERSION = "2024-02-15-preview"; // Required for Azure OpenAI
const PORT = process.env.PORT || 8080;

const app = express();
app.use(express.json());

// Initialize the Azure OpenAI Client using the modern official SDK
const client = new AzureOpenAI({
    endpoint: AZURE_OPENAI_ENDPOINT,
    apiKey: AZURE_OPENAI_API_KEY,
    apiVersion: API_VERSION,
    deployment: DEPLOYMENT_NAME
});

/**
 * POST /api/study
 * Body: { "question": "What is KEDA?" }
 */
app.post('/api/study', async (req, res) => {
    try {
        const userQuestion = req.body.question;

        if (!userQuestion) {
            return res.status(400).json({ error: "Please provide a 'question' in the JSON body." });
        }

        // --- PROMPT ENGINEERING (AI-103 Focus) ---
        // 1. The System Message: Defines the persona and strict rules.
        // 2. The User Message: The actual input.
        const messages = [
            { 
                role: "system", 
                content: "You are an expert Microsoft Azure architect and a tutor for the AI-200 exam. Provide concise, highly technical explanations. Format your responses using clear bullet points. Do not hallucinate features." 
            },
            { 
                role: "user", 
                content: userQuestion 
            }
        ];

        console.log(`Sending query to Azure OpenAI: ${userQuestion}`);

        // Call the Chat Completions API using the standard SDK syntax
        const response = await client.chat.completions.create({
            model: DEPLOYMENT_NAME,
            messages: messages,
            temperature: 0.2, // Low temperature for factual, deterministic exam answers
            max_tokens: 800   // Cap the response length to save costs
        });

        // Extract the AI's reply
        const aiReply = response.choices[0].message.content;

        res.json({
            status: "success",
            data: aiReply
        });

    } catch (error) {
        console.error("Error communicating with Azure OpenAI:", error);
        res.status(500).json({ 
            status: "error", 
            message: "Failed to generate AI response.",
            details: error.message 
        });
    }
});

// Basic health check endpoint for Azure Container Apps / AKS Readiness Probes
app.get('/health', (req, res) => {
    res.status(200).send("OK");
});

app.listen(PORT, () => {
    console.log(`AI-200 Study Buddy API is running on port ${PORT}`);
    console.log(`Targeting Azure OpenAI Endpoint: ${AZURE_OPENAI_ENDPOINT}`);
});