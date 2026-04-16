import React from 'react';

const About = ({ data }) => {
  if (!data) return null;

  const { name, image, bio, address, phone, email, resumedownload } = data;
  const profilePic = `images/${image}`;

  return (
    <section id="about">
      <div className="section-inner">

        <p className="section-tag reveal">Commander Profile</p>
        <h2 className="section-title reveal reveal-delay-1">
          About <span>Me</span>
        </h2>

        <div className="about-grid">

          {/* Left — profile card */}
          <div className="profile-card reveal reveal-delay-2">
            <div className="profile-pic-wrapper">
              <img className="profile-pic" src={profilePic} alt={`${name} profile`} />
            </div>
            <div className="profile-status">
              <div className="status-dot" />
              <span>Available for hire</span>
            </div>
          </div>

          {/* Right — bio + contact */}
          <div>
            <div className="about-bio-section reveal reveal-delay-2">
              <h2>Bio</h2>
              <p>{bio}</p>
            </div>

            <div className="contact-grid reveal reveal-delay-3">
              <div className="glass-card contact-item">
                <div className="contact-item-label">Location</div>
                <div className="contact-item-value">{address?.city}, {address?.state}</div>
              </div>
              <div className="glass-card contact-item">
                <div className="contact-item-label">Phone</div>
                <div className="contact-item-value">{phone}</div>
              </div>
              <div className="glass-card contact-item" style={{ gridColumn: '1 / -1' }}>
                <div className="contact-item-label">Email</div>
                <div className="contact-item-value">{email}</div>
              </div>
            </div>

            <div className="reveal reveal-delay-4">
              <a href={resumedownload} className="btn-mission" download>
                <i className="fa fa-download" />
                Access Mission File
              </a>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default About;
