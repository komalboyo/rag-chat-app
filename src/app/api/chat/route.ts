import { OpenAI } from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Document } from "@langchain/core/documents";
import { OpenAIStream, StreamingTextResponse } from "ai"; // ✅ Classic V3 Imports

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastUserMessage = messages[messages.length - 1].content;

    console.log("1. Received message:", lastUserMessage);

    // 1. Connect to Pinecone
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const index = pinecone.Index(process.env.PINECONE_INDEX!);
    
    // 2. Retrieve Context
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({ model: "text-embedding-3-small" }),
      { pineconeIndex: index, namespace: "rag-chat-pdf-store" }
    );

    const results = (await vectorStore.similaritySearch(lastUserMessage, 3)) as Document[];
    console.log("2. Context found:", results.length, "docs");
    
    const contextText = results.map((doc) => doc.pageContent).join("\n\n");

    // 3. Generate Response (The Classic V3 Way)
    console.log("3. Sending to OpenAI...");
    const openai = new OpenAI(); // Uses process.env.OPENAI_API_KEY
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant. Use the following context to answer the user's question. If the answer is not in the context, say you don't know.\n\nContext:\n${contextText}`,
        },
        ...messages,
      ],
    });

    console.log("4. Stream started successfully");

    // ✅ This is the fix: Use OpenAIStream instead of streamText
    const stream = OpenAIStream(response as any);
    return new StreamingTextResponse(stream);

  } catch (error: any) {
    console.error("CRITICAL BACKEND ERROR:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}