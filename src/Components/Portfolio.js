import React from 'react';

const Portfolio = ({ data }) => {
  const projects = data?.projects || [];

  return (
    <section id="portfolio">
      <div className="section-inner">

        <p className="section-tag reveal">Completed Missions</p>
        <h2 className="section-title reveal reveal-delay-1">
          Space <span>Dock</span>
        </h2>

        <div className="projects-grid">
          {projects.map((p, i) => (
            <div
              key={p.title}
              className={`project-card glass-card reveal reveal-delay-${Math.min(i + 2, 4)}`}
            >
              <div className="project-card-inner">
                <img
                  className="project-img"
                  src={`images/portfolio/${p.image}`}
                  alt={p.title}
                  onError={e => { e.target.style.display = 'none'; }}
                />
                <div className="project-overlay">
                  <div className="project-category">Web App</div>
                  <div className="project-title">{p.title}</div>
                  <div className="project-desc">{p.category}</div>
                  <div className="project-links">
                    {p.url && (
                      <a
                        href={p.url}
                        className="project-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        ↗ Live Site
                      </a>
                    )}
                    {p.github && (
                      <a
                        href={p.github}
                        className="project-link project-link--github"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        ⌥ GitHub
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Placeholder classified cards */}
          {projects.length < 3 && Array.from({ length: 3 - projects.length }).map((_, i) => (
            <div
              key={`ph-${i}`}
              className={`project-card glass-card reveal reveal-delay-${Math.min(i + 3, 4)}`}
              style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div style={{ textAlign: 'center', opacity: 0.22 }}>
                <div style={{
                  fontFamily: 'var(--font-head)',
                  fontSize: '.6rem',
                  letterSpacing: '.22em',
                  color: 'var(--neon-cyan)',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}>
                  Classified
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '2.2rem',
                  color: 'var(--text-dim)',
                }}>
                  [ ? ]
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '.62rem',
                  color: 'var(--text-dim)',
                  marginTop: 8,
                }}>
                  Mission pending
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Portfolio;
