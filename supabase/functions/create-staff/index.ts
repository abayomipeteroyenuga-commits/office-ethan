import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) throw new Error("You must be signed in.");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: caller, error: callerError } = await adminClient
      .from("profiles").select("role").eq("id", user.id).single();
    if (callerError || !caller) throw new Error("Caller profile not found.");
    if (!["super_admin","admin"].includes(caller.role)) throw new Error("Not authorized to create staff.");

    const body = await req.json();
    const { firstName, lastName, email, phone = "", role, password } = body;
    if (!firstName || !lastName || !email || !password) throw new Error("Missing required fields.");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
    if (!["admin","instructor"].includes(role)) throw new Error("Invalid staff role.");
    if (caller.role === "admin" && role !== "instructor") throw new Error("Admins can create instructors only.");

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName, phone, role },
    });
    if (createError) throw createError;
    const newUser = created.user;

    const { error: profileError } = await adminClient.from("profiles").update({
      first_name: firstName, last_name: lastName, email, phone, role,
    }).eq("id", newUser.id);
    if (profileError) throw profileError;

    // The public signup trigger intentionally defaults non-public roles to student.
    // Remove that temporary operational student record after secure staff creation.
    await adminClient.from("students").delete().eq("user_id", newUser.id);

    if (role === "instructor") {
      const instructorNo = `EDA-IN-${newUser.id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
      const { error: instructorError } = await adminClient.from("instructors").upsert({
        user_id: newUser.id, instructor_no: instructorNo, specialization: "To be assigned", status: "active",
      }, { onConflict: "user_id" });
      if (instructorError) throw instructorError;
    }

    return new Response(JSON.stringify({ ok: true, userId: newUser.id, role }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unable to create staff." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });
  }
});
