import { supabase } from "@/lib/supabase";

interface PromptLogData {
  prompt_text: string;
  user_email?: string;
  user_id?: string;
  prompt_type?:
    | "component_search"
    | "wiring"
    | "general"
    | "circuit_design"
    | "component_placement";
  response_success?: boolean;
  response_length?: number;
  session_id?: string;
  project_id?: string;
}

/**
 * Log a prompt to the analytics database
 * This should be called whenever a user interacts with the AI
 */
export async function logPrompt(data: PromptLogData) {
  try {
    const { error } = await supabase.from("prompts_analytics").insert([
      {
        prompt_text: data.prompt_text,
        user_email: data.user_email,
        user_id: data.user_id,
        prompt_type: data.prompt_type || "general",
        response_success: data.response_success !== false, // default to true
        response_length: data.response_length,
        session_id: data.session_id,
        project_id: data.project_id,
      },
    ]);

    if (error) {
      console.error("Failed to log prompt:", error);
      // Don't throw - we don't want logging failures to break the app
    }
  } catch (error) {
    console.error("Error logging prompt:", error);
    // Silent fail - logging shouldn't break functionality
  }
}

/**
 * Get current user's email for logging
 * This is a helper function to get the user's email from Supabase auth
 */
export async function getCurrentUserEmail(): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email || null;
  } catch (error) {
    console.error("Error getting user email:", error);
    return null;
  }
}

/**
 * Enhanced logging function that automatically gets user context
 */
export async function logPromptWithUserContext(
  prompt_text: string,
  prompt_type?: PromptLogData["prompt_type"],
  response_length?: number,
  session_id?: string,
  project_id?: string
) {
  const user_email = await getCurrentUserEmail();

  await logPrompt({
    prompt_text,
    user_email: user_email || undefined,
    prompt_type,
    response_length,
    session_id,
    project_id,
  });
}
