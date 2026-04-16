import React from 'react';

const Header = ({ data }) => {
  const name = data?.name        || 'Chuy';
  const desc = data?.description || '';
  const networks = (data?.social || []).map(n => (
    <li key={n.name}>
      <a href={n.url} target="_blank" rel="noopener noreferrer" aria-label={n.name}>
        <i className={n.className} />
      </a>
    </li>
  ));

  return (
    <header id="home">

      {/* ── Navigation ── */}
      <nav id="nav-wrap" role="navigation" aria-label="Main navigation">
        <ul id="nav" className="nav">
          <li className="current"><a href="#home">Home</a></li>
          <li><a href="#about">About</a></li>
          <li><a href="#resume">Resume</a></li>
          <li><a href="#portfolio">Works</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </nav>

      {/* ── Hero content ── */}
      <div className="hero-content">
        <p className="hero-label" style={{ animationDelay: '0.2s' }}>
          Mission Control — Chicago, IL
        </p>

        <h1 className="hero-name">
          Hi, I'm {name}
        </h1>

        <p className="hero-title">
          <span>Fullstack Engineer</span> &amp; DevOps Specialist
        </p>

        <p className="hero-sub">{desc}</p>

        <div className="hero-divider" />

        <ul className="hero-socials">
          {networks}
        </ul>
      </div>

      {/* ── Scroll indicator ── */}
      <div className="scroll-indicator">
        <span>Engage Thrusters</span>
        <i className="fa fa-chevron-down" />
      </div>

    </header>
  );
};

export default Header;
