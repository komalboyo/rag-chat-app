import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export async function POST(req: NextRequest) {
  try {
    // 1. Check if we should wipe the DB (Only do this for the first file)
    const shouldWipe = req.nextUrl.searchParams.get("wipe") === "true";
    
    const data = await req.formData();
    const file = data.get("file") as File;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file found" }, { status: 400 });
    }

    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const index = pinecone.Index(process.env.PINECONE_INDEX!);
    const NAMESPACE_NAME = "rag-chat-pdf-store"; 

    // 2. Wipe logic
    if (shouldWipe) {
        console.log(`[Ingest] Wiping namespace '${NAMESPACE_NAME}'...`);
        try {
            await index.namespace(NAMESPACE_NAME).deleteAll();
            console.log("[Ingest] Wipe complete.");
        } catch (e) {
            console.log("[Ingest] Wipe failed or empty:", e);
        }
    } else {
        console.log(`[Ingest] Appending '${file.name}' to existing index...`);
    }

    // 3. Process PDF
    const loader = new WebPDFLoader(file);
    const rawDocs = await loader.load();
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const docs = await splitter.splitDocuments(rawDocs);

    // 4. Upload
    await PineconeStore.fromDocuments(
      docs,
      new OpenAIEmbeddings({ model: "text-embedding-3-small" }),
      {
        pineconeIndex: index,
        namespace: NAMESPACE_NAME, 
      }
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Ingestion error:", e);
    return NextResponse.json({ success: false, error: "Failed to ingest PDF" }, { status: 500 });
  }
}