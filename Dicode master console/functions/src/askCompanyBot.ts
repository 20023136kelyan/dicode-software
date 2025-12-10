import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import OpenAI from 'openai';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

// Initialize OpenAI Client
// We prioritize process.env.OPENAI_API_KEY as requested by the user
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
});

interface CopilotRequest {
    question: string;
    context?: any;
}

// Mock Vector DB Query
async function queryVectorDB(vector: number[], topK: number = 5) {
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

export const askCompanyBot = onCall({ cors: true }, async (request) => {
    // 1. Auth Check
    if (!request.auth) {
        throw new HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.'
        );
    }

    const data = request.data as CopilotRequest;
    const userQuestion = data.question;

    if (!userQuestion) {
        throw new HttpsError(
            'invalid-argument',
            'The function must be called with a "question" argument.'
        );
    }

    try {
        // 2. Create Embedding
        let vector: number[] = [];

        if (openai.apiKey === 'mock-key') {
            console.log('Using mock embedding for demonstration');
            vector = new Array(1536).fill(0); // Mock vector
        } else {
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

        const systemPrompt = `You are the official company assistant for DiCode, called DI Copilot.
You answer using ONLY the provided company knowledge sources.
If the answer is not in the sources, say you don't know.
Keep answers professional, concise, and helpful.

## FORMATTING INSTRUCTIONS
You can use rich markdown formatting in your responses:
- Use **bold** and *italic* for emphasis
- Use bullet points and numbered lists for clarity
- Use \`inline code\` for technical terms
- Use code blocks with language specification for code examples
- Use tables when presenting comparative data
- Use > blockquotes for important callouts

## CHART VISUALIZATION
When presenting numerical data that would benefit from visualization, output a chart using this special format:

\`\`\`chart
{"type": "bar|line|pie|area", "data": [{"name": "Label", "value": 100}], "xKey": "name", "yKey": "value", "title": "Chart Title"}
\`\`\`

Chart types:
- "bar" - for comparing categories
- "line" - for trends over time
- "area" - for cumulative trends
- "pie" - for showing proportions (use sparingly)

Multiple data series: use yKey as an array: "yKey": ["value1", "value2"]

Example:
\`\`\`chart
{"type": "bar", "data": [{"department": "Marketing", "score": 85}, {"department": "Tech", "score": 72}, {"department": "HR", "score": 90}], "xKey": "department", "yKey": "score", "title": "Department Performance Scores"}
\`\`\`

Only use charts when data visualization adds value. For simple numbers, plain text is fine.`;

        const userPrompt = `CONTEXT:\n${contextText}\n\nQUESTION: ${userQuestion}`;

        // 5. Call Responses API (Chat Completions)
        if (openai.apiKey === 'mock-key') {
            // Return a demo response showcasing formatting capabilities
            const demoAnswer = `I'm currently running in **demo mode** without an OpenAI API key.

Here's what I can do when properly configured:

### Features
- Answer questions using your company's knowledge base
- Provide *contextual insights* from your data
- Generate visualizations for numerical data

### Sample Data Visualization

\`\`\`chart
{"type": "bar", "data": [{"department": "Marketing", "score": 85}, {"department": "Technology", "score": 72}, {"department": "HR", "score": 90}, {"department": "Operations", "score": 78}], "xKey": "department", "yKey": "score", "title": "Department Inclusion Scores"}
\`\`\`

### Next Steps
1. Add your OpenAI API key to enable real responses
2. Connect your vector database for company knowledge
3. Start asking questions!

> **Tip:** I retrieved ${relevantDocs.length} documents from the mock knowledge base to demonstrate the RAG pipeline.`;

            return {
                answer: demoAnswer,
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

    } catch (error: any) {
        console.error('Error in askCompanyBot:', error);
        throw new HttpsError(
            'internal',
            'An error occurred while processing your request.',
            error.message
        );
    }
});
