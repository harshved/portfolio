gsap.registerPlugin(ScrollTrigger);

// SYSTEM BOOT SEQUENCE (Preloader)
function startBootSequence() {
    const bootText = document.getElementById('boot-text');
    const preloader = document.getElementById('preloader');

    // The "Hacker" boot messages
    const messages = [
        "INITIALIZING HV-OS KERNEL v4.0...",
        "LOADING SECURITY MODULES...",
        "MOUNTING FILE SYSTEM...",
        "CHECKING INTEGRITY... [OK]",
        "ESTABLISHING SECURE CONNECTION...",
        "ACCESS GRANTED."
    ];

    let i = 0;

    function typeMessage() {
        if (i < messages.length) {
            // Add a new line
            const p = document.createElement('div');
            p.textContent = `> ${messages[i]}`;
            bootText.appendChild(p);

            // Random typing speed (fast)
            const delay = Math.random() * 200 + 100;
            i++;
            setTimeout(typeMessage, delay);
        } else {
            // FINISHED: Fade out preloader and start site
            setTimeout(() => {
                preloader.style.transition = "opacity 0.5s ease";
                preloader.style.opacity = "0";

                setTimeout(() => {
                    preloader.style.display = "none";
                    // NOW load the actual website data
                    loadData();
                }, 500);
            }, 800);
        }
    }

    // Start the sequence
    typeMessage();
}

// DATA LOADING
async function loadData() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        renderWebsite(data);
    } catch (error) { console.error('Error:', error); }
}

function renderWebsite(data) {
    const app = document.getElementById('app');

    // -- HERO --
    const headerHTML = `
        <section id="about" class="hero">
            <div class="status">${data.header.status}</div>
            <h1>${data.header.fullName}</h1>
            <h2 style="font-size: 1.5rem; color: var(--text-muted); border: none; padding: 0; margin-top: 10px;">${data.header.tagline}</h2>
            <p style="max-width: 600px; margin-top: 20px; font-size: 1.1rem; line-height: 1.8;">${data.header.bio}</p>
        </section>
    `;

    // -- AVAILABILITY BANNER --
    let freelanceHTML = '';
    if (data.freelance && data.freelance.available) {
        freelanceHTML = `
            <section id="freelance" style="padding-top: 20px; padding-bottom: 20px;">
                <div class="freelance-box">
                    <h3 style="color: var(--accent); margin-bottom: 10px;">
                        <i class="fas fa-satellite-dish"></i> ${data.freelance.title}
                    </h3>
                    <p style="font-size: 1.1rem; color: #e2e8f0; margin-bottom: 20px;">
                        ${data.freelance.text}
                    </p>
                    <div style="display:flex; justify-content:center; gap: 20px;">
                        <a href="#contact" class="btn-glow">Get In Touch</a>
                    </div>
                </div>
            </section>
        `;
    }

    // -- SKILLS (Chips) --
    let skillsHTML = `<section id="skills"><h2>Skils</h2><div class="skills-grid">`;
    for (const [category, skills] of Object.entries(data.skills)) {
        skillsHTML += `
            <div class="skill-card">
                <h3 style="color: var(--accent); margin-bottom: 15px; font-size: 1.1rem;">${category.replace('_', ' ')}</h3>
                <div>${skills.map(s => `<span class="tag">${s}</span>`).join('')}</div>
            </div>`;
    }
    skillsHTML += `</div></section>`;

    // -- EXPERIENCE --
    let expHTML = `<section id="experience"><h2>Work History</h2><div class="timeline">`;
    if (data.experience) {
        data.experience.forEach(exp => {
            expHTML += `
                <div class="timeline-item">
                    <div style="color: var(--accent); font-family: var(--font-code); margin-bottom: 5px;">${exp.dates}</div>
                    <h3 style="font-size: 1.4rem;">${exp.role}</h3>
                    <span style="color: var(--text-muted);">@ ${exp.company}</span>
                    <p style="margin-top: 10px; color: var(--text-muted);">${exp.description}</p>
                </div>`;
        });
    }
    expHTML += `</div></section>`;

    // -- EDUCATION --
    let eduHTML = `<section id="education"><h2>Education</h2>`;

    let tabButtons = `<div class="tab-list">`;
    let tabContent = `<div class="tab-content">`;

    if (data.education) {
        data.education.forEach((edu, index) => {
            const isActive = index === 0 ? 'active' : ''; // Make first one active by default
            // Left side buttons
            tabButtons += `<button class="tab-btn ${isActive}" onclick="switchTab(event, '${edu.id}')">${edu.school}</button>`;
            // Right side content
            tabContent += `
                <div id="${edu.id}" class="tab-panel ${isActive}">
                    <h3 class="degree-title">${edu.degree}</h3>
                    <span class="degree-meta">${edu.date}</span>
                    <p>${edu.description}</p>
                </div>
            `;
        });
    }
    tabButtons += `</div>`;
    tabContent += `</div>`;
    // Combine into container
    eduHTML += `<div class="tabs-container">${tabButtons + tabContent}</div></section>`;

    // -- PROJECTS --
    let projHTML = `<section id="projects"><h2>Projects</h2><div class="projects-container">`;
    data.projects.forEach((proj, index) => {
        projHTML += `
            <div class="project-card" onclick="toggleProject(this)">
                <div class="project-header">
                    <div>
                        <span style="color: var(--accent); font-size: 0.8rem;">${proj.techStack.join(' / ')}</span>
                        <h3 class="project-title">${proj.title}</h3>
                        <p style="font-size: 0.9rem; color: #888;">${proj.summary}</p>
                    </div>
                    <i class="fas fa-chevron-down project-arrow"></i>
                </div>
                <div class="project-details">
                    <p><strong>Analysis:</strong> ${proj.details}</p>
                </div>
            </div>`;
    });
    projHTML += `</div></section>`;

    // -- CONTACT --
    const contactHTML = `
        <section id="contact" style="text-align: center; margin-bottom: 50px;">
            <h2>Initialize Handshake</h2>
            <p style="margin-bottom: 40px; font-size: 1.1rem; color: #e2e8f0;">
                Ready to build something secure? Send me a direct transmission.
            </p>

            <form id="contact-form" class="glass-form">
                
                <input type="hidden" name="access_key" value="23a50f78-a124-4ecb-8de3-3cf6be130d5a">

                <div class="form-group">
                    <input type="text" name="name" placeholder="Name / Organization" required>
                </div>
                <div class="form-group">
                    <input type="email" name="email" placeholder="Email Address" required>
                </div>
                <div class="form-group">
                    <textarea name="message" placeholder="Message Payload..." rows="5" required></textarea>
                </div>
                
                <input type="checkbox" name="botcheck" class="hidden" style="display: none;">

                <button type="submit" class="btn-glow" style="width: 100%; border: none; cursor: pointer;">TRANSMIT DATA</button>
                <div id="form-result" style="margin-top: 20px; font-weight: bold; min-height: 25px; font-family: var(--font-code);"></div>
            </form>

            <div class="social-connect" style="margin-top: 60px;">
                <p style="color: var(--text-muted); margin-bottom: 20px; font-family: var(--font-code);">// OR CONNECT VIA SOCIAL</p>
                <div class="social-icons">
                    ${data.contact.social.map(s => `
                        <a href="${s.url}" target="_blank" class="social-btn">
                            <i class="${s.icon}"></i>
                        </a>
                    `).join('')}
                </div>
            </div>
        </section>
    `;

    app.innerHTML = headerHTML + freelanceHTML + skillsHTML + expHTML + eduHTML + projHTML + contactHTML;
    document.getElementById('year').textContent = new Date().getFullYear();

    // FORM HANDLING LOGIC (AJAX)
    const form = document.getElementById('contact-form');
    const result = document.getElementById('form-result');

    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault(); // Stop page reload

            // Show "Sending..." status
            result.textContent = "Establishing uplink...";
            result.style.color = "#fff";

            const formData = new FormData(form);
            const object = Object.fromEntries(formData);
            const json = JSON.stringify(object);

            fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: json
            })
                .then(async (response) => {
                    let json = await response.json();
                    if (response.status == 200) {
                        // SUCCESS
                        result.innerHTML = "Transmission Sent Successfully. Stand by.";
                        result.style.color = "#22c55e"; // Matrix Green
                        form.reset(); // Clear the inputs
                    } else {
                        // ERROR
                        console.log(response);
                        result.innerHTML = json.message;
                        result.style.color = "#ef4444"; // Red
                    }
                })
                .catch(error => {
                    console.log(error);
                    result.innerHTML = "Transmission Failed. Please try again.";
                    result.style.color = "#ef4444";
                })
                .then(function () {
                    // Remove message after 5 seconds (Optional)
                    setTimeout(() => {
                        result.style.opacity = "0"; // You'd need CSS transition for this to fade
                        result.textContent = "";
                        result.style.opacity = "1";
                    }, 5000);
                });
        });
    }

    // GSAP Fade In
    gsap.utils.toArray("section").forEach(section => {
        gsap.from(section, {
            scrollTrigger: { trigger: section, start: "top 85%" },
            y: 30, opacity: 0, duration: 0.6
        });
    });
}

// TAB SWITCHING LOGIC FOR EDUCATION
window.switchTab = function (event, tabId) {
    // Remove active class from all buttons
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    // Add active class to clicked button
    event.currentTarget.classList.add('active');

    // Hide all tab panels
    const panels = document.querySelectorAll('.tab-panel');
    panels.forEach(panel => panel.classList.remove('active'));

    // Show the specific panel
    document.getElementById(tabId).classList.add('active');
}

// PROJECT TOGGLE FUNCTION
window.toggleProject = function (element) {
    // Close others
    document.querySelectorAll('.project-card').forEach(el => {
        if (el !== element) el.classList.remove('active');
    });
    // Toggle current
    element.classList.toggle('active');
};


// CANVAS ANIMATION NEURAL NETWORK
const canvas = document.getElementById('network-canvas');
const ctx = canvas.getContext('2d');
let particlesArray;

// Mouse Interaction Object
let mouse = {
    x: null,
    y: null,
    radius: 150 // The range within which dots connect to mouse
};

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('mousemove', function (e) {
    mouse.x = e.x;
    mouse.y = e.y;
});

// CLICK INTERACTION: "Eruption" Effect
window.addEventListener('click', function (e) {
    // Create 8 new particles at mouse position that move faster
    for (let i = 0; i < 8; i++) {
        particlesArray.push(new Particle(e.x, e.y, true)); // true = is an explosion particle
    }
    // Prevent array from getting too big (performance)
    if (particlesArray.length > 150) {
        particlesArray.splice(0, 8);
    }
});

// Handle resize
window.addEventListener('resize', () => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    initCanvas();
});

// Particle Class
class Particle {
    constructor(x, y, isExplosion = false) {
        this.x = x || Math.random() * canvas.width;
        this.y = y || Math.random() * canvas.height;

        // If it's a click explosion, make it faster
        const speed = isExplosion ? 1 : 0.2;

        this.directionX = (Math.random() * speed * 2) - speed;
        this.directionY = (Math.random() * speed * 2) - speed;
        this.size = (Math.random() * 2) + 1; // Random size
        this.color = '#22c55e';
    }

    // Method to draw individual particle
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    // Check particle position, check mouse position, move particle, draw particle
    update() {
        // Boundary check (bounce off walls)
        if (this.x > canvas.width || this.x < 0) this.directionX = -this.directionX;
        if (this.y > canvas.height || this.y < 0) this.directionY = -this.directionY;

        // Mouse Interactivity (Collision Detection)
        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        // If mouse is close, push particle slightly
        if (distance < mouse.radius + this.size) {
            if (mouse.x < this.x && this.x < canvas.width - this.size * 10) {
                this.x += 2;
            }
            if (mouse.x > this.x && this.x > this.size * 10) {
                this.x -= 2;
            }
            if (mouse.y < this.y && this.y < canvas.height - this.size * 10) {
                this.y += 2;
            }
            if (mouse.y > this.y && this.y > this.size * 10) {
                this.y -= 2;
            }
        }

        // Move particle
        this.x += this.directionX;
        this.y += this.directionY;

        this.draw();
    }
}

// Create particle array
function initCanvas() {
    particlesArray = [];
    let numberOfParticles = (canvas.height * canvas.width) / 12000; // Density
    for (let i = 0; i < numberOfParticles; i++) {
        particlesArray.push(new Particle());
    }
}

// Animation Loop
function animateCanvas() {
    requestAnimationFrame(animateCanvas);
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
    }
    connect();
}

// Draw lines between particles AND mouse
function connect() {
    let opacityValue = 1;
    for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a; b < particlesArray.length; b++) {
            let distance = ((particlesArray[a].x - particlesArray[b].x) * (particlesArray[a].x - particlesArray[b].x))
                + ((particlesArray[a].y - particlesArray[b].y) * (particlesArray[a].y - particlesArray[b].y));

            // Connect dots to each other
            if (distance < (canvas.width / 7) * (canvas.height / 7)) {
                opacityValue = 1 - (distance / 20000);
                ctx.strokeStyle = 'rgba(34, 197, 94,' + opacityValue + ')';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                ctx.stroke();
            }
        }

        // Connect dots to MOUSE
        let mouseDistance = ((particlesArray[a].x - mouse.x) * (particlesArray[a].x - mouse.x))
            + ((particlesArray[a].y - mouse.y) * (particlesArray[a].y - mouse.y));

        if (mouseDistance < 20000) { // Mouse connection range
            ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)'; // Slightly transparent green
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
        }
    }
}

// Start animation
initCanvas();
animateCanvas();

// Reset mouse position when leaving window so dots don't get stuck to edge
window.addEventListener('mouseout', () => {
    mouse.x = undefined;
    mouse.y = undefined;
});

// Mobile Menu Toggle
const hamburger = document.getElementById('hamburger-btn');
const mobileMenu = document.getElementById('mobile-menu');

hamburger.addEventListener('click', () => {
    toggleMobileMenu();
});

function toggleMobileMenu() {
    mobileMenu.classList.toggle('hidden');
    // Change icon based on state
    const icon = hamburger.querySelector('i');
    if (mobileMenu.classList.contains('hidden')) {
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    } else {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
    }
}

// TERMINAL GAME
const modal = document.getElementById('terminal-overlay');
const openBtn = document.getElementById('open-terminal');
const closeBtn = document.getElementById('close-terminal');
const input = document.getElementById('cmd-input');
const output = document.getElementById('terminal-output');

openBtn.addEventListener('click', () => { modal.classList.remove('hidden'); input.focus(); });
closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

input.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        const cmd = this.value.toLowerCase().trim();
        this.value = '';
        printLine(`➜ ~ ${cmd}`, 'white');
        processCommand(cmd);
    }
});

function printLine(text, color = '#22c55e') {
    const p = document.createElement('p');
    p.textContent = text;
    p.style.color = color;
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;
}

function processCommand(cmd) {
    switch (cmd) {
        case 'help':
            printLine('Available commands: help, whoami, skills, contact, clear, exit');
            break;
        case 'whoami':
            printLine('Harsh Ved. Architect. Hacker. Builder.');
            break;
        case 'skills':
            printLine('Loaded Modules: React, Python, AWS, Docker, Security Analysis.');
            break;
        case 'contact':
            printLine('Opening mail client...');
            window.location.href = "mailto:harshved3@gmail.com";
            break;
        case 'clear':
            output.innerHTML = '';
            break;
        case 'exit':
            modal.classList.add('hidden');
            break;
        default:
            printLine(`Command not found: ${cmd}. Try 'help'.`, 'red');
    }
}

startBootSequence();