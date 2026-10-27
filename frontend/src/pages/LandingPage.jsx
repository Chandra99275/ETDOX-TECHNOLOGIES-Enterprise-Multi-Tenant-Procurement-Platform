
import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Menu,
  X,
  FileText,
  CheckCircle2,
  Users,
  ShoppingCart,
  Receipt,
  ChartNoAxesCombined,
  LockKeyhole,
  Boxes,
  ChevronRight,
  Play,
  Globe2,
  Workflow,
  Building2,
  Sparkles,
  TrendingUp,
  CircleDollarSign,
  Clock3,
  BadgeCheck,
} from "lucide-react";
import { useState } from "react";
import "./LandingPage.css";

const features = [
  {
    icon: FileText,
    number: "01",
    title: "Purchase Requests",
    description:
      "Create, submit and track purchase requests through one organized workspace.",
    color: "cyan",
  },
  {
    icon: Workflow,
    number: "02",
    title: "Approval Workflows",
    description:
      "Move requests through structured approval stages with clear accountability.",
    color: "violet",
  },
  {
    icon: Users,
    number: "03",
    title: "Supplier Management",
    description:
      "Organize supplier profiles, contacts, purchasing activity and relationships.",
    color: "blue",
  },
  {
    icon: ShoppingCart,
    number: "04",
    title: "Purchase Orders",
    description:
      "Turn approved requests into purchase orders with traceable records.",
    color: "orange",
  },
  {
    icon: Receipt,
    number: "05",
    title: "Invoice Management",
    description:
      "Keep invoices, receipts and payment status organized in one place.",
    color: "pink",
  },
  {
    icon: ChartNoAxesCombined,
    number: "06",
    title: "Spend Intelligence",
    description:
      "Understand spending patterns and make decisions with procurement analytics.",
    color: "green",
  },
];

const benefits = [
  "Organization-level data separation",
  "Role-based access control",
  "Configurable approval processes",
  "Centralized procurement records",
  "Spend visibility and reporting",
];

const stats = [
  { value: "01", label: "Unified workspace" },
  { value: "360°", label: "Spend visibility" },
  { value: "24/7", label: "Access to your records" },
  { value: "∞", label: "Room to scale" },
];

function Brand() {
  return (
    <Link to="/" className="etdox-brand" aria-label="ETDOX home">
      <span className="brand-symbol">
        <span />
        <span />
        <span />
      </span>

      <span className="brand-copy">
        <strong>ETDOX</strong>
        <small>TECHNOLOGIES</small>
      </span>
    </Link>
  );
}

function DashboardPreview() {
  return (
    <div className="dashboard-scene">
      <div className="scene-glow scene-glow-one" />
      <div className="scene-glow scene-glow-two" />

      <div className="floating-chip chip-security">
        <span className="chip-icon">
          <ShieldCheck size={23} />
        </span>
        <span>
          <strong>Secure access</strong>
          <small>Protected workspace</small>
        </span>
      </div>

      <div className="floating-chip chip-analytics">
        <span className="chip-icon">
          <TrendingUp size={22} />
        </span>
        <span>
          <strong>Spend intelligence</strong>
          <small>Clearer decisions</small>
        </span>
      </div>

      <div className="preview-window">
        <aside className="preview-sidebar">
          <div className="preview-brand">
            <span className="mini-logo">E</span>
            <strong>ETDOX</strong>
          </div>

          <div className="preview-nav active">
            <ChartNoAxesCombined size={15} />
            Dashboard
          </div>
          <div className="preview-nav">
            <FileText size={15} />
            Requests
          </div>
          <div className="preview-nav">
            <CheckCircle2 size={15} />
            Approvals
          </div>
          <div className="preview-nav">
            <Users size={15} />
            Suppliers
          </div>
          <div className="preview-nav">
            <ShoppingCart size={15} />
            Orders
          </div>
          <div className="preview-nav">
            <Receipt size={15} />
            Invoices
          </div>
        </aside>

        <div className="preview-content">
          <div className="preview-topbar">
            <div>
              <span className="preview-eyebrow">WORKSPACE OVERVIEW</span>
              <h3>Your procurement, in focus.</h3>
              <p>Here's a snapshot of your business activity.</p>
            </div>

            <div className="preview-avatar">A</div>
          </div>

          <div className="preview-stats">
            <div className="preview-stat">
              <span className="stat-icon stat-cyan">
                <FileText size={16} />
              </span>
              <small>Requests</small>
              <strong>128</strong>
              <span className="stat-trend">Workspace preview</span>
            </div>

            <div className="preview-stat">
              <span className="stat-icon stat-violet">
                <Clock3 size={16} />
              </span>
              <small>Pending approvals</small>
              <strong>24</strong>
              <span className="stat-neutral">Awaiting review</span>
            </div>

            <div className="preview-stat">
              <span className="stat-icon stat-blue">
                <Users size={16} />
              </span>
              <small>Suppliers</small>
              <strong>36</strong>
              <span className="stat-trend">Supplier directory</span>
            </div>
          </div>

          <div className="preview-lower">
            <div className="spend-panel">
              <div className="panel-heading">
                <div>
                  <strong>Spend overview</strong>
                  <small>Illustrative visualization</small>
                </div>
                <span className="period-label">Overview</span>
              </div>

              <div className="chart-area">
                <div className="chart-y-labels">
                  <span>100</span>
                  <span>75</span>
                  <span>50</span>
                  <span>25</span>
                  <span>0</span>
                </div>

                <svg
                  className="spend-chart"
                  viewBox="0 0 360 150"
                  role="img"
                  aria-label="Illustrative procurement spending trend"
                >
                  <defs>
                    <linearGradient
                      id="spendFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#23d9c3"
                        stopOpacity=".25"
                      />
                      <stop
                        offset="100%"
                        stopColor="#23d9c3"
                        stopOpacity="0"
                      />
                    </linearGradient>
                  </defs>

                  {[20, 50, 80, 110, 140].map((y) => (
                    <line
                      key={y}
                      x1="0"
                      y1={y}
                      x2="360"
                      y2={y}
                      stroke="#dfe7f2"
                      strokeDasharray="4 5"
                    />
                  ))}

                  <path
                    d="M0 116 L36 98 L72 104 L108 77 L144 91 L180 55 L216 68 L252 42 L288 54 L324 23 L360 33 L360 150 L0 150 Z"
                    fill="url(#spendFill)"
                  />

                  <path
                    d="M0 116 L36 98 L72 104 L108 77 L144 91 L180 55 L216 68 L252 42 L288 54 L324 23 L360 33"
                    fill="none"
                    stroke="#13bfae"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <path
                    d="M0 132 L36 120 L72 113 L108 124 L144 99 L180 106 L216 87 L252 92 L288 73 L324 82 L360 61"
                    fill="none"
                    stroke="#8072f6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="5 5"
                  />
                </svg>
              </div>

              <div className="chart-months">
                <span>Jan</span>
                <span>Mar</span>
                <span>May</span>
                <span>Jul</span>
                <span>Sep</span>
                <span>Dec</span>
              </div>
            </div>

            <div className="category-panel">
              <strong>Spend categories</strong>
              <small>Illustrative breakdown</small>

              <div className="donut-wrap">
                <div className="donut-chart">
                  <div>
                    <strong>100%</strong>
                    <small>Overview</small>
                  </div>
                </div>
              </div>

              <div className="category-legend">
                <span><i className="legend-cyan" />Technology</span>
                <span><i className="legend-violet" />Operations</span>
                <span><i className="legend-blue" />Services</span>
              </div>
            </div>
          </div>

          <div className="preview-footnote">
            <span className="online-dot" />
            Dashboard concept · Sample data
          </div>
        </div>
      </div>

      <div className="floating-chip chip-tenant">
        <LockKeyhole size={19} />
        <span>
          <strong>Tenant-aware design</strong>
          <small>Organization boundaries</small>
        </span>
      </div>
    </div>
  );
}

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const handleDemo = () => {
    document.getElementById("platform")?.scrollIntoView({
      behavior: "smooth",
    });
  };

  return (
    <main className="etdox-landing">
      <header className="etdox-header">
        <div className="header-inner">
          <Brand />

          <button
            className="mobile-menu-button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>

          <nav className={`main-nav ${menuOpen ? "nav-open" : ""}`}>
            <a className="nav-link active" href="#home" onClick={closeMenu}>
              Home
            </a>
            <a className="nav-link" href="#features" onClick={closeMenu}>
              Features
            </a>
            <a className="nav-link" href="#platform" onClick={closeMenu}>
              Platform
            </a>
            <a className="nav-link" href="#about" onClick={closeMenu}>
              About
            </a>
            <a className="nav-link" href="#contact" onClick={closeMenu}>
              Contact
            </a>

            <div className="mobile-nav-actions">
              <Link
                to="/login"
                className="button button-outline"
                onClick={closeMenu}
              >
                Log in
              </Link>
              <Link
                to="/dashboard"
                className="button button-primary"
                onClick={closeMenu}
              >
                Get started <ArrowRight size={17} />
              </Link>
            </div>
          </nav>

          <div className="header-actions">
  <Link
    to="/login"
    className="header-login"
    onClick={closeMenu}
  >
    Log in
  </Link>

  <Link
    to="/login"
    className="button button-primary header-cta"
    onClick={closeMenu}
  >
    Get started <ArrowUpRight size={16} />
  </Link>
</div>
        </div>
      </header>

      <section className="hero-section" id="home">
        <div className="hero-orb hero-orb-one" />
        <div className="hero-orb hero-orb-two" />
        <div className="hero-grid" />

        <div className="hero-container">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-line" />
              <Sparkles size={15} />
              SMART PROCUREMENT. STRONGER BUSINESS.
            </div>

            <h1>
              Enterprise procurement,
              <span className="gradient-text"> reimagined.</span>
            </h1>

            <p className="hero-description">
              Bring purchase requests, suppliers, approvals and spending
              into one connected workspace. Give your organization the
              clarity and control to move business forward.
            </p>

            <div className="hero-actions">
              <Link to="/dashboard" className="button button-primary hero-cta">
                Explore the platform
                <ArrowRight size={18} />
              </Link>

              <button
                type="button"
                className="button button-watch"
                onClick={handleDemo}
              >
                <span className="play-icon">
                  <Play size={13} fill="currentColor" />
                </span>
                Discover ETDOX
              </button>
            </div>

            <div className="hero-assurances">
              <span><CheckCircle2 size={17} /> Organized workflows</span>
              <span><CheckCircle2 size={17} /> Access controls</span>
              <span><CheckCircle2 size={17} /> Built to scale</span>
            </div>

            <div className="hero-proof">
              <div className="proof-avatars">
                <span>E</span>
                <span>T</span>
                <span>D</span>
              </div>
              <div>
                <strong>One connected workspace</strong>
                <small>Designed for modern business teams</small>
              </div>
            </div>
          </div>

          <DashboardPreview />
        </div>

        <div className="hero-bottom">
          <span>PROCUREMENT</span>
          <span className="hero-bottom-line" />
          <span>VISIBILITY</span>
          <span className="hero-bottom-line" />
          <span>CONTROL</span>
          <span className="hero-bottom-line" />
          <span>GROWTH</span>
        </div>
      </section>

      <section className="stats-strip" aria-label="Platform principles">
        <div className="stats-inner">
          {stats.map((item) => (
            <div className="stat-item" key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="features-section section-light" id="features">
        <div className="section-container">
          <div className="section-heading">
            <div className="eyebrow light-eyebrow">
              <span className="eyebrow-line" />
              THE ETDOX ECOSYSTEM
            </div>

            <h2>
              Everything connected.
              <span className="light-gradient-text"> Nothing overlooked.</span>
            </h2>

            <p>
              Replace disconnected processes with a procurement experience
              built around visibility, accountability and simplicity.
            </p>
          </div>

          <div className="features-grid">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  className={`feature-card feature-${feature.color}`}
                  key={feature.number}
                >
                  <div className="feature-top">
                    <div className="feature-icon">
                      <Icon size={23} strokeWidth={1.8} />
                    </div>
                    <span className="feature-number">{feature.number}</span>
                  </div>

                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>

                  <a href="#platform" className="feature-link">
                    Discover capability <ArrowUpRight size={16} />
                  </a>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="platform-section" id="platform">
        <div className="platform-glow" />

        <div className="platform-container">
          <div className="platform-copy" id="about">
            <div className="eyebrow">
              <span className="eyebrow-line" />
              BUILT FOR ENTERPRISE
            </div>

            <h2>
              More than procurement.
              <span className="gradient-text"> It's business control.</span>
            </h2>

            <p>
              ETDOX brings your procurement activities into a structured
              environment, helping teams understand requests, track
              decisions and maintain a clearer record of spending.
            </p>

            <div className="benefit-list">
              {benefits.map((benefit) => (
                <div key={benefit} className="benefit-item">
                  <CheckCircle2 size={19} />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            <Link to="/dashboard" className="button button-primary platform-cta">
              Explore the workspace <ArrowRight size={17} />
            </Link>
          </div>

          <div className="platform-visual">
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />

            <div className="visual-card visual-card-back">
              <div className="visual-card-heading">
                <span className="visual-mini-icon">
                  <CircleDollarSign size={17} />
                </span>
                <span>Spend overview</span>
              </div>

              <div className="visual-bars">
                {[36, 56, 43, 75, 62, 88, 69, 96, 78, 61].map(
                  (height, index) => (
                    <div
                      key={index}
                      style={{ height: `${height}%` }}
                      className={index % 3 === 0 ? "bar-accent" : ""}
                    />
                  )
                )}
              </div>

              <div className="visual-legend">
                <span><i /> Monthly activity</span>
                <span>Illustrative data</span>
              </div>
            </div>

            <div className="visual-card visual-card-front">
              <div className="visual-card-heading">
                <span className="visual-mini-icon violet-mini">
                  <BadgeCheck size={17} />
                </span>
                <span>Approval activity</span>
                <span className="visual-live">Overview</span>
              </div>

              <div className="approval-row">
                <span className="approval-dot approval-dot-green" />
                <div>
                  <strong>Purchase request</strong>
                  <small>Review workflow</small>
                </div>
                <span className="approval-status">Approved</span>
              </div>

              <div className="approval-row">
                <span className="approval-dot approval-dot-violet" />
                <div>
                  <strong>Supplier order</strong>
                  <small>Procurement workflow</small>
                </div>
                <span className="approval-status status-review">In review</span>
              </div>

              <div className="approval-row">
                <span className="approval-dot approval-dot-blue" />
                <div>
                  <strong>Invoice record</strong>
                  <small>Finance workflow</small>
                </div>
                <span className="approval-status">Tracked</span>
              </div>
            </div>

            <div className="platform-floating platform-floating-top">
              <LockKeyhole size={20} />
              <span>
                <strong>Access control</strong>
                <small>Role-aware workflows</small>
              </span>
            </div>

            <div className="platform-floating platform-floating-bottom">
              <Zap size={19} />
              <span>
                <strong>One workspace</strong>
                <small>Connected processes</small>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="security-section section-light">
        <div className="security-container">
          <div className="security-icon">
            <ShieldCheck size={32} />
          </div>

          <div className="security-copy">
            <span className="security-kicker">DESIGNED WITH CONTROL IN MIND</span>
            <h2>Your data. Your organization. Your rules.</h2>
            <p>
              Build your procurement workflow around appropriate permissions,
              organization boundaries and accountable business processes.
            </p>
          </div>

          <div className="security-points">
            <div><LockKeyhole size={17} /> Permission-aware access</div>
            <div><Building2 size={17} /> Organization separation</div>
            <div><Globe2 size={17} /> Flexible business workflows</div>
          </div>
        </div>
      </section>

      <section className="cta-section" id="contact">
        <div className="cta-glow" />

        <div className="cta-content">
          <div className="cta-icon"><Boxes size={27} /></div>

          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              YOUR NEXT CHAPTER STARTS HERE
            </div>

            <h2>
              Bring your procurement
              <span className="gradient-text"> into focus.</span>
            </h2>

            <p>
              Explore a more connected way to manage purchasing, approvals
              and supplier relationships.
            </p>
          </div>

          <Link to="/dashboard" className="button button-primary cta-button">
            Get started <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="etdox-footer">
        <div className="footer-main">
          <div className="footer-brand-column">
            <Brand />
            <p>
              A connected procurement workspace for organizations
              that value clarity, accountability and growth.
            </p>
          </div>

          <div className="footer-links-column">
            <strong>Platform</strong>
            <a href="#features">Features</a>
            <a href="#platform">How it works</a>
            <a href="#about">About ETDOX</a>
          </div>

          <div className="footer-links-column">
            <strong>Workspaces</strong>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/login">Employee login</Link>
            <Link to="/login">Administrator login</Link>
          </div>

          <div className="footer-links-column">
            <strong>Get in touch</strong>
            <a href="mailto:contact@etdox.com">Email ETDOX</a>
            <a href="#contact">Contact</a>
            <a href="#home">Back to top ↑</a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} ETDOX Technologies.</span>
          <span>Built for connected business operations.</span>
          <a href="#home">Privacy-conscious by design</a>
        </div>
      </footer>
    </main>
  );
}

export default LandingPage;
