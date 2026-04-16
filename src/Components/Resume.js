import React, { useEffect, useRef } from 'react';

// Animate skill bars when they scroll into view
const SkillBar = ({ name, level }) => {
  const fillRef = useRef(null);

  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.width = level;
          obs.unobserve(el);
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el.parentElement);
    return () => obs.disconnect();
  }, [level]);

  return (
    <div className="skill-item reveal">
      <div className="skill-header">
        <span className="skill-name">{name}</span>
        <span className="skill-level">{level}</span>
      </div>
      <div className="skill-track">
        <div ref={fillRef} className="skill-fill" style={{ width: 0 }} />
      </div>
    </div>
  );
};

const Resume = ({ data }) => {
  if (!data) return null;

  const { education = [], work = [], skills = [] } = data;

  return (
    <section id="resume">
      <div className="section-inner">

        <p className="section-tag reveal">Career Log</p>
        <h2 className="section-title reveal reveal-delay-1">
          Mission <span>History</span>
        </h2>

        <div className="resume-grid">

          {/* ── Left col: Education + Work ── */}
          <div>
            {/* Education */}
            <div className="reveal reveal-delay-2" style={{ marginBottom: '48px' }}>
              <h3 className="resume-col-title">Academy Records</h3>
              <div className="timeline">
                {education.map(e => (
                  <div key={e.school} className="timeline-item">
                    <div className="timeline-company">{e.school}</div>
                    <div className="timeline-role">{e.degree}</div>
                    <div className="timeline-years">{e.graduated}</div>
                    <div className="timeline-desc">{e.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Work */}
            <div>
              <h3 className="resume-col-title reveal reveal-delay-2">Mission Deployments</h3>
              <div className="timeline">
                {work.map((w, i) => (
                  <div
                    key={w.company + w.years}
                    className={`timeline-item reveal reveal-delay-${Math.min(i + 2, 4)}`}
                  >
                    <div className="timeline-company">{w.company}</div>
                    <div className="timeline-role">{w.title}</div>
                    <div className="timeline-years">{w.years}</div>
                    <div className="timeline-desc">{w.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right col: Skills ── */}
          <div>
            <h3 className="resume-col-title reveal reveal-delay-2">System Capabilities</h3>
            <div className="skills-list">
              {skills.map(s => (
                <SkillBar key={s.name} name={s.name} level={s.level} />
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Resume;
