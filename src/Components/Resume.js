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

// Group consecutive work entries that share the same company
function groupWork(work) {
  const groups = [];
  work.forEach(entry => {
    const last = groups[groups.length - 1];
    if (last && last.company === entry.company) {
      last.roles.push(entry);
    } else {
      groups.push({ company: entry.company, roles: [entry] });
    }
  });
  return groups;
}

const Resume = ({ data }) => {
  if (!data) return null;

  const { education = [], work = [], skills = [] } = data;
  const workGroups = groupWork(work);

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
                {workGroups.map((group, gi) => {
                  const isMulti = group.roles.length > 1;
                  // Span from last role's start to first role's end
                  const tenure = isMulti
                    ? `${group.roles[group.roles.length - 1].years.split(' - ')[0].trim()} – ${group.roles[0].years.split(' - ')[1]?.trim() ?? 'Present'}`
                    : null;

                  return (
                    <div
                      key={group.company + gi}
                      className={`timeline-item ${isMulti ? 'timeline-item--grouped' : ''} reveal reveal-delay-${Math.min(gi + 2, 4)}`}
                    >
                      <div className="timeline-company">
                        {group.company}
                        {isMulti && <span className="timeline-tenure">{tenure}</span>}
                      </div>

                      {isMulti ? (
                        <div className="timeline-roles">
                          {group.roles.map((r, ri) => (
                            <div key={r.title + ri} className="timeline-role-block">
                              <div className="timeline-role">
                                {ri === 0 && <span className="timeline-badge">↑ Promoted</span>}
                                {r.title}
                              </div>
                              <div className="timeline-years">{r.years}</div>
                              <div className="timeline-desc">{r.description}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="timeline-role">{group.roles[0].title}</div>
                          <div className="timeline-years">{group.roles[0].years}</div>
                          <div className="timeline-desc">{group.roles[0].description}</div>
                        </>
                      )}
                    </div>
                  );
                })}
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
