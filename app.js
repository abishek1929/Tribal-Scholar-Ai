
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const real = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY &&
  !SUPABASE_ANON_KEY.includes("YOUR_") &&
  !SUPABASE_ANON_KEY.includes("PASTE_"));

const db = real
  ? (await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"))
    .createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
);

const page = document.body.dataset.page || "login";
const BUCKET = "scholarship-documents";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const get = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem("ts_" + k)) ?? fallback; }
  catch { return fallback; }
};

const put = (k, v) => localStorage.setItem("ts_" + k, JSON.stringify(v));

const seed = [
  { id: 1, title: "Undergraduate Education Support", description: "Example undergraduate scholarship.", eligibility: "Undergraduate students", deadline: "2027-06-30", status: "open" },
  { id: 2, title: "Research Excellence Fellowship", description: "Example research scholarship.", eligibility: "Research students", deadline: "2027-08-20", status: "open" },
  { id: 3, title: "Higher Secondary Achievement Grant", description: "Example school scholarship.", eligibility: "School students", deadline: "2027-04-15", status: "open" }
];

if (!real && !localStorage.getItem("ts_scholarships")) {
  put("scholarships", seed);
}

let user = null;
let profile = null;
let scholarships = [];
let applications = [];
let announcements = [];

function toast(message) {
  const el = document.createElement("div");
  el.className = "alert";
  el.textContent = message;
  el.setAttribute("role", "status");
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

async function authUser() {
  if (real) {
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) return null;

    const { data: p } = await db.from("profiles")
      .select("*").eq("id", data.user.id).maybeSingle();

    profile = p || {
      full_name: data.user.user_metadata?.full_name || "Student",
      role: "student"
    };

    return { id: data.user.id, email: data.user.email };
  }

  const session = get("session", null);
  profile = session
    ? { full_name: session.name, role: session.role }
    : null;

  return session;
}

async function refresh() {
  if (real) {
    const [s, a, n] = await Promise.all([
      db.from("scholarships").select("*").order("created_at", { ascending: false }),
      db.from("applications").select("*,scholarships(title)").order("created_at", { ascending: false }),
      db.from("announcements").select("*").order("created_at", { ascending: false })
    ]);

    if (s.error) toast(s.error.message);
    if (a.error) toast(a.error.message);
    if (n.error) toast(n.error.message);

    scholarships = s.data || [];
    applications = a.data || [];
    announcements = n.data || [];
  } else {
    scholarships = get("scholarships", seed);
    applications = get("applications", []).filter(a =>
      profile.role === "admin" || a.student_id === user.id
    );
    announcements = get("announcements", []);
  }
}

function badge(status = "submitted") {
  const color = ["approved", "open"].includes(status) ? "green" :
    ["rejected", "closed"].includes(status) ? "red" : "yellow";

  return `<span class="tag ${color}">${esc(status.replaceAll("_", " "))}</span>`;
}

const studentMenu = [
  ["dashboard", "⌂", "Dashboard"],
  ["explore", "⌕", "Explore Scholarships"],
  ["eligibility", "✓", "Eligibility Checker"],
  ["apply", "✎", "Apply Now"],
  ["track", "◷", "Track Applications"],
  ["chat", "✦", "AI Assistant"]
];

const adminMenu = [
  ["admin", "▦", "Admin Overview"],
  ["manage", "▤", "Manage Scholarships"],
  ["review", "☷", "Review Applications"],
  ["announcements", "♧", "Announcements"]
];

function layout(title, content) {
  const menu = profile.role === "admin" ? adminMenu : studentMenu;

  $("#root").innerHTML = `
    <div class="app">
      <aside class="sidebar" id="sidebar">
        <div class="brand">
          <span class="brand-icon">✦</span>
          <div>TribalScholar<small>AI PLATFORM</small></div>
        </div>
        <nav class="nav">
          ${menu.map(([id, icon, name]) => `
            <a href="${id}.html" class="${page === id ? "active" : ""}">
              <span>${icon}</span> &nbsp; ${name}
            </a>
          `).join("")}
        </nav>
      </aside>

      <button id="nav-overlay" class="mobile-overlay"
        aria-label="Close menu" hidden></button>

      <main class="main">
        <header class="topbar">
          <div class="topbar-title">
            <button id="menu-toggle" class="btn alt small"
              type="button" aria-label="Open menu">☰</button>
            <h3>${esc(title)}</h3>
          </div>
          <div class="topright">
            <span class="pill">${profile.role.toUpperCase()}</span>
            <span class="avatar">${esc((profile.full_name || "U")[0].toUpperCase())}</span>
            <button id="logout" class="btn alt small">Logout</button>
          </div>
        </header>
        <div class="content page-enter">${content}</div>
      </main>
    </div>
  `;

  const sidebar = $("#sidebar");
  const overlay = $("#nav-overlay");

  function closeMenu() {
    sidebar.classList.remove("sidebar-open");
    overlay.hidden = true;
  }

  $("#menu-toggle").onclick = () => {
    sidebar.classList.toggle("sidebar-open");
    overlay.hidden = !sidebar.classList.contains("sidebar-open");
  };

  overlay.onclick = closeMenu;

  $("#logout").onclick = async () => {
    if (real) await db.auth.signOut();
    else localStorage.removeItem("ts_session");
    location.href = "login.html";
  };
}

function authView() {
  const register = page === "register";

  $("#root").innerHTML = `
    <div class="auth">
      <section class="auth-left">
        <div class="brand"><span class="brand-icon">✦</span> TribalScholar AI</div>
        <div style="margin-top:60px">
          <span class="eyebrow">EDUCATION · OPPORTUNITY · IMPACT</span>
          <h1>Every opportunity.<br>One place.</h1>
          <p>Discover scholarships, check eligibility, apply and track your journey.</p>
          <div class="btns">
            <span class="tag green">Scholarship Discovery</span>
            <span class="tag green">Application Tracking</span>
          </div>
        </div>
      </section>

      <section class="auth-right">
        <form id="authform" class="authbox">
          <span class="eyebrow">WELCOME TO TRIBALSCHOLAR</span>
          <h2>${register ? "Create your account" : "Welcome back"}</h2>
          <p class="lead">${register ? "Start your scholarship journey." : "Sign in to your account."}</p>

          ${register ? `<label class="field">Full Name
            <input name="name" autocomplete="name" required>
          </label>` : ""}

          <label class="field">Email Address
            <input type="email" name="email" autocomplete="email" required>
          </label>

          
<label class="field">Password
  <div style="position:relative;width:100%">
    <input
      type="password"
      name="password"
      id="auth-password"
      minlength="6"
      required
      style="width:100%;padding-right:55px"
    >

    <button
      type="button"
      id="toggle-password"
      aria-label="Show password"
      style="
        position:absolute;
        right:12px;
        top:50%;
        transform:translateY(-50%);
        background:transparent;
        border:none;
        color:#10b981;
        font-size:22px;
        cursor:pointer;
        z-index:10;
        padding:5px;
      "
    >👁</button>
  </div>
</label>


          <button class="btn" type="submit">
            ${register ? "Create Account →" : "Sign In →"}
          </button>

          <p class="muted">
            ${register
      ? 'Already registered? <a href="login.html">Sign in</a>'
      : 'New here? <a href="register.html">Create account</a>'}
          </p>
        </form>
      </section>
    </div>
  `;


  const passwordInput = $("#auth-password");
  const togglePassword = $("#toggle-password");

  function togg() {

    const visible = passwordInput.type === "password";

    passwordInput.type = visible ? "text" : "password";
    togglePassword.textContent = visible ? "🙈" : "👁";
    togglePassword.setAttribute("aria-label", visible ? "Hide password" : "Show password");
  }

  togglePassword.addEventListener("click", togg);

  $("#authform").onsubmit = async e => {
    e.preventDefault();

    const f = new FormData(e.target);
    const email = String(f.get("email")).trim().toLowerCase();
    const password = String(f.get("password"));
    const name = String(f.get("name") || "Student").trim();
    const button = e.target.querySelector('button[type="submit"]');

    button.disabled = true;

    try {
      if (real) {
        if (register) {
          const { data, error } = await db.auth.signUp({
            email, password,
            options: { data: { full_name: name } }
          });
          if (error) throw error;
          if (!data.session) {
            toast("Account created. Check your email.");
            return;
          }
        } else {
          const { error } = await db.auth.signInWithPassword({ email, password });
          if (error) throw error;
        }

        await authUser();
        location.href = profile?.role === "admin" ? "admin.html" : "dashboard.html";
      } else {
        const users = get("users", []);

        if (register) {
          if (users.some(u => u.email === email)) throw Error("Email already registered");
          users.push({ id: crypto.randomUUID(), email, password, name, role: "student" });
          put("users", users);
        }

        const account = email === "admin@demo.com" && password === "admin123"
          ? { id: "demo-admin", email, name: "Admin", role: "admin" }
          : users.find(u => u.email === email && u.password === password);

        if (!account) throw Error("Invalid email or password");

        put("session", {
          id: account.id, email: account.email,
          name: account.name, role: account.role
        });

        location.href = account.role === "admin" ? "admin.html" : "dashboard.html";
      }
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  };
}

function scholarshipTitle(a) {
  return a.scholarships?.title ||
    scholarships.find(s => String(s.id) === String(a.scholarship_id))?.title ||
    "Scholarship";
}

function scholarshipCard(s) {
  return `
    <article class="card interactive-card">
      <div class="meta">${badge(s.status)}
        <span class="tag">${esc(s.eligibility)}</span>
      </div>
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.description)}</p>
      <div class="card-footer">
        <span class="muted">📅 ${esc(s.deadline || "No deadline")}</span>
        <a class="btn small" href="apply.html?id=${encodeURIComponent(s.id)}"
          ${s.status !== "open" ? 'style="pointer-events:none;opacity:.5"' : ""}>
          Apply Now →
        </a>
      </div>
    </article>
  `;
}

function stats(items) {
  return `<div class="stats">${items.map(([name, value, detail]) => `
    <div class="stat interactive-card">
      <span>${esc(name)}</span>
      <strong>${value}</strong>
      <em>${esc(detail || "")}</em>
    </div>
  `).join("")}</div>`;
}

function dashboard() {
  layout("Student Dashboard", `
    <div class="hero">
      <span class="eyebrow">YOUR SCHOLARSHIP JOURNEY</span>
      <h1>Welcome back, ${esc((profile.full_name || "Student").split(" ")[0])}! 👋</h1>
      <p>Discover opportunities and track your scholarship applications.</p>
      <div class="btns">
        <a href="explore.html" class="btn">Explore Scholarships →</a>
        <a href="track.html" class="btn alt">My Applications</a>
      </div>
    </div>

    ${stats([
    ["Available Scholarships", scholarships.filter(s => s.status === "open").length, "Open for applications"],
    ["My Applications", applications.length, "Total submitted"],
    ["Approved", applications.filter(a => a.status === "approved").length, "Successful applications"],
    ["Under Review", applications.filter(a => a.status === "under_review").length, "Awaiting decision"]
  ])}

    <div class="section-head">
      <h2>Featured Scholarships</h2>
      <a href="explore.html" class="btn alt small">View All →</a>
    </div>

    <div class="grid">
      ${scholarships.filter(s => s.status === "open")
      .slice(0, 3).map(scholarshipCard).join("") ||
    '<div class="empty">No open scholarships.</div>'}
    </div>

    <div class="section-head"><h2>Latest Announcements</h2></div>
    <div class="panel">
      ${announcements.slice(0, 3).map(n => `
        <p><strong>${esc(n.title)}</strong><br>
        <span class="muted">${esc(n.body)}</span></p>
      `).join("") || '<p class="muted">No announcements yet.</p>'}
    </div>
  `);
}

function explore() {
  layout("Explore Scholarships", `
    <span class="eyebrow">FIND YOUR OPPORTUNITY</span>
    <h1>Scholarship Explorer</h1>
    <p class="lead">Search and explore available opportunities.</p>

    <div class="filterbar">
      <input id="q" class="search" placeholder="Search scholarships...">
      <select id="category" class="search">
        <option value="">All Categories</option>
        <option value="undergraduate">Undergraduate</option>
        <option value="research">Research</option>
        <option value="school">School</option>
      </select>
      <select id="open" class="search">
        <option value="">All Statuses</option>
        <option value="open">Open</option>
        <option value="closed">Closed</option>
      </select>
    </div>

    <p id="count" class="muted"></p>
    <div id="results" class="grid"></div>
  `);

  function draw() {
    const q = $("#q").value.toLowerCase();
    const category = $("#category").value;
    const status = $("#open").value;

    const list = scholarships.filter(s =>
      `${s.title} ${s.description} ${s.eligibility}`.toLowerCase().includes(q) &&
      (!category || (s.eligibility || "").toLowerCase().includes(category)) &&
      (!status || s.status === status)
    );

    $("#count").textContent = `Showing ${list.length} scholarships`;
    $("#results").innerHTML = list.map(scholarshipCard).join("") ||
      '<div class="empty">No matching scholarships.</div>';
  }

  ["q", "category", "open"].forEach(id => $("#" + id).addEventListener("input", draw));
  draw();
}

function eligibility() {
  layout("Eligibility Checker", `
    <span class="eyebrow">SMART MATCHING</span>
    <h1>Check Your Eligibility</h1>
    <p class="lead">Discover potential matches based on your education level.</p>

    <div class="split">
      <form id="eligform" class="panel form-stack">
        <h2>Academic Details</h2>

        <label class="field">Education Level
          <select name="level" required>
            <option value="">Select level</option>
            <option value="school">School</option>
            <option value="undergraduate">Undergraduate</option>
            <option value="research">Research / Postgraduate</option>
          </select>
        </label>

        <label class="field">Annual Family Income (₹)
          <input type="number" name="income" min="0" required>
        </label>

        <label class="field">Academic Score (%)
          <input type="number" name="score" min="0" max="100" required>
        </label>

        <button class="btn">Find My Matches →</button>
      </form>

      <div class="panel">
        <h2>Matching Results</h2>
        <div id="matches" class="muted">Complete the form to see matches.</div>
      </div>
    </div>
  `);

  $("#eligform").onsubmit = e => {
    e.preventDefault();
    const level = new FormData(e.target).get("level");

    const matches = scholarships.filter(s =>
      s.status === "open" &&
      (s.eligibility || "").toLowerCase().includes(level)
    );

    $("#matches").innerHTML = `
      <p class="muted">${matches.length} potential matches based on education level.
      Income and score have not been verified against official criteria.</p>
      ${matches.map(s => `
        <div class="panel" style="margin:12px 0">
          <strong>${esc(s.title)}</strong>
          <p>${esc(s.eligibility)}</p>
          <a href="apply.html?id=${encodeURIComponent(s.id)}" class="btn small">Apply →</a>
        </div>
      `).join("") || "<p>No matching scholarships found.</p>"}
    `;
  };
}

function validateFile(file) {
  if (!file) return;
  if (file.size > MAX_FILE_SIZE) throw Error("Maximum file size is 5 MB.");
  if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
    throw Error("Only PDF, JPG and PNG files are allowed.");
  }
}

async function uploadDocument(file, applicationId, type) {
  if (!file || !real) return null;

  validateFile(file);

  const extension = file.type === "application/pdf" ? "pdf" :
    file.type === "image/png" ? "png" : "jpg";

  const path = `${user.id}/${applicationId}/${type}.${extension}`;

  const { error } = await db.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false
  });

  if (error) throw error;
  return path;
}

function apply() {
  const selectedId = new URLSearchParams(location.search).get("id");
  const options = scholarships.filter(s =>
    s.status === "open" &&
    (!s.deadline || s.deadline >= new Date().toISOString().slice(0, 10))
  );

  layout("Apply for Scholarship", `
    <span class="eyebrow">SCHOLARSHIP APPLICATION</span>
    <h1>Apply for Scholarship</h1>
    <p class="lead">Complete the four steps to submit your application.</p>

    <div class="panel application-wizard">
      <div class="wizard-progress">
        <div class="wizard-step active" data-progress="0">1. Personal</div>
        <div class="wizard-step" data-progress="1">2. Academic</div>
        <div class="wizard-step" data-progress="2">3. Documents</div>
        <div class="wizard-step" data-progress="3">4. Review</div>
      </div>

      <form id="applyform" class="form-stack">
        <section class="form-step" data-step="0">
          <h2>Personal Information</h2>

          <label class="field">Full Name
            <input name="full_name" value="${esc(profile.full_name || "")}" required>
          </label>

          <label class="field">Date of Birth
            <input type="date" name="date_of_birth" required>
          </label>

          <label class="field">Email Address
            <input type="email" name="email" value="${esc(user.email || "")}" required>
          </label>

          <label class="field">Mobile Number
            <input type="tel" name="mobile" pattern="[0-9]{10}"
              maxlength="10" placeholder="10-digit mobile number" required>
          </label>
        </section>

        <section class="form-step" data-step="1" hidden>
          <h2>Academic Information</h2>

          <label class="field">College / Institution
            <input name="institution" required>
          </label>

          <label class="field">Course / Programme
            <input name="course" placeholder="e.g. B.Tech CSE" required>
          </label>

          <label class="field">Year of Study
            <select name="study_year" required>
              <option value="">Select year</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
              <option value="5">5th Year</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label class="field">Annual Family Income (₹)
            <input type="number" name="family_income" min="0" required>
          </label>

          <label class="field">Choose Scholarship
            <select name="scholarship" required>
              <option value="">Select scholarship</option>
              ${options.map(s => `
                <option value="${esc(s.id)}"
                  ${String(s.id) === selectedId ? "selected" : ""}>
                  ${esc(s.title)}
                </option>
              `).join("")}
            </select>
          </label>

          <label class="field">Statement of Purpose
            <textarea name="statement" rows="5" minlength="20"
              placeholder="Explain why you are applying..." required></textarea>
          </label>
        </section>

        <section class="form-step" data-step="2" hidden>
          <h2>Upload Documents</h2>
          <p class="muted">Maximum 2 documents. PDF, JPG or PNG, up to 5 MB each.</p>

          <label class="field">
            Community Certificate (Required)
            <input type="file" name="community_document"
              accept=".pdf,.jpg,.jpeg,.png" required>
          </label>
          <p id="community-file" class="muted"></p>

          <label class="field">
            Income Certificate / Marksheet (Optional)
            <input type="file" name="additional_document"
              accept=".pdf,.jpg,.jpeg,.png">
          </label>
          <p id="additional-file" class="muted"></p>
        </section>

        <section class="form-step" data-step="3" hidden>
          <h2>Review Your Application</h2>
          <p class="muted">Check all details before submitting.</p>
          <div id="application-review" class="panel"></div>
          <label class="field">
            <span>
              <input type="checkbox" name="confirm" required>
              I confirm that the submitted details are correct.
            </span>
          </label>
        </section>

        <div class="btns wizard-actions">
          <button type="button" class="btn alt" id="previous-step" hidden>← Back</button>
          <button type="button" class="btn" id="next-step">Continue →</button>
          <button type="submit" class="btn" id="submit-application" hidden>
            Submit Application →
          </button>
        </div>
        <p id="upload-status" class="muted" role="status"></p>
      </form>
    </div>
  `);

  const form = $("#applyform");
  const steps = [...document.querySelectorAll(".form-step")];
  const progress = [...document.querySelectorAll(".wizard-step")];
  let current = 0;

  function showStep(index) {
    current = index;

    steps.forEach((step, i) => {
      step.hidden = i !== current;
      step.classList.toggle("active", i === current);
    });

    progress.forEach((step, i) => {
      step.classList.toggle("active", i === current);
      step.classList.toggle("completed", i < current);
    });

    $("#previous-step").hidden = current === 0;
    $("#next-step").hidden = current === 3;
    $("#submit-application").hidden = current !== 3;

    if (current === 3) reviewDetails();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function checkStep() {
    const inputs = [...steps[current].querySelectorAll("input, select, textarea")];

    for (const input of inputs) {
      if (!input.checkValidity()) {
        input.reportValidity();
        return false;
      }

      if (input.type === "file") {
        try { validateFile(input.files[0]); }
        catch (error) { toast(error.message); return false; }
      }
    }

    return true;
  }

  function reviewDetails() {
    const f = new FormData(form);
    const scholarship = scholarships.find(s =>
      String(s.id) === String(f.get("scholarship"))
    );

    const fields = [
      ["Full Name", f.get("full_name")],
      ["Date of Birth", f.get("date_of_birth")],
      ["Email", f.get("email")],
      ["Mobile", f.get("mobile")],
      ["Institution", f.get("institution")],
      ["Course", f.get("course")],
      ["Year", f.get("study_year")],
      ["Annual Income", "₹" + f.get("family_income")],
      ["Scholarship", scholarship?.title || "-"],
      ["Statement", f.get("statement")],
      ["Community Certificate", form.elements.community_document.files[0]?.name],
      ["Additional Document", form.elements.additional_document.files[0]?.name || "Not uploaded"]
    ];

    $("#application-review").innerHTML = fields.map(([label, value]) => `
      <p><strong>${esc(label)}:</strong> ${esc(value)}</p>
    `).join("");
  }

  $("#next-step").onclick = () => {
    if (!checkStep()) return;
    if (current < 3) showStep(current + 1);
  };

  $("#previous-step").onclick = () => {
    if (current > 0) showStep(current - 1);
  };

  for (const [name, target] of [
    ["community_document", "community-file"],
    ["additional_document", "additional-file"]
  ]) {
    form.elements[name].addEventListener("change", e => {
      const file = e.target.files[0];
      try {
        validateFile(file);
        $("#" + target).textContent = file ? "✓ " + file.name : "";
      } catch (error) {
        e.target.value = "";
        $("#" + target).textContent = "";
        toast(error.message);
      }
    });
  }

  form.onsubmit = async e => {
    e.preventDefault();
    if (!checkStep()) return;

    const f = new FormData(form);
    const id = f.get("scholarship");
    const scholarship = options.find(s => String(s.id) === String(id));

    if (!scholarship) return toast("Scholarship unavailable.");

    const community = form.elements.community_document.files[0];
    const additional = form.elements.additional_document.files[0];

    if (!community) return toast("Community certificate is required.");

    try {
      validateFile(community);
      validateFile(additional);
    } catch (error) {
      return toast(error.message);
    }

    const button = $("#submit-application");
    button.disabled = true;
    button.textContent = "Submitting...";

    const payload = {
      student_id: user.id,
      scholarship_id: scholarship.id,
      full_name: String(f.get("full_name")).trim(),
      date_of_birth: f.get("date_of_birth"),
      email: String(f.get("email")).trim(),
      mobile: String(f.get("mobile")).trim(),
      institution: String(f.get("institution")).trim(),
      course: String(f.get("course")).trim(),
      study_year: f.get("study_year"),
      family_income: Number(f.get("family_income")),
      statement: String(f.get("statement")).trim()
    };

    try {
      if (applications.some(a =>
        String(a.scholarship_id) === String(id) &&
        a.student_id === user.id
      )) throw Error("You have already applied for this scholarship.");

      if (real) {
        $("#upload-status").textContent = "Saving application...";

        const { data, error } = await db.from("applications")
          .insert(payload).select("id").single();

        if (error) throw error;

        const uploaded = [];

        try {
          $("#upload-status").textContent = "Uploading community certificate...";
          const communityPath = await uploadDocument(community, data.id, "community");
          uploaded.push(communityPath);

          let additionalPath = null;

          if (additional) {
            $("#upload-status").textContent = "Uploading additional document...";
            additionalPath = await uploadDocument(additional, data.id, "additional");
            uploaded.push(additionalPath);
          }

          const { error: updateError } = await db.from("applications")
            .update({
              community_document_path: communityPath,
              additional_document_path: additionalPath
            }).eq("id", data.id);

          if (updateError) throw updateError;
        } catch (uploadError) {
          $("#upload-status").textContent = "Upload failed. Cleaning up...";

          if (uploaded.length) {
            await db.storage.from(BUCKET).remove(uploaded);
          }

          const { error: deleteError } = await db.from("applications")
            .delete().eq("id", data.id);

          if (deleteError) {
            throw Error(uploadError.message +
              " Application record may still exist. Contact the administrator.");
          }

          throw uploadError;
        }
      } else {
        const all = get("applications", []);

        all.push({
          id: Date.now(),
          ...payload,
          community_document_path: null,
          additional_document_path: null,
          community_document_name: community.name,
          additional_document_name: additional?.name || null,
          status: "submitted",
          admin_note: "",
          created_at: new Date().toISOString()
        });

        put("applications", all);
      }

      toast("Application submitted successfully!");
      setTimeout(() => location.href = "track.html", 900);
    } catch (error) {
      toast(error.message);
      $("#upload-status").textContent = error.message;
      button.disabled = false;
      button.textContent = "Submit Application →";
    }
  };

  showStep(0);
}

function track() {
  layout("Track Applications", `
    <span class="eyebrow">APPLICATION HISTORY</span>
    <h1>My Applications</h1>
    <p class="lead">Track your scholarship application status.</p>

    <div class="tablewrap">
      <table>
        <thead><tr>
          <th>Scholarship</th>
          <th>Applied On</th>
          <th>Status</th>
          <th>Admin Feedback</th>
        </tr></thead>
        <tbody>
          ${applications.map(a => `
            <tr>
              <td>${esc(scholarshipTitle(a))}</td>
              <td>${esc(new Date(a.created_at).toLocaleDateString())}</td>
              <td>${badge(a.status)}</td>
              <td>${esc(a.admin_note || "No feedback yet")}</td>
            </tr>
          `).join("") || '<tr><td colspan="4">No applications yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  `);
}

const aiCache = new Map();

function instantAnswer(q) {
  const text = q.toLowerCase().trim();

  if (/^(hi|hello|hey|vanakkam)[!.\s]*$/.test(text))
    return "Vanakkam! 👋 I'm TribalScholar AI. How can I help you?";

  if (/^(thanks|thank you|nandri)[!.\s]*$/.test(text))
    return "You're welcome! All the best for your studies!";

  if (text.includes("track") && text.includes("application"))
    return "Open Track Applications to see your application status and admin feedback.";

  if (text.includes("how") && text.includes("apply"))
    return "Open Explore Scholarships, select a scholarship, complete your personal and academic details, upload up to two documents, review and submit.";

  return null;
}

async function callGemini(question) {
  if (!db) throw Error("AI service is unavailable in demo mode.");

  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error("AI response timeout.")), 55000);
  });

  try {
    const { data, error } = await Promise.race([
      db.functions.invoke("quick-action", { body: { message: question } }),
      timeout
    ]);

    if (error) throw error;
    if (!data?.reply) throw Error("AI returned an empty response.");

    return data.reply;
  } finally {
    clearTimeout(timer);
  }
}

function chat() {
  layout("Scholarship Assistant", `
    <span class="eyebrow">YOUR SCHOLARSHIP COMPANION</span>
    <h1>✦ TribalScholar AI Assistant</h1>
    <p class="lead">Ask questions in English, Tamil or Tanglish.</p>

    <div class="panel">
      <div class="chatlog" id="chatlog">
        <div class="bubble">
          Vanakkam! 👋 I'm TribalScholar AI.
          How can I help with your scholarship journey?
        </div>
      </div>

      <div class="btns" style="margin:12px 0">
        <button class="btn alt small" data-question="What scholarships are available for ST students?">Scholarships</button>
        <button class="btn alt small" data-question="How can I check eligibility?">Eligibility</button>
        <button class="btn alt small" data-question="What documents are needed?">Documents</button>
        <button class="btn alt small" data-question="How can I track my application?">Tracking</button>
      </div>

      <form id="chatform" class="chatentry">
        <input id="message" class="search"
          placeholder="Ask TribalScholar AI..." maxlength="2000" required>
        <button class="btn" id="sendbtn">Send →</button>
      </form>

      <p class="muted" id="ai-status">✦ TribalScholar AI</p>
    </div>
  `);

  const log = $("#chatlog");
  const input = $("#message");
  const send = $("#sendbtn");

  function bubble(text, mine = false) {
    const el = document.createElement("div");
    el.className = mine ? "bubble mine" : "bubble";
    el.textContent = text;
    el.style.whiteSpace = "pre-wrap";
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  async function sendMessage(question) {
    question = String(question || "").trim();
    if (!question || send.disabled) return;

    bubble(question, true);
    input.value = "";
    send.disabled = true;
    send.textContent = "Thinking...";

    const response = bubble("✦ Thinking...");

    try {
      const key = question.toLowerCase().replace(/\s+/g, " ").trim();
      let answer = instantAnswer(question);

      if (!answer) {
        answer = aiCache.get(key);

        if (!answer) {
          answer = await callGemini(question);
          if (aiCache.size >= 30) aiCache.delete(aiCache.keys().next().value);
          aiCache.set(key, answer);
        }
      }

      response.textContent = answer;
    } catch (error) {
      response.textContent = "Sorry, I couldn't get an answer.\n\n" + error.message;
    } finally {
      send.disabled = false;
      send.textContent = "Send →";
      log.scrollTop = log.scrollHeight;
    }
  }

  $("#chatform").onsubmit = e => {
    e.preventDefault();
    sendMessage(input.value);
  };

  document.querySelectorAll("[data-question]").forEach(button => {
    button.onclick = () => sendMessage(button.dataset.question);
  });
}

function admin() {
  layout("Admin Overview", `
    <div class="hero">
      <span class="eyebrow">ADMIN CONTROL CENTER</span>
      <h1>Scholarship Management</h1>
      <p>Manage scholarships, review applications and publish announcements.</p>
      <div class="btns">
        <a href="manage.html" class="btn">Manage Scholarships →</a>
        <a href="review.html" class="btn alt">Review Applications</a>
      </div>
    </div>

    ${stats([
    ["Total Scholarships", scholarships.length, "All scholarships"],
    ["Open Scholarships", scholarships.filter(s => s.status === "open").length, "Currently open"],
    ["Applications", applications.length, "Total applications"],
    ["Pending Review", applications.filter(a => ["submitted", "under_review"].includes(a.status)).length, "Awaiting review"]
  ])}

    <div class="section-head">
      <h2>Recent Applications</h2>
      <a href="review.html" class="btn alt small">Review All →</a>
    </div>

    <div class="tablewrap">
      <table>
        <thead><tr><th>Applicant</th><th>Scholarship</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>
          ${applications.slice(0, 6).map(a => `
            <tr>
              <td>${esc(a.full_name || "Student")}</td>
              <td>${esc(scholarshipTitle(a))}</td>
              <td>${badge(a.status)}</td>
              <td>${esc(new Date(a.created_at).toLocaleDateString())}</td>
            </tr>
          `).join("") || '<tr><td colspan="4">No applications yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  `);
}

async function saveScholarship(payload, id = null) {
  if (real) {
    const query = id
      ? db.from("scholarships").update(payload).eq("id", id)
      : db.from("scholarships").insert(payload);

    const { error } = await query;
    if (error) throw error;
  } else {
    const all = get("scholarships", seed);

    if (id) {
      const index = all.findIndex(s => String(s.id) === String(id));
      if (index < 0) throw Error("Scholarship not found");
      all[index] = { ...all[index], ...payload };
    } else {
      all.unshift({ id: Date.now(), ...payload });
    }

    put("scholarships", all);
  }
}

function manage() {
  layout("Manage Scholarships", `
    <span class="eyebrow">ADMIN TOOLS</span>
    <h1>Manage Scholarships</h1>
    <p class="lead">Create and update scholarship opportunities.</p>

    <div class="split">
      <form id="schform" class="panel form-stack">
        <h2 id="formtitle">Add Scholarship</h2>
        <input type="hidden" name="id">

        <label class="field">Title
          <input name="title" required>
        </label>

        <label class="field">Description
          <textarea name="description" rows="4" required></textarea>
        </label>

        <label class="field">Eligibility Summary
          <input name="eligibility" required>
        </label>

        <label class="field">Deadline
          <input type="date" name="deadline">
        </label>

        <label class="field">Status
          <select name="status">
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <div class="btns">
          <button class="btn">Save Scholarship</button>
          <button class="btn alt" type="button" id="reset">Clear</button>
        </div>
      </form>

      <div class="panel">
        <h2>Existing Scholarships</h2>
        <div id="schlist"></div>
      </div>
    </div>
  `);

  function draw() {
    $("#schlist").innerHTML = scholarships.map(s => `
      <div class="panel" style="margin-bottom:12px">
        <strong>${esc(s.title)}</strong>
        <div class="meta">${badge(s.status)}</div>
        <div class="btns">
          <button class="btn alt small" data-edit="${esc(s.id)}">Edit</button>
          <button class="btn small" data-toggle="${esc(s.id)}">
            ${s.status === "open" ? "Close" : "Reopen"}
          </button>
        </div>
      </div>
    `).join("") || '<p class="muted">No scholarships yet.</p>';
  }

  draw();

  $("#reset").onclick = () => {
    $("#schform").reset();
    $("#schform").elements.id.value = "";
    $("#formtitle").textContent = "Add Scholarship";
  };

  $("#schlist").onclick = async e => {
    const id = e.target.dataset.edit || e.target.dataset.toggle;
    if (!id) return;

    const s = scholarships.find(s => String(s.id) === String(id));
    if (!s) return;

    if (e.target.dataset.edit) {
      const form = $("#schform");
      for (const key of ["id", "title", "description", "eligibility", "deadline", "status"]) {
        form.elements[key].value = s[key] || "";
      }
      $("#formtitle").textContent = "Edit Scholarship";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      try {
        await saveScholarship({ status: s.status === "open" ? "closed" : "open" }, id);
        await refresh();
        draw();
        toast("Scholarship updated.");
      } catch (error) {
        toast(error.message);
      }
    }
  };

  $("#schform").onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);

    const payload = {
      title: String(f.get("title")).trim(),
      description: String(f.get("description")).trim(),
      eligibility: String(f.get("eligibility")).trim(),
      deadline: f.get("deadline") || null,
      status: f.get("status")
    };

    try {
      await saveScholarship(payload, f.get("id") || null);
      await refresh();
      draw();
      $("#reset").click();
      toast("Scholarship saved.");
    } catch (error) {
      toast(error.message);
    }
  };
}

async function openDocument(path) {
  if (!path) return toast("No document uploaded.");
  if (!real) return toast("Demo mode does not store document files.");

  const { data, error } = await db.storage.from(BUCKET)
    .createSignedUrl(path, 60);

  if (error) return toast(error.message);
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

function review() {
  layout("Review Applications", `
    <span class="eyebrow">APPLICATION VERIFICATION</span>
    <h1>Review Applications</h1>
    <p class="lead">Review student information and uploaded documents.</p>

    <div class="filterbar">
      <select id="statusfilter" class="search">
        <option value="">All Applications</option>
        <option value="submitted">Submitted</option>
        <option value="under_review">Under Review</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
    </div>

    <div id="reviewlist" class="grid"></div>
  `);

  function draw() {
    const filter = $("#statusfilter").value;

    $("#reviewlist").innerHTML = applications
      .filter(a => !filter || a.status === filter)
      .map(a => `
        <article class="card interactive-card">
          <div class="meta">${badge(a.status)}</div>
          <h3>${esc(scholarshipTitle(a))}</h3>

          <p><strong>Applicant:</strong> ${esc(a.full_name || "Student")}</p>
          <p><strong>Email:</strong> ${esc(a.email || "-")}</p>
          <p><strong>Mobile:</strong> ${esc(a.mobile || "-")}</p>
          <p><strong>Institution:</strong> ${esc(a.institution || "-")}</p>
          <p><strong>Course:</strong> ${esc(a.course || "-")}</p>
          <p><strong>Year:</strong> ${esc(a.study_year || "-")}</p>
          <p><strong>Family Income:</strong> ₹${esc(a.family_income ?? "-")}</p>
          <p><strong>Statement:</strong> ${esc(a.statement)}</p>

          <div class="btns">
            ${a.community_document_path ? `
              <button class="btn alt small" data-doc="community"
                data-id="${esc(a.id)}">Community Certificate</button>
            ` : ""}

            ${a.additional_document_path ? `
              <button class="btn alt small" data-doc="additional"
                data-id="${esc(a.id)}">Additional Document</button>
            ` : ""}
          </div>

          <label class="field">Decision
            <select data-status="${esc(a.id)}">
              ${["submitted", "under_review", "approved", "rejected"].map(s => `
                <option value="${s}" ${a.status === s ? "selected" : ""}>
                  ${s.replace("_", " ")}
                </option>
              `).join("")}
            </select>
          </label>

          <label class="field">Admin Feedback
            <textarea rows="3" data-note="${esc(a.id)}">${esc(a.admin_note || "")}</textarea>
          </label>

          <button class="btn small" data-save="${esc(a.id)}">Save Decision</button>
        </article>
      `).join("") || '<div class="empty">No applications found.</div>';
  }

  draw();
  $("#statusfilter").onchange = draw;

  $("#reviewlist").onclick = async e => {
    const id = e.target.dataset.id || e.target.dataset.save;
    if (!id) return;

    const a = applications.find(a => String(a.id) === String(id));
    if (!a) return;

    if (e.target.dataset.doc) {
      await openDocument(e.target.dataset.doc === "community"
        ? a.community_document_path
        : a.additional_document_path);
      return;
    }

    const status = document.querySelector(`[data-status="${CSS.escape(id)}"]`).value;
    const admin_note = document.querySelector(`[data-note="${CSS.escape(id)}"]`).value;

    try {
      if (real) {
        const { error } = await db.from("applications")
          .update({ status, admin_note, updated_at: new Date().toISOString() })
          .eq("id", id);

        if (error) throw error;
      } else {
        const all = get("applications", []);
        const item = all.find(x => String(x.id) === String(id));
        if (!item) throw Error("Application not found");
        item.status = status;
        item.admin_note = admin_note;
        put("applications", all);
      }

      await refresh();
      draw();
      toast("Decision saved.");
    } catch (error) {
      toast(error.message);
    }
  };
}

function announcementPage() {
  layout("Announcements", `
    <span class="eyebrow">COMMUNICATE WITH STUDENTS</span>
    <h1>Manage Announcements</h1>

    <div class="split">
      <form id="newsform" class="panel form-stack">
        <h2>Post Announcement</h2>

        <label class="field">Title
          <input name="title" required>
        </label>

        <label class="field">Message
          <textarea name="body" rows="6" required></textarea>
        </label>

        <button class="btn">Publish Announcement →</button>
      </form>

      <div class="panel">
        <h2>Published Updates</h2>
        ${announcements.map(n => `
          <p><strong>${esc(n.title)}</strong><br>
          <span class="muted">${esc(n.body)}</span></p>
        `).join("") || '<p class="muted">No announcements yet.</p>'}
      </div>
    </div>
  `);

  $("#newsform").onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const payload = {
      title: String(f.get("title")).trim(),
      body: String(f.get("body")).trim()
    };

    try {
      if (real) {
        const { error } = await db.from("announcements").insert(payload);
        if (error) throw error;
      } else {
        const all = get("announcements", []);
        all.unshift({ id: Date.now(), ...payload });
        put("announcements", all);
      }

      toast("Announcement published.");
      setTimeout(() => location.reload(), 500);
    } catch (error) {
      toast(error.message);
    }
  };
}

async function start() {
  if (["login", "register"].includes(page)) {
    user = await authUser();

    if (user) {
      location.href = profile.role === "admin" ? "admin.html" : "dashboard.html";
      return;
    }

    authView();
    return;
  }

  user = await authUser();

  if (!user) {
    location.href = "login.html";
    return;
  }

  const adminPages = ["admin", "manage", "review", "announcements"];
  const isAdminPage = adminPages.includes(page);

  if (isAdminPage && profile.role !== "admin") {
    location.href = "dashboard.html";
    return;
  }

  if (!isAdminPage && profile.role === "admin") {
    location.href = "admin.html";
    return;
  }

  await refresh();

  const pages = {
    dashboard, explore, eligibility, apply, track,
    chat, admin, manage, review,
    announcements: announcementPage
  };

  (pages[page] || dashboard)();
}

start().catch(error => {
  console.error("Initialization error:", error);
  $("#root").textContent = "Unable to load: " + error.message;
});
