// ETHAN ERP & LMS - Supabase integration layer
// The app automatically uses Supabase when valid project credentials are supplied in config.js.
// Without credentials, it remains in local preview mode.

window.ETHAN_BACKEND = (() => {
  const cfg = window.ETHAN_CONFIG || {};
  const ready = Boolean(cfg.supabaseUrl && cfg.supabasePublishableKey && window.supabase);
  const client = ready ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey) : null;

  async function signUp({email,password,firstName,lastName,phone,role,learnerType}) {
    if (!client) return { local: true };
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { first_name:firstName, last_name:lastName, phone, role, learner_type:learnerType||"student" } }
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email,password) {
    if (!client) return { local: true };
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  async function resetPassword(email) {
    if (!client) return { local:true };
    const redirectTo = window.location.origin + window.location.pathname;
    const { data, error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    return data;
  }

  async function getSession() {
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function getProfile(userId) {
    if (!client) return null;
    const { data, error } = await client.from("profiles").select("*").eq("id", userId).single();
    if (error) throw error;
    return data;
  }

  async function listStudents() {
    if (!client) return null;
    const { data, error } = await client.from("students").select("*, profiles(*)").order("created_at",{ascending:false});
    if (error) throw error;
    return data;
  }

  async function listCourses() {
    if (!client) return null;
    const { data, error } = await client.from("courses").select("*").order("created_at",{ascending:false});
    if (error) throw error;
    return data;
  }

  async function createCourse(payload) {
    if (!client) return null;
    const { data, error } = await client.from("courses").insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async function createStudent(payload) {
    if (!client) return null;
    const { data, error } = await client.from("students").insert(payload).select().single();
    if (error) throw error;
    return data;
  }


  async function getStudentByUserId(userId) {
    if (!client) return null;
    const { data, error } = await client.from("students").select("*").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function listStudentEnrolments(studentId) {
    if (!client) return [];
    const { data, error } = await client.from("enrolments").select("*, course:courses(*)").eq("student_id", studentId).eq("status","active").order("enrolled_at",{ascending:false});
    if (error) throw error;
    return data || [];
  }

  async function createEnrolment(payload) {
    if (!client) return null;
    const { data, error } = await client.from("enrolments").upsert(payload,{onConflict:"student_id,course_id"}).select().single();
    if (error) throw error;
    return data;
  }

  async function listMyPayments(studentId) {
    if (!client) return [];
    const { data, error } = await client.from("payments").select("*").eq("student_id",studentId).order("paid_at",{ascending:false});
    if (error) throw error;
    return data || [];
  }

  async function listPayments() {
    if (!client) return [];
    const { data, error } = await client.from("payments")
      .select("*, students(student_no, profiles(first_name,last_name,email))")
      .order("paid_at",{ascending:false});
    if (error) throw error;
    return data || [];
  }

  async function createPayment(payload) {
    if (!client) return null;
    const { data, error } = await client.from("payments").insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async function listAnnouncements() {
    if (!client) return [];
    const { data, error } = await client.from("announcements").select("*").order("created_at",{ascending:false});
    if (error) throw error;
    return data || [];
  }

  async function createAnnouncement(payload) {
    if (!client) return null;
    const { data, error } = await client.from("announcements").insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async function listMyNotifications() {
    if (!client) return [];
    const { data: authData } = await client.auth.getUser();
    const uid = authData?.user?.id;
    if (!uid) return [];
    const { data, error } = await client.from("notifications").select("*").eq("user_id",uid).order("created_at",{ascending:false});
    if (error) throw error;
    return data || [];
  }

  async function listStaff() {
    if (!client) return [];
    const { data, error } = await client.from("profiles").select("id,first_name,last_name,email,phone,role,created_at").in("role",["super_admin","admin","instructor"]).order("created_at",{ascending:false});
    if (error) throw error;
    return data || [];
  }

  async function createStaff(payload) {
    if (!client) throw new Error("Supabase is not connected.");
    const { data, error } = await client.functions.invoke("create-staff", { body: payload });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  return { ready, client, signUp, signIn, signOut, resetPassword, getSession, getProfile, listStudents, listCourses, createCourse, createStudent, getStudentByUserId, listStudentEnrolments, createEnrolment, listMyPayments, listPayments, createPayment, listAnnouncements, createAnnouncement, listMyNotifications, listStaff, createStaff };
})();