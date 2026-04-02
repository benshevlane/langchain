import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITES: Record<string, { label: string; domain: string }> = {
  kitchens: { label: "Kitchens Directory", domain: "kitchensdirectory.co.uk" },
  rooms: { label: "Free Room Planner", domain: "freeroomplanner.com" },
  costs: {
    label: "Kitchen Cost Estimator",
    domain: "kitchencostestimator.com",
  },
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  let body: { agent_id?: string; site?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { agent_id, site, action } = body;

  if (!agent_id || !site) {
    return new Response(
      JSON.stringify({ error: "agent_id and site are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!SITES[site]) {
    return new Response(
      JSON.stringify({
        error: `Invalid site. Must be one of: ${Object.keys(SITES).join(", ")}`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const siteConfig = SITES[site];

  // Insert a new agent run scoped to the site
  const { data: run, error: runError } = await supabase
    .from("agent_runs")
    .insert({
      agent_id,
      site,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (runError) {
    return new Response(JSON.stringify({ error: runError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Update last_run_at in site_agent_config
  await supabase
    .from("site_agent_config")
    .update({
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("site", site)
    .eq("agent_id", agent_id);

  // Use the site's domain for any content or SEO operations
  // Downstream agent logic should use siteConfig.domain for targeting
  return new Response(
    JSON.stringify({
      success: true,
      run_id: run.id,
      site,
      domain: siteConfig.domain,
      agent_id,
      action: action ?? "run",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
