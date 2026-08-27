import Head from "next/head";
import Link from "next/link";

const ArrowIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

const PulseIcon = () => (
  <div className="logo-mark">
    <span />
    <span />
    <span />
    <span />
  </div>
);

export default function Home() {
  return (
    <>
      <Head>
        <title>ClassPulse — Understand Your Class Better</title>
        <meta
          name="description"
          content="ClassPulse turns attendance and academic data into clear, actionable insights."
        />
      </Head>

      <main className="landing-page">
        {/* Background decorations */}
        <div className="shape shape-yellow" />
        <div className="shape shape-blue" />
        <div className="shape shape-red" />

        <nav className="navbar">
          <Link href="/" className="brand">
            <PulseIcon />
            <span>class<span>pulse</span></span>
          </Link>

          <div className="nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
          </div>

          <Link href="/login" className="nav-login">
            Log in
          </Link>
        </nav>

        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              SMART CLASS ANALYTICS
            </div>

            <h1>
              Your class has a
              <span className="highlight-blue"> story.</span>
              <br />
              We help you
              <span className="highlight-yellow"> see it.</span>
            </h1>

            <p>
              Turn attendance and academic data into clear insights.
              Spot trends, understand students, and make better decisions
              without getting lost in spreadsheets.
            </p>

            <div className="hero-actions">
              <Link href="/login" className="primary-button">
                Explore your class
                <ArrowIcon />
              </Link>

              <a href="#how-it-works" className="secondary-button">
                See how it works
              </a>
            </div>

            <div className="hero-note">
              <div className="mini-avatars">
                <span>✓</span>
                <span>↑</span>
                <span>★</span>
              </div>
              <p>Built around the way teachers already work.</p>
            </div>
          </div>

          <div className="hero-visual">
            <div className="visual-glow" />

            {/* Main dashboard card */}
            <div className="dashboard-card">
              <div className="dashboard-top">
                <div>
                  <span className="dashboard-label">CLASS OVERVIEW</span>
                  <h3>B.Tech ECE · Sem 7</h3>
                </div>
                <button className="dashboard-menu" aria-label="More options">
                  •••
                </button>
              </div>

              <div className="dashboard-stats">
                <div className="stat-card stat-blue">
                  <span>Average attendance</span>
                  <strong>78<span>%</span></strong>
                  <small>↑ 4.2% this month</small>
                </div>

                <div className="stat-card stat-yellow">
                  <span>Class performance</span>
                  <strong>72<span>/100</span></strong>
                  <small>Stable overall</small>
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-header">
                  <div>
                    <span>ATTENDANCE TREND</span>
                    <strong>Moving in the right direction</strong>
                  </div>
                  <div className="chart-pill">Last 4 months</div>
                </div>

                <div className="fake-chart">
                  <div className="chart-line">
                    <svg viewBox="0 0 500 180" preserveAspectRatio="none">
                      <path
                        className="chart-area"
                        d="M0,145 C35,135 45,110 80,120 S120,145 155,105 S205,80 240,95 S285,125 320,75 S375,45 410,60 S455,75 500,20 L500,180 L0,180 Z"
                      />
                      <path
                        className="chart-path"
                        d="M0,145 C35,135 45,110 80,120 S120,145 155,105 S205,80 240,95 S285,125 320,75 S375,45 410,60 S455,75 500,20"
                      />
                    </svg>
                  </div>

                  <div className="chart-months">
                    <span>Jan</span>
                    <span>Feb</span>
                    <span>Mar</span>
                    <span>Apr</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating cards */}
            <div className="floating-card risk-card">
              <div className="floating-icon red-icon">!</div>
              <div>
                <span>NEEDS ATTENTION</span>
                <strong>12 students</strong>
              </div>
            </div>

            <div className="floating-card good-card">
              <div className="floating-icon green-icon">↗</div>
              <div>
                <span>IMPROVING</span>
                <strong>18 students</strong>
              </div>
            </div>

            <div className="floating-card score-card">
              <span>CLASS PULSE</span>
              <strong>84</strong>
              <div className="score-dots">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        </section>

        <section className="trusted-strip">
          <p>FROM RAW DATA TO A CLEARER PICTURE</p>

          <div className="process-line">
            <div>
              <span className="process-number blue-number">01</span>
              <strong>Bring your data</strong>
              <p>Attendance and marks, just as you already maintain them.</p>
            </div>

            <div className="process-arrow">→</div>

            <div>
              <span className="process-number yellow-number">02</span>
              <strong>Let ClassPulse analyse</strong>
              <p>We organise patterns and trends automatically.</p>
            </div>

            <div className="process-arrow">→</div>

            <div>
              <span className="process-number red-number">03</span>
              <strong>Understand what matters</strong>
              <p>Get a clearer view of your class and students.</p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="how-section">
          <div className="section-heading">
            <span>LESS SPREADSHEET. MORE CLARITY.</span>
            <h2>
              Stop looking for patterns.
              <br />
              Start seeing them.
            </h2>
          </div>

          <div className="feature-grid">
            <article className="feature-card feature-attendance">
              <div className="feature-tag">ATTENDANCE</div>
              <h3>See the trend, not just the percentage.</h3>
              <p>
                Understand whether attendance is improving, declining or staying
                stable over time.
              </p>
              <div className="feature-graphic bars">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </article>

            <article className="feature-card feature-performance">
              <div className="feature-tag">PERFORMANCE</div>
              <h3>Know how your class is really performing.</h3>
              <p>
                Compare marks, identify patterns and get a more complete academic picture.
              </p>
              <div className="feature-graphic score-graphic">
                <strong>72</strong>
                <span>/100</span>
              </div>
            </article>

            <article className="feature-card feature-students">
              <div className="feature-tag">STUDENTS</div>
              <h3>Find the students who need attention.</h3>
              <p>
                Identify at-risk students early and recognise those moving in the right direction.
              </p>
              <div className="student-dots">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </article>
          </div>
        </section>

        <section id="features" className="cta-section">
          <div className="cta-card">
            <div className="cta-copy">
              <span>READY TO CHECK YOUR CLASS?</span>
              <h2>Less guessing.<br />Better decisions.</h2>
              <p>
                Log in to ClassPulse and start exploring the data behind your classroom.
              </p>
              <Link href="/login" className="cta-button">
                Go to ClassPulse
                <ArrowIcon />
              </Link>
            </div>

            <div className="cta-decoration">
              <div className="cta-circle circle-one" />
              <div className="cta-circle circle-two" />
              <div className="cta-circle circle-three" />
              <span>CP</span>
            </div>
          </div>
        </section>

        <footer className="footer">
          <Link href="/" className="brand footer-brand">
            <PulseIcon />
            <span>class<span>pulse</span></span>
          </Link>

          <p>Making classroom data easier to understand.</p>

          <span>© 2026 ClassPulse</span>
        </footer>
      </main>
    </>
  );
}