class CustomNavbar extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }
    connectedCallback() {
        this.shadowRoot.innerHTML = `
        <style>
        :host {
            display: block;
            margin-left: -8px;
            margin-right: -8px;
            margin-top: -8px;
            width: calc(100% + 16px);
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        .navbar {
            background-color: #0052a7;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 1.5rem;
            height: 60px;
            position: relative;
        }
        .navbar-home {
            color: #ffffff;
            text-decoration: none;
            font-weight: bold;
            font-size: 20px;
        }
        .navbar-links {
            z-index: 0;
            display: flex;
            list-style: none;
            gap: 1rem;
            position: static;
        }
        .navbar-links a {
            color: #ffffff;
            text-decoration: none;
            font-size: 1rem;
            padding: 0.5rem 0.8rem;
            border-radius: 4px;
            transition: background-color 0.2s ease;
            white-space: nowrap;
        }
        .navbar-links a:hover {
            background-color: rgba(255, 255, 255, 0.2);
        }
        .navbar-toggle {
            display: none;
            background: none;
            border: none;
            color: #ffffff;
            font-size: 1.8rem;
            cursor: pointer;
        }
        .navbar-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.5);
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        @media (max-width: 840px) {
            .navbar-toggle {
            display: block;
            }
            .navbar-links {
            z-index: 1;
            position: fixed;
            top: 0;
            left: -250px;
            width: 250px;
            height: 100vh;
            background-color: #003d80;
            flex-direction: column;
            padding-top: 4rem;
            gap: 0;
            transition: left 0.3s ease;
            overflow-y: auto;
            direction: rtl;
            box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
            }
            .navbar-links a {
            direction: ltr;
            text-align: left;
            color: #ffffff;
            display: block;
            padding: 1rem 1.5rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 0;
            }
            .navbar-links.active {
            left: 0;
            }
            .navbar-overlay.active {
            opacity: 1;
            visibility: visible;
            }
        }
        </style>
        <nav class="navbar">
        <a href="index.html" class="navbar-home">ETA Live</a>
        <button class="navbar-toggle" id="navToggle" aria-label="Toggle menu">&#9776;</button>
        <ul class="navbar-links" id="navLinks">
            <li><a href="kmb.html">KMB</a></li>
            <li><a href="ctb.html">CTB</a></li>
            <li><a href="settings.html">Settings</a></li>
        </ul>
        </nav>
        <div class="navbar-overlay" id="navOverlay"></div>
        `;
        this.initNavbar();
    }
    initNavbar() {
        const toggleBtn = this.shadowRoot.getElementById('navToggle');
        const navLinks = this.shadowRoot.getElementById('navLinks');
        const overlay = this.shadowRoot.getElementById('navOverlay');
        function toggleMenu() {
            navLinks.classList.toggle('active');
            overlay.classList.toggle('active');
        }
        if (toggleBtn && overlay) {
            toggleBtn.addEventListener('click', toggleMenu);
            overlay.addEventListener('click', toggleMenu);
        }
    }
}
customElements.define('app-navbar', CustomNavbar);