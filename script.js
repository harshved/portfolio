'use strict';

// =========================================================
// ENVIRONMENT
// =========================================================
const root = document.documentElement;
const body = document.body;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
const animate = hasGSAP && !reducedMotion;

if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

let siteData = null;
let heroTimeline = null;

// Canvas state lives up here so theme changes can update it at any time
const canvas = document.getElementById('network-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
let particleRGB = '52, 211, 153';
let canvasW = 0;
let canvasH = 0;
let canvasRunning = false;
const mouse = { x: null, y: null, radius: 140 };

// =========================================================
// THEME (dark / light)
// =========================================================
const THEME_KEY = 'hv-theme';

function currentTheme() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* storage unavailable */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f6f7f4' : '#07090d');
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    updateCanvasColor();
    if (reducedMotion) drawCanvasFrame();
}

// Circular reveal from the click point when the browser supports View Transitions
function setTheme(theme, origin) {
    if (theme === currentTheme()) return;
    if (!document.startViewTransition || reducedMotion) {
        applyTheme(theme);
        return;
    }
    const x = origin ? origin.x : window.innerWidth - 80;
    const y = origin ? origin.y : 36;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = document.startViewTransition(() => applyTheme(theme));
    transition.ready.then(() => {
        root.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: 650, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' }
        );
    }).catch(() => { });
}

function toggleTheme(origin) {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark', origin);
}

document.getElementById('theme-toggle').addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    toggleTheme({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
});

// =========================================================
// PRELOADER (plays once per browser session)
// =========================================================
function runPreloader() {
    return new Promise((resolve) => {
        const preloader = document.getElementById('preloader');
        let seen = false;
        try { seen = sessionStorage.getItem('hv-booted') === '1'; } catch (e) { /* ignore */ }

        if (seen || reducedMotion) {
            preloader.remove();
            body.classList.remove('is-loading');
            resolve();
            return;
        }
        try { sessionStorage.setItem('hv-booted', '1'); } catch (e) { /* ignore */ }

        const text = document.getElementById('boot-text');
        const bar = document.getElementById('boot-bar');
        const count = document.getElementById('boot-count');
        const messages = [
            'Initializing HV-OS kernel',
            'Loading security modules',
            'Mounting file system',
            'Checking integrity... [OK]',
            'Access granted'
        ];
        const duration = 1500;
        const start = performance.now();

        function frame(now) {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            bar.style.transform = `scaleX(${eased})`;
            count.textContent = `${Math.round(eased * 100)}%`;
            text.textContent = `> ${messages[Math.min(messages.length - 1, Math.floor(eased * messages.length))]}`;
            if (p < 1) {
                requestAnimationFrame(frame);
            } else {
                setTimeout(() => {
                    preloader.classList.add('done');
                    body.classList.remove('is-loading');
                    resolve();
                    setTimeout(() => preloader.remove(), 700);
                }, 250);
            }
        }
        requestAnimationFrame(frame);
    });
}

// =========================================================
// DATA LOADING
// =========================================================
async function loadData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

// =========================================================
// RENDERING
// =========================================================
const pad = (n) => String(n).padStart(2, '0');
const chips = (items) => `<div class="chip-list">${items.map((t) => `<span class="chip">${t}</span>`).join('')}</div>`;

function sectionHead(num, label, title, sub, center = false) {
    return `
        <div class="section-head${center ? ' center' : ''}" data-reveal>
            <span class="eyebrow">${num} · ${label}</span>
            <h2 class="section-title">${title}</h2>
            ${sub ? `<p class="section-sub">${sub}</p>` : ''}
        </div>`;
}

function socialLinks(social) {
    return social.map((s) => `
        <a href="${s.url}" class="icon-btn magnetic" ${s.url.startsWith('http') ? 'target="_blank" rel="noopener"' : ''} aria-label="${s.platform}" title="${s.platform}">
            <i class="${s.icon}"></i>
        </a>`).join('');
}

function heroHTML(d) {
    const h = d.header;
    const roles = h.tagline.split('|').map((s) => s.trim());
    const lines = h.headline
        .map((l) => `<span class="line"><span class="line-inner">${l.replace(/\*(.+?)\*/g, '<em>$1</em>')}</span></span>`)
        .join('');

    const topFocus = d.skills.slice(0, 3).map((s) => `<span class="tk-s">"${s.title.split(' ')[0]}"</span>`).join(', ');
    const code = [
        `<span class="tk-k">const</span> <span class="tk-f">harsh</span> = {`,
        `  <span class="tk-p">role</span>: <span class="tk-s">"${roles[0]}"</span>,`,
        `  <span class="tk-p">based</span>: <span class="tk-s">"${d.contact.location}"</span>,`,
        `  <span class="tk-p">focus</span>: [${topFocus}],`,
        `  <span class="tk-p">stack</span>: [<span class="tk-s">"React"</span>, <span class="tk-s">"Django"</span>, <span class="tk-s">"AWS"</span>],`,
        `  <span class="tk-p">securityFirst</span>: <span class="tk-b">true</span>,`,
        `  <span class="tk-p">available</span>: <span class="tk-b">${d.freelance && d.freelance.available ? 'true' : 'false'}</span>,`,
        `};`,
        ``,
        `<span class="tk-f">harsh</span>.<span class="tk-f">build</span>(yourIdea); <span class="tk-c">// → shipped 🚀</span>`
    ].map((l) => `<span class="code-line">${l || ' '}</span>`).join('');

    const stats = (d.stats || []).map((s) => `
        <div class="stat">
            <div class="stat-value"><span class="counter" data-target="${s.value}">${s.value}</span><span class="suffix">${s.suffix || ''}</span></div>
            <div class="stat-label">${s.label}</div>
        </div>`).join('');

    return `
    <section id="top" class="hero">
        <div class="container hero-grid">
            <div class="hero-copy">
                <a href="#contact" class="status-pill" data-hero><span class="pulse-dot"></span>${h.status}</a>
                <p class="hero-hello" data-hero>Hi, I'm ${h.fullName} 👋</p>
                <h1 class="hero-title" aria-label="${h.headline.join(' ').replace(/\*/g, '')}">${lines}</h1>
                <p class="hero-role" data-hero><span class="mono">&gt;_</span> <span id="role-typer" data-roles='${JSON.stringify(roles)}'>${roles[0]}</span><span class="caret"></span></p>
                <p class="hero-intro" data-hero>${h.intro}</p>
                <div class="hero-cta" data-hero>
                    <a href="#contact" class="btn btn-primary magnetic">Start a project <i class="fas fa-arrow-right"></i></a>
                    <a href="#projects" class="btn btn-ghost magnetic">View my work</a>
                </div>
                <div class="hero-social" data-hero>
                    <span class="label">Find me on</span>
                    ${socialLinks(d.contact.social)}
                </div>
            </div>
            <div class="hero-visual" data-hero-visual>
                <div class="code-card" id="tilt-card">
                    <div class="code-head">
                        <span class="dots"><i></i><i></i><i></i></span>
                        <span class="code-file">developer.ts</span>
                    </div>
                    <pre class="code-body"><code>${code}</code></pre>
                </div>
                <div class="float-badge fb-1"><i class="fas fa-shield-halved"></i> Security-first</div>
                <div class="float-badge fb-2"><i class="fas fa-bolt"></i> Low-latency</div>
                <div class="float-badge fb-3"><i class="fas fa-cloud"></i> Cloud-native</div>
            </div>
        </div>
        ${stats ? `<div class="container"><div class="stats" id="stats">${stats}</div></div>` : ''}
        <a href="#about" class="scroll-cue" aria-label="Scroll to about"><span></span></a>
    </section>`;
}

function marqueeHTML(d) {
    if (!d.marquee || !d.marquee.length) return '';
    const group = `<div class="marquee-group">${d.marquee.map((m) => `<span class="marquee-item">${m}</span>`).join('')}</div>`;
    return `<div class="marquee" aria-hidden="true"><div class="marquee-track">${group}${group}</div></div>`;
}

function aboutHTML(d) {
    const facts = (d.about && d.about.facts ? d.about.facts : []).map((f) => `
        <li class="fact card spot" data-reveal>
            <span class="fact-icon"><i class="${f.icon}"></i></span>
            <div><div class="fact-label">${f.label}</div><div class="fact-value">${f.value}</div></div>
        </li>`).join('');
    return `
    <section id="about" class="section">
        <div class="container about-grid">
            ${sectionHead('01', 'About', 'An engineer with a <em>security</em> mindset.')}
            <div>
                <p class="about-lead" data-reveal>${d.header.bio}</p>
                <ul class="facts">${facts}</ul>
            </div>
        </div>
    </section>`;
}

function servicesHTML(d) {
    if (!d.services) return '';
    const cards = d.services.map((s, i) => `
        <article class="service card spot" data-reveal>
            <div class="service-top">
                <span class="service-icon"><i class="${s.icon}"></i></span>
                <span class="service-num">${pad(i + 1)}</span>
            </div>
            <h3>${s.title}</h3>
            <p>${s.text}</p>
            ${chips(s.tags || [])}
        </article>`).join('');
    return `
    <section id="services" class="section">
        <div class="container">
            ${sectionHead('02', 'Services', 'What I can <em>build</em> for you.', 'From a first MVP to hardening an existing platform, I cover the full lifecycle, so you work with one person who understands the whole system.')}
            <div class="services-grid">${cards}</div>
        </div>
    </section>`;
}

function projectsHTML(d) {
    const cards = d.projects.map((p, i) => `
        <article class="project card spot" data-reveal data-project="${i}">
            <div class="project-cover" style="--h:${p.hue ?? 160}">
                <span class="project-index">${pad(i + 1)} / ${pad(d.projects.length)}</span>
                ${p.category ? `<span class="project-cat">${p.category}</span>` : ''}
                <span class="project-cover-icon"><i class="${p.icon || 'fas fa-code'}"></i></span>
            </div>
            <div class="project-body">
                <h3 class="project-title">${p.title}</h3>
                <p class="project-summary">${p.summary}</p>
                ${chips(p.techStack)}
                <div class="project-foot">
                    <button class="project-link" type="button" data-project="${i}" aria-label="Open case study: ${p.title}">
                        Read case study <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        </article>`).join('');
    return `
    <section id="projects" class="section">
        <div class="container">
            ${sectionHead('03', 'Selected work', 'Work I am <em>proud</em> of.', 'A mix of fintech, SaaS, e-commerce and IoT. Click any project for the full case study.')}
            <div class="work-grid">${cards}</div>
        </div>
    </section>`;
}

function experienceHTML(d) {
    if (!d.experience) return '';
    const items = d.experience.map((e) => {
        const current = /present/i.test(e.dates);
        return `
        <div class="tl-item${current ? ' current' : ''}" data-reveal>
            <span class="tl-dot"></span>
            <div class="tl-card card spot">
                <div class="tl-head">
                    <div>
                        <h3 class="tl-role">${e.role}</h3>
                        <div class="tl-company">@ ${e.company}</div>
                    </div>
                    <span class="tl-date">${current ? '<span class="pulse-dot"></span>' : ''}${e.dates}</span>
                </div>
                <p class="tl-desc">${e.description}</p>
                <div class="tl-foot">
                    ${e.tags ? chips(e.tags) : '<span></span>'}
                    <button class="read-more" type="button" aria-expanded="false">Read more <i class="fas fa-chevron-down"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
    return `
    <section id="experience" class="section">
        <div class="container">
            ${sectionHead('04', 'Experience', 'Where I have <em>shipped</em> code.')}
            <div class="timeline">
                <div class="timeline-line"><span class="timeline-progress"></span></div>
                ${items}
            </div>
        </div>
    </section>`;
}

function skillsHTML(d) {
    const cards = d.skills.map((s) => `
        <div class="skill-card card spot" data-reveal>
            <div class="skill-head">
                <span class="fact-icon"><i class="${s.icon || 'fas fa-code'}"></i></span>
                <div><h3>${s.title}</h3><small>skills</small></div>
            </div>
            ${chips(s.items)}
        </div>`).join('');
    return `
    <section id="skills" class="section">
        <div class="container">
            ${sectionHead('05', 'Skills', 'A toolkit across the <em>whole stack</em>.')}
            <div class="skills-grid">${cards}</div>
        </div>
    </section>`;
}

function educationHTML(d) {
    if (!d.education) return '';
    const cards = d.education.map((e) => `
        <article class="edu-card card spot" id="${e.id}" data-reveal>
            <div class="edu-top">
                <span class="fact-icon"><i class="fas fa-graduation-cap"></i></span>
                <span class="tl-date">${e.date}</span>
            </div>
            <h3>${e.degree}</h3>
            <div class="edu-school">${e.school}</div>
            <p>${e.description}</p>
        </article>`).join('');
    return `
    <section id="education" class="section">
        <div class="container">
            ${sectionHead('06', 'Education', 'Foundations in <em>CS & cloud</em>.')}
            <div class="edu-grid">${cards}</div>
        </div>
    </section>`;
}

function processHTML(d) {
    if (!d.process) return '';
    const steps = d.process.map((s, i) => `
        <div class="step" data-reveal>
            <div class="step-icon"><i class="${s.icon}"></i><span class="step-num">${pad(i + 1)}</span></div>
            <h3>${s.title}</h3>
            <p>${s.text}</p>
        </div>`).join('');
    return `
    <section id="process" class="section">
        <div class="container">
            ${sectionHead('07', 'Process', 'How we would <em>work together</em>.', 'A simple, transparent process that keeps you in the loop from the first call to launch day.', true)}
            <div class="process-grid">
                <div class="process-line"><span></span></div>
                ${steps}
            </div>
        </div>
    </section>`;
}

function ctaHTML(d) {
    if (!d.freelance || !d.freelance.available) return '';
    return `
    <section class="section" style="padding-block: 0;">
        <div class="container">
            <div class="cta-band" data-reveal>
                <span class="eyebrow" style="justify-content:center"><span class="pulse-dot"></span> ${d.freelance.title}</span>
                <h2>Have an idea? Let's make it <span class="grad">real</span>.</h2>
                <p>${d.freelance.text}</p>
                <div class="hero-cta">
                    <a href="#contact" class="btn btn-primary magnetic">Get in touch <i class="fas fa-arrow-right"></i></a>
                    <a href="mailto:${d.contact.email}" class="btn btn-ghost magnetic"><i class="fas fa-envelope"></i> ${d.contact.email}</a>
                </div>
            </div>
        </div>
    </section>`;
}

function contactHTML(d) {
    const c = d.contact;
    return `
    <section id="contact" class="section">
        <div class="container contact-grid">
            <div class="contact-info">
                ${sectionHead('08', 'Contact', "Let's build something <em>secure</em> together.", 'Tell me about your project, role or idea. Every message is read personally.')}
                <div class="contact-cards">
                    <div class="contact-item card spot" data-reveal>
                        <span class="fact-icon"><i class="fas fa-envelope"></i></span>
                        <div><div class="fact-label">Email</div><a class="fact-value" href="mailto:${c.email}">${c.email}</a></div>
                        <button class="icon-btn copy-btn" type="button" id="copy-email" aria-label="Copy email address" title="Copy email"><i class="far fa-copy"></i></button>
                    </div>
                    <div class="contact-item card spot" data-reveal>
                        <span class="fact-icon"><i class="fas fa-location-dot"></i></span>
                        <div><div class="fact-label">Location</div><div class="fact-value">${c.location || ''}</div></div>
                    </div>
                    <div class="contact-item card spot" data-reveal>
                        <span class="fact-icon"><i class="fas fa-clock"></i></span>
                        <div><div class="fact-label">My local time</div><div class="fact-value" id="local-time">–</div></div>
                    </div>
                </div>
                <div class="contact-social" data-reveal>${socialLinks(c.social)}</div>
            </div>

            <form id="contact-form" class="contact-form card" data-reveal novalidate>
                <input type="hidden" name="access_key" value="23a50f78-a124-4ecb-8de3-3cf6be130d5a">
                <div class="form-row">
                    <div class="field">
                        <input type="text" id="f-name" name="name" placeholder=" " autocomplete="name" required>
                        <label for="f-name">Name / Organization</label>
                    </div>
                    <div class="field">
                        <input type="email" id="f-email" name="email" placeholder=" " autocomplete="email" required>
                        <label for="f-email">Email address</label>
                    </div>
                </div>
                <div class="field">
                    <select id="f-topic" name="topic">
                        <option>Freelance project</option>
                        <option>Contract role</option>
                        <option>Full-time opportunity</option>
                        <option>Security review</option>
                        <option>Just saying hi</option>
                    </select>
                    <label for="f-topic">I'm reaching out about</label>
                    <i class="fas fa-chevron-down select-caret"></i>
                </div>
                <div class="field">
                    <textarea id="f-message" name="message" placeholder=" " rows="5" required></textarea>
                    <label for="f-message">Tell me about your project…</label>
                </div>
                <input type="checkbox" name="botcheck" class="hp-field" tabindex="-1" autocomplete="off">
                <button type="submit" class="btn btn-primary form-submit">Send message <i class="fas fa-paper-plane"></i></button>
                <div id="form-result" class="form-result" aria-live="polite"></div>
            </form>
        </div>
    </section>`;
}

function renderWebsite(data) {
    const app = document.getElementById('app');
    app.innerHTML = [
        heroHTML(data),
        marqueeHTML(data),
        aboutHTML(data),
        servicesHTML(data),
        projectsHTML(data),
        experienceHTML(data),
        skillsHTML(data),
        educationHTML(data),
        processHTML(data),
        ctaHTML(data),
        contactHTML(data)
    ].join('');
    document.getElementById('year').textContent = new Date().getFullYear();
}

function renderError() {
    document.getElementById('app').innerHTML = `
        <section class="hero"><div class="container">
            <h1 class="hero-title">Harsh Ved</h1>
            <p class="hero-intro">Something went wrong while loading the portfolio. Please refresh the page, or email
            <a class="grad" href="mailto:harshved3@gmail.com">harshved3@gmail.com</a>.</p>
        </div></section>`;
}

// =========================================================
// CONTACT FORM (Web3Forms)
// =========================================================
function initContactForm() {
    const form = document.getElementById('contact-form');
    const result = document.getElementById('form-result');
    if (!form) return;
    const submitBtn = form.querySelector('.form-submit');
    const submitHTML = submitBtn.innerHTML;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!form.checkValidity()) {
            result.className = 'form-result err';
            result.textContent = 'Please fill in your name, a valid email and a message.';
            form.querySelector(':invalid').focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Sending… <i class="fas fa-circle-notch fa-spin"></i>';
        result.className = 'form-result';
        result.textContent = '';

        const json = JSON.stringify(Object.fromEntries(new FormData(form)));

        fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: json
        })
            .then(async (response) => {
                const res = await response.json();
                if (response.status === 200) {
                    result.className = 'form-result ok';
                    result.textContent = "Message sent! I'll get back to you soon.";
                    showToast('✅ Message sent successfully');
                    form.reset();
                } else {
                    console.log(response);
                    result.className = 'form-result err';
                    result.textContent = res.message || 'Something went wrong. Please try again.';
                }
            })
            .catch((error) => {
                console.log(error);
                result.className = 'form-result err';
                result.textContent = 'Message failed to send. Please try again or email me directly.';
            })
            .then(() => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = submitHTML;
                setTimeout(() => {
                    result.textContent = '';
                    result.className = 'form-result';
                }, 6000);
            });
    });
}

// =========================================================
// SMALL UI HELPERS
// =========================================================
let toastTimer;
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function initCopyEmail() {
    const btn = document.getElementById('copy-email');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const email = siteData.contact.email;
        try {
            await navigator.clipboard.writeText(email);
        } catch (e) {
            const tmp = document.createElement('textarea');
            tmp.value = email;
            body.appendChild(tmp);
            tmp.select();
            document.execCommand('copy');
            tmp.remove();
        }
        btn.innerHTML = '<i class="fas fa-check"></i>';
        showToast('📋 Email copied to clipboard');
        setTimeout(() => { btn.innerHTML = '<i class="far fa-copy"></i>'; }, 1800);
    });
}

function initLocalTime() {
    const el = document.getElementById('local-time');
    if (!el) return;
    const tz = siteData.contact.timezone || 'America/Toronto';
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    const tick = () => { el.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 30000);
}

function initRoleTyper() {
    const el = document.getElementById('role-typer');
    if (!el) return;
    const roles = JSON.parse(el.dataset.roles || '[]');
    if (roles.length < 2 || reducedMotion) return;
    let roleIndex = 0;
    let charIndex = roles[0].length;
    let deleting = true;

    function step() {
        const word = roles[roleIndex];
        if (deleting) {
            charIndex--;
            el.textContent = word.slice(0, charIndex);
            if (charIndex === 0) {
                deleting = false;
                roleIndex = (roleIndex + 1) % roles.length;
                return setTimeout(step, 350);
            }
            return setTimeout(step, 35);
        }
        const next = roles[roleIndex];
        charIndex++;
        el.textContent = next.slice(0, charIndex);
        if (charIndex === next.length) {
            deleting = true;
            return setTimeout(step, 2400);
        }
        return setTimeout(step, 65);
    }
    setTimeout(step, 2800);
}

function initCounters() {
    const counters = document.querySelectorAll('.counter');
    if (!counters.length || reducedMotion) return;
    counters.forEach((c) => { c.textContent = '0'; });

    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            io.unobserve(el);
            const target = Number(el.dataset.target) || 0;
            const duration = 1800;
            const start = performance.now();
            const frame = (now) => {
                const p = Math.min((now - start) / duration, 1);
                el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4)));
                if (p < 1) requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
        });
    }, { threshold: 0.6 });
    counters.forEach((c) => io.observe(c));
}

function initReadMore() {
    document.querySelectorAll('.tl-item .read-more').forEach((btn) => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.tl-item');
            const expanded = item.classList.toggle('expanded');
            btn.setAttribute('aria-expanded', String(expanded));
            btn.firstChild.textContent = expanded ? 'Show less ' : 'Read more ';
            if (hasGSAP) ScrollTrigger.refresh();
        });
    });
}

// =========================================================
// POINTER EFFECTS (spotlight, magnetic, tilt, glow)
// =========================================================
function initPointerEffects() {
    if (!finePointer) return;

    // Spotlight that follows the cursor inside cards
    document.addEventListener('pointermove', (e) => {
        const card = e.target.closest && e.target.closest('.spot');
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });

    if (reducedMotion) return;

    // Soft glow that trails the cursor
    const glow = document.getElementById('cursor-glow');
    let gx = window.innerWidth / 2, gy = window.innerHeight / 2, tx = gx, ty = gy;
    window.addEventListener('pointermove', (e) => {
        tx = e.clientX;
        ty = e.clientY;
        glow.classList.add('active');
    }, { passive: true });
    document.addEventListener('mouseleave', () => glow.classList.remove('active'));
    (function follow() {
        gx += (tx - gx) * 0.12;
        gy += (ty - gy) * 0.12;
        glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
        requestAnimationFrame(follow);
    })();

    // Magnetic buttons
    document.querySelectorAll('.magnetic').forEach((el) => {
        el.addEventListener('pointermove', (e) => {
            const r = el.getBoundingClientRect();
            const x = (e.clientX - r.left - r.width / 2) * 0.25;
            const y = (e.clientY - r.top - r.height / 2) * 0.35;
            el.style.transform = `translate(${x}px, ${y}px)`;
        });
        el.addEventListener('pointerleave', () => {
            el.style.transition = 'transform .5s cubic-bezier(.22,1,.36,1)';
            el.style.transform = '';
            setTimeout(() => { el.style.transition = ''; }, 500);
        });
    });

    // 3D tilt on the hero code card
    const card = document.getElementById('tilt-card');
    const visual = card && card.parentElement;
    if (card) {
        visual.addEventListener('pointermove', (e) => {
            const r = visual.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width - 0.5;
            const py = (e.clientY - r.top) / r.height - 0.5;
            card.style.transform = `rotateY(${px * 10}deg) rotateX(${-py * 10}deg)`;
        });
        visual.addEventListener('pointerleave', () => { card.style.transform = ''; });
    }
}

// =========================================================
// NAV: scroll state, progress, active link, mobile menu
// =========================================================
const nav = document.getElementById('nav');
const hamburger = document.getElementById('hamburger-btn');
const mobileMenu = document.getElementById('mobile-menu');

function toggleMobileMenu(force) {
    const open = typeof force === 'boolean' ? force : !mobileMenu.classList.contains('open');
    mobileMenu.classList.toggle('open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    hamburger.setAttribute('aria-expanded', String(open));
    hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    body.classList.toggle('no-scroll', open);
    if (open) nav.classList.remove('nav-hidden');
}

hamburger.addEventListener('click', () => toggleMobileMenu());
mobileMenu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => toggleMobileMenu(false)));
window.addEventListener('resize', () => {
    if (window.innerWidth > 960 && mobileMenu.classList.contains('open')) toggleMobileMenu(false);
});

function initNavScroll() {
    const progress = document.getElementById('scroll-progress');
    let lastY = window.scrollY;
    let ticking = false;

    function update() {
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
        nav.classList.toggle('scrolled', y > 20);
        const menuOpen = mobileMenu.classList.contains('open');
        if (!menuOpen) nav.classList.toggle('nav-hidden', y > lastY && y > 400);
        lastY = y;
        ticking = false;
    }
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(update);
            ticking = true;
        }
    }, { passive: true });
    update();

    // Highlight the nav link of the section in view
    const links = [...document.querySelectorAll('.nav-links a')];
    const map = new Map(links.map((l) => [l.getAttribute('href').slice(1), l]));
    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            links.forEach((l) => l.classList.remove('active'));
            const link = map.get(entry.target.id);
            if (link) link.classList.add('active');
        });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach((s) => io.observe(s));
}

// =========================================================
// SCROLL ANIMATIONS (GSAP)
// =========================================================
function setupAnimations() {
    if (!animate) return;

    // Hero intro: prepared now, played when the preloader leaves
    const heroItems = document.querySelectorAll('[data-hero]');
    const lines = document.querySelectorAll('.hero-title .line-inner');
    const visual = document.querySelector('[data-hero-visual]');
    const codeLines = document.querySelectorAll('.code-line');
    const badges = document.querySelectorAll('.float-badge');
    const stats = document.querySelectorAll('.stat');

    gsap.set(lines, { yPercent: 110 });
    gsap.set(heroItems, { opacity: 0, y: 24 });
    gsap.set(visual, { opacity: 0, y: 40, scale: 0.96 });
    gsap.set(codeLines, { opacity: 0, x: -10 });
    gsap.set(badges, { opacity: 0, scale: 0.6 });
    gsap.set(stats, { opacity: 0, y: 30 });

    heroTimeline = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } })
        .to(heroItems[0], { opacity: 1, y: 0, duration: 0.6 })
        .to(heroItems[1], { opacity: 1, y: 0, duration: 0.6 }, '-=0.4')
        .to(lines, { yPercent: 0, duration: 1, stagger: 0.1, ease: 'power4.out' }, '-=0.4')
        .to([...heroItems].slice(2), { opacity: 1, y: 0, duration: 0.7, stagger: 0.08 }, '-=0.6')
        .to(visual, { opacity: 1, y: 0, scale: 1, duration: 1 }, '-=0.9')
        .to(codeLines, { opacity: 1, x: 0, duration: 0.4, stagger: 0.06 }, '-=0.6')
        .to(badges, { opacity: 1, scale: 1, duration: 0.6, stagger: 0.12, ease: 'back.out(2)' }, '-=0.5')
        .to(stats, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08 }, '-=0.8');

    // Generic reveal for everything marked [data-reveal]
    const reveals = gsap.utils.toArray('[data-reveal]');
    gsap.set(reveals, { opacity: 0, y: 40 });
    ScrollTrigger.batch(reveals, {
        start: 'top 88%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', overwrite: true })
    });

    // Timeline line draws as you scroll through experience
    const progressLine = document.querySelector('.timeline-progress');
    if (progressLine) {
        gsap.fromTo(progressLine, { scaleY: 0 }, {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: { trigger: '.timeline', start: 'top 70%', end: 'bottom 60%', scrub: 0.6 }
        });
    }

    // Process connector line
    const processLine = document.querySelector('.process-line span');
    if (processLine) {
        gsap.fromTo(processLine, { scaleX: 0 }, {
            scaleX: 1,
            ease: 'none',
            scrollTrigger: { trigger: '.process-grid', start: 'top 80%', end: 'top 40%', scrub: 0.6 }
        });
    }

    // Subtle parallax on the hero visual and project covers
    gsap.to('.hero-visual', {
        yPercent: -12,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
    gsap.utils.toArray('.project-cover-icon').forEach((icon) => {
        gsap.fromTo(icon, { y: 20 }, {
            y: -20,
            ease: 'none',
            scrollTrigger: { trigger: icon, start: 'top bottom', end: 'bottom top', scrub: true }
        });
    });
}

function playIntro() {
    if (heroTimeline) heroTimeline.play();
    if (hasGSAP) {
        ScrollTrigger.refresh();
        // Web fonts change text heights, so recalculate trigger positions once they land
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
        window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
    }
}

// =========================================================
// PROJECT CASE-STUDY MODAL
// =========================================================
const modal = document.getElementById('project-modal');
const modalContent = document.getElementById('modal-content');
let currentProject = 0;
let lastFocus = null;

function renderProject(i) {
    const p = siteData.projects[i];
    currentProject = i;
    modalContent.innerHTML = `
        <div class="project-cover" style="--h:${p.hue ?? 160}">
            <span class="project-index">${pad(i + 1)} / ${pad(siteData.projects.length)}</span>
            <span class="project-cover-icon"><i class="${p.icon || 'fas fa-code'}"></i></span>
        </div>
        <div class="modal-body">
            ${p.category ? `<span class="eyebrow">${p.category}</span>` : ''}
            <h3 class="project-title" id="modal-title">${p.title}</h3>
            <p style="margin-top:10px">${p.summary}</p>
            ${p.highlights ? `<h4>Highlights</h4><ul class="highlights">${p.highlights.map((h) => `<li><i class="fas fa-circle-check"></i>${h}</li>`).join('')}</ul>` : ''}
            <h4>The story</h4>
            <p>${p.details}</p>
            <h4>Tech stack</h4>
            ${chips(p.techStack)}
        </div>`;
    modal.querySelector('.modal-panel').scrollTop = 0;
}

function openProject(i) {
    if (!siteData || !siteData.projects[i]) return;
    renderProject(i);
    lastFocus = document.activeElement;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    body.classList.add('no-scroll');
    setTimeout(() => modal.querySelector('.modal-close').focus(), 50);
}

function closeProject() {
    if (!modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    body.classList.remove('no-scroll');
    if (lastFocus) lastFocus.focus({ preventScroll: true });
}

function stepProject(dir) {
    const n = siteData.projects.length;
    renderProject((currentProject + dir + n) % n);
}

modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeProject();
});
document.getElementById('modal-prev').addEventListener('click', () => stepProject(-1));
document.getElementById('modal-next').addEventListener('click', () => stepProject(1));

function initProjects() {
    document.querySelectorAll('.project[data-project]').forEach((card) => {
        card.addEventListener('click', () => openProject(Number(card.dataset.project)));
    });
}

// =========================================================
// TERMINAL
// =========================================================
const terminal = document.getElementById('terminal-overlay');
const openTerminalBtn = document.getElementById('open-terminal');
const closeTerminalBtn = document.getElementById('close-terminal');
const input = document.getElementById('cmd-input');
const output = document.getElementById('terminal-output');
const cmdHistory = [];
let historyIndex = 0;
let commands = {};

function openTerminal() {
    terminal.classList.add('open');
    terminal.setAttribute('aria-hidden', 'false');
    input.focus();
    setTimeout(() => input.focus(), 60);
}

function closeTerminal() {
    terminal.classList.remove('open');
    terminal.setAttribute('aria-hidden', 'true');
    openTerminalBtn.focus({ preventScroll: true });
}

openTerminalBtn.addEventListener('click', openTerminal);
closeTerminalBtn.addEventListener('click', closeTerminal);
terminal.addEventListener('click', (e) => { if (e.target === terminal) closeTerminal(); });
terminal.querySelector('.terminal-body').addEventListener('click', () => input.focus());

function buildCommands(d) {
    const acc = (s) => `<span class='t-accent'>${s}</span>`;
    const hl = (s) => `<span class='t-hl'>${s}</span>`;
    return {
        help: `Available commands:<br>${['about', 'services', 'experience', 'projects', 'project &lt;n&gt;', 'skills', 'education', 'contact', 'hire', 'theme [dark|light]', 'open &lt;section&gt;', 'whoami', 'date', 'clear', 'exit', 'sudo'].map(acc).join(', ')}`,

        about: "Name: Harsh Ved<br>System Architect | Full Stack Developer | Cybersecurity Analyst | Cloud Architect<br>Status: 🟢 Available for Hire<br>Role: Full Stack Developer<br>Recent: Lead Developer for a 5-person team (React/Firebase).<br>Background: Python data logic, cybersecurity, and secure system design.<br><br>Type <span class='t-hl'>'open about'</span> to read my full summary.",

        services: (d.services || []).map((s, i) => `${acc(`${i + 1}. ${s.title}`)}: ${s.text}`).join('<br>') + `<br><br>Type ${hl("'hire'")} to start a project.`,

        experience: d.experience.map((e, i) => `${acc(`${i + 1}. ${e.company}`)} - ${e.role} <span class='t-dim'>(${e.dates})</span>`).join('<br>')
            + `<br><br>Type ${hl("'open experience'")} to scroll to details.`,

        projects: d.projects.map((p, i) => `${acc(`${i + 1}. ${p.title}`)} [${p.techStack.join(' / ')}]`).join('<br>')
            + `<br><br>Type ${hl("'project 1'")} to read a case study, or ${hl("'open projects'")}.`,

        skills: d.skills.map((s) => `${acc(`${s.title}:`)} ${s.items.join(', ')}`).join('<br><br>'),

        education: d.education.map((e, i) => `${i + 1}. ${e.school} (${e.degree})`).join('<br>'),

        contact: `Email: ${d.contact.email}<br>GitHub: github.com/harshved<br>LinkedIn: linkedin.com/in/harshved10<br>Type ${hl("'open contact'")} to send a message.`,

        whoami: `${acc('root@harshved-portfolio:~#')} You are the visitor. Welcome to the system.`,
        sudo: "<span class='t-err'>Permission denied:</span> You do not have root access to this portfolio. Nice try."
    };
}

function termPrint(html, cls) {
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.innerHTML = html;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
}

const sectionAliases = { work: 'projects', project: 'projects', home: 'top', top: 'top', edu: 'education', exp: 'experience' };

function scrollToSection(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    setTimeout(() => {
        closeTerminal();
        el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    }, 450);
    return true;
}

function handleCommand(raw) {
    const cmd = raw.trim();
    const lower = cmd.toLowerCase();

    // Echo the command safely (user input is never injected as HTML)
    const echo = document.createElement('div');
    echo.className = 'cmd-echo';
    const promptSpan = document.createElement('span');
    promptSpan.className = 'prompt';
    promptSpan.textContent = 'visitor@harsh-os:~$';
    echo.append(promptSpan, document.createTextNode(cmd));
    output.appendChild(echo);

    if (!cmd) return;

    const [name, ...args] = lower.split(/\s+/);

    switch (name) {
        case 'clear':
            output.innerHTML = '';
            return;
        case 'exit':
        case 'gui':
            termPrint('Switching to graphical interface…', 't-dim');
            setTimeout(closeTerminal, 400);
            return;
        case 'date':
            termPrint(new Date().toString());
            return;
        case 'hire':
            termPrint("<span class='t-accent'>Great choice.</span> Opening the contact form…");
            scrollToSection('contact');
            return;
        case 'theme': {
            const target = args[0] === 'light' || args[0] === 'dark' ? args[0] : (currentTheme() === 'dark' ? 'light' : 'dark');
            setTheme(target);
            termPrint(`Theme set to <span class='t-accent'>${target}</span>.`);
            return;
        }
        case 'project': {
            const n = parseInt(args[0], 10);
            if (n >= 1 && n <= siteData.projects.length) {
                termPrint(`Opening case study: <span class='t-accent'>${siteData.projects[n - 1].title}</span>…`);
                setTimeout(() => { closeTerminal(); openProject(n - 1); }, 400);
            } else {
                termPrint(`Usage: project &lt;1-${siteData.projects.length}&gt;`, 't-err');
            }
            return;
        }
        case 'open': {
            const section = sectionAliases[args[0]] || args[0];
            if (section && scrollToSection(section)) {
                termPrint(`&gt; Navigating to sector: [${section.toUpperCase()}]…`, 't-accent');
            } else {
                const err = document.createElement('div');
                err.className = 't-err';
                err.textContent = `> Error: Sector '${args[0] || ''}' not found.`;
                output.appendChild(err);
            }
            output.scrollTop = output.scrollHeight;
            return;
        }
        default:
            if (commands[name]) {
                termPrint(commands[name]);
            } else {
                const err = document.createElement('div');
                err.className = 't-err';
                err.textContent = `Command not found: ${cmd}. Type 'help' for a list.`;
                output.appendChild(err);
                output.scrollTop = output.scrollHeight;
            }
    }
}

const completions = ['help', 'about', 'services', 'experience', 'projects', 'project ', 'skills', 'education', 'contact', 'hire', 'theme', 'open ', 'whoami', 'date', 'clear', 'exit', 'sudo'];

input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const value = input.value;
        if (value.trim()) cmdHistory.push(value);
        historyIndex = cmdHistory.length;
        input.value = '';
        handleCommand(value);
    } else if (e.key === 'ArrowUp') {
        if (historyIndex > 0) input.value = cmdHistory[--historyIndex];
        e.preventDefault();
    } else if (e.key === 'ArrowDown') {
        if (historyIndex < cmdHistory.length - 1) input.value = cmdHistory[++historyIndex];
        else { historyIndex = cmdHistory.length; input.value = ''; }
        e.preventDefault();
    } else if (e.key === 'Tab') {
        e.preventDefault();
        const v = input.value.toLowerCase();
        const match = v && completions.find((c) => c.startsWith(v));
        if (match) input.value = match;
    }
});

// =========================================================
// GLOBAL KEYBOARD SHORTCUTS
// =========================================================
document.addEventListener('keydown', (e) => {
    const typing = /input|textarea|select/i.test(document.activeElement.tagName) && document.activeElement !== input;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        terminal.classList.contains('open') ? closeTerminal() : openTerminal();
        return;
    }
    if (e.key === '`' && !typing && !terminal.classList.contains('open')) {
        e.preventDefault();
        openTerminal();
        return;
    }
    if (e.key === 'Escape') {
        if (terminal.classList.contains('open')) closeTerminal();
        else if (modal.classList.contains('open')) closeProject();
        else if (mobileMenu.classList.contains('open')) toggleMobileMenu(false);
    }
    if (modal.classList.contains('open') && !typing) {
        if (e.key === 'ArrowRight') stepProject(1);
        if (e.key === 'ArrowLeft') stepProject(-1);
    }
});

// =========================================================
// BACKGROUND NETWORK CANVAS
// =========================================================
function updateCanvasColor() {
    const v = getComputedStyle(root).getPropertyValue('--particle').trim();
    if (v) particleRGB = v;
}

function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasW = window.innerWidth;
    canvasH = window.innerHeight;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = `${canvasW}px`;
    canvas.style.height = `${canvasH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

class Particle {
    constructor(x, y, burst = false) {
        this.x = x ?? Math.random() * canvasW;
        this.y = y ?? Math.random() * canvasH;
        const speed = burst ? 2.2 : 0.25;
        const angle = Math.random() * Math.PI * 2;
        const mag = burst ? speed * (0.4 + Math.random() * 0.6) : Math.random() * speed + 0.05;
        this.vx = Math.cos(angle) * mag;
        this.vy = Math.sin(angle) * mag;
        this.size = Math.random() * 1.6 + 1;
        this.burst = burst;
    }

    update() {
        if (this.x > canvasW || this.x < 0) this.vx = -this.vx;
        if (this.y > canvasH || this.y < 0) this.vy = -this.vy;

        // Gently push particles away from the cursor
        if (mouse.x !== null) {
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const dist = Math.hypot(dx, dy);
            if (dist < mouse.radius && dist > 0) {
                const force = (mouse.radius - dist) / mouse.radius;
                this.x += (dx / dist) * force * 2.2;
                this.y += (dy / dist) * force * 2.2;
            }
        }

        // Burst particles slow down to ambient speed
        if (this.burst) {
            this.vx *= 0.985;
            this.vy *= 0.985;
            if (Math.hypot(this.vx, this.vy) < 0.3) this.burst = false;
        }

        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${particleRGB}, 0.85)`;
        ctx.fill();
    }
}

let baseParticleCount = 0;
function initCanvas() {
    sizeCanvas();
    baseParticleCount = Math.min(110, Math.floor((canvasW * canvasH) / 14000));
    particles = Array.from({ length: baseParticleCount }, () => new Particle());
}

function connect() {
    const maxDist = 130;
    for (let a = 0; a < particles.length; a++) {
        const pa = particles[a];
        for (let b = a + 1; b < particles.length; b++) {
            const pb = particles[b];
            const dx = pa.x - pb.x;
            const dy = pa.y - pb.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < maxDist * maxDist) {
                const alpha = (1 - Math.sqrt(d2) / maxDist) * 0.45;
                ctx.strokeStyle = `rgba(${particleRGB}, ${alpha})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(pa.x, pa.y);
                ctx.lineTo(pb.x, pb.y);
                ctx.stroke();
            }
        }
        if (mouse.x !== null) {
            const md = Math.hypot(pa.x - mouse.x, pa.y - mouse.y);
            if (md < 170) {
                ctx.strokeStyle = `rgba(${particleRGB}, ${(1 - md / 170) * 0.5})`;
                ctx.beginPath();
                ctx.moveTo(pa.x, pa.y);
                ctx.lineTo(mouse.x, mouse.y);
                ctx.stroke();
            }
        }
    }
}

function drawCanvasFrame() {
    ctx.clearRect(0, 0, canvasW, canvasH);
    particles.forEach((p) => p.draw());
    connect();
}

function animateCanvas() {
    if (!canvasRunning) return;
    ctx.clearRect(0, 0, canvasW, canvasH);
    for (const p of particles) {
        p.update();
        p.draw();
    }
    connect();
    requestAnimationFrame(animateCanvas);
}

function startCanvas() {
    if (canvasRunning || reducedMotion) return;
    canvasRunning = true;
    requestAnimationFrame(animateCanvas);
}

window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
}, { passive: true });

document.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
});

// Click "eruption" on empty areas of the page
window.addEventListener('click', (e) => {
    if (reducedMotion) return;
    if (e.target.closest('a, button, input, textarea, select, label, .modal, .terminal-overlay, .card')) return;
    for (let i = 0; i < 10; i++) particles.push(new Particle(e.clientX, e.clientY, true));
    if (particles.length > baseParticleCount + 50) particles.splice(baseParticleCount, 10);
});

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        initCanvas();
        if (reducedMotion) drawCanvasFrame();
    }, 200);
});

// Pause the animation when the tab is hidden to save battery
document.addEventListener('visibilitychange', () => {
    if (document.hidden) canvasRunning = false;
    else startCanvas();
});

// =========================================================
// BOOT
// =========================================================
async function init() {
    updateCanvasColor();
    initCanvas();
    if (reducedMotion) drawCanvasFrame();
    else startCanvas();

    const bootDone = runPreloader();
    const data = await loadData();

    if (data) {
        siteData = data;
        commands = buildCommands(data);
        renderWebsite(data);
        initContactForm();
        initCopyEmail();
        initLocalTime();
        initReadMore();
        initProjects();
        initPointerEffects();
        initNavScroll();
        setupAnimations();
        initCounters();
    } else {
        renderError();
    }

    await bootDone;
    playIntro();
    initRoleTyper();
}

init();
