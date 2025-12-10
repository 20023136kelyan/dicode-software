"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.askCompanyBot = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const openai_1 = __importDefault(require("openai"));
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
// Initialize OpenAI Client
// We prioritize process.env.OPENAI_API_KEY as requested by the user
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
});
// Mock Vector DB Query
async function queryVectorDB(vector, topK = 5) {
    // In a real implementation, this would query Pinecone/Weaviate/etc.
    // For now, we return some hardcoded "company knowledge" to demonstrate RAG.
    const mockDocs = [
        {
            text: "Inclusion Performance: The Marketing department is performing well in terms of inclusion (blue shading), while Technology and Customer Service are underperforming (orange/brown).",
            score: 0.9
        },
        {
            text: "Collaboration: Most departments, including Marketing, Operations, and HR, are performing well in promoting collaboration.",
            score: 0.85
        },
        {
            text: "Healthy Norms: Technology and Customer Service show underperformance in 'Establishing Healthy Norms'. This points to culture challenges.",
            score: 0.82
        },
        {
            text: "Leadership Tips: Effective mentorship begins with active listening. Leaders should provide constructive feedback and celebrate achievements.",
            score: 0.80
        },
        {
            text: "Company Policy: We offer flexible work arrangements, such as hybrid models, to balance company goals with employee needs.",
            score: 0.78
        }
    ];
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockDocs;
}
exports.askCompanyBot = (0, https_1.onCall)(async (request) => {
    // 1. Auth Check
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const data = request.data;
    const userQuestion = data.question;
    if (!userQuestion) {
        throw new https_1.HttpsError('invalid-argument', 'The function must be called with a "question" argument.');
    }
    try {
        // 2. Create Embedding
        let vector = [];
        if (openai.apiKey === 'mock-key') {
            console.log('Using mock embedding for demonstration');
            vector = new Array(1536).fill(0); // Mock vector
        }
        else {
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: userQuestion,
            });
            vector = embeddingResponse.data[0].embedding;
        }
        // 3. Query Vector DB
        const relevantDocs = await queryVectorDB(vector);
        // 4. Build Prompt
        const contextText = relevantDocs.map((doc, index) => `Source ${index + 1}:\n${doc.text}`).join("\n\n---\n\n");
        const systemPrompt = `You are the official company assistant for DiCode.
You answer using ONLY the provided company knowledge sources.
If the answer is not in the sources, say you don't know.
Keep answers professional, concise, and helpful.`;
        const userPrompt = `CONTEXT:\n${contextText}\n\nQUESTION: ${userQuestion}`;
        // 5. Call Responses API (Chat Completions)
        if (openai.apiKey === 'mock-key') {
            return {
                answer: "I am currently running in mock mode because no OpenAI API key was provided. However, I successfully simulated the RAG flow! I retrieved 5 documents from the mock vector store. Once you add a valid key, I will generate real answers based on them.",
                sources: relevantDocs
            };
        }
        const completion = await openai.chat.completions.create({
            model: "gpt-5.1", // As requested
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.3, // Lower temperature for more grounded answers
        });
        const answer = completion.choices[0].message.content;
        return {
            answer,
            sources: relevantDocs
        };
    }
    catch (error) {
        console.error('Error in askCompanyBot:', error);
        throw new https_1.HttpsError('internal', 'An error occurred while processing your request.', error.message);
    }
});
//# sourceMappingURL=askCompanyBot.js.map