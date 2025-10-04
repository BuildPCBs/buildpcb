import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const {
      query,
      category,
      limit = 50,
      similarityThreshold = 0.7,
    } = await request.json();

    if (!query?.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Generate embedding using OpenAI
    const queryEmbedding = await generateEmbedding(query);

    // Use RPC function for vector search
    const { data, error } = await supabase.rpc("vector_similarity_search", {
      query_embedding: queryEmbedding,
      match_threshold: similarityThreshold,
      match_count: limit,
    });

    if (error) {
      console.error("Vector search error:", error);
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    // If category filter is specified, filter results client-side
    let results = data || [];
    if (category) {
      results = results.filter(
        (component: any) => component.category === category
      );
    }

    // Get full component data for the results from components_index using uids
    if (results.length > 0) {
      const uids = results.map((r: any) => r.id); // r.id contains the uid from embeddings search
      const { data: fullComponents, error: fullError } = await supabase
        .from("components_index")
        .select("*")
        .in("uid", uids);

      if (fullError) {
        console.error("Component lookup error:", fullError);
        return NextResponse.json(
          { error: "Component lookup failed" },
          { status: 500 }
        );
      }

      if (fullComponents) {
        // Sort by similarity score
        const similarityMap = new Map(
          results.map((r: any) => [r.id, r.similarity as number])
        );
        const sortedComponents = fullComponents.sort((a, b) => {
          const aSimilarity = (similarityMap.get(a.uid) as number) || 0;
          const bSimilarity = (similarityMap.get(b.uid) as number) || 0;
          return bSimilarity - aSimilarity; // Sort descending (highest similarity first)
        });

        return NextResponse.json({ components: sortedComponents });
      }
    }

    return NextResponse.json({ components: [] });
  } catch (error) {
    console.error("Semantic search API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function generateEmbedding(text: string): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      model: "text-embedding-3-small",
      encoding_format: "float",
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const embedding = data.data[0].embedding;

  // Convert to PostgreSQL vector format
  return `[${embedding.join(",")}]`;
}
