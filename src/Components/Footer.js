import React from 'react';

const Footer = ({ data }) => {
  const networks = (data?.social || []).map(n => (
    <li key={n.name}>
      <a href={n.url} target="_blank" rel="noopener noreferrer" aria-label={n.name}>
        <i className={n.className} />
      </a>
    </li>
  ));

  return (
    <footer>
      <div className="footer-inner">
        <ul className="footer-socials">{networks}</ul>
        <span className="footer-copy">
          &copy; {new Date().getFullYear()} Jesus Medina
        </span>
        <a href="#home" className="footer-back">
          ↑ Back to orbit
        </a>
      </div>
    </footer>
  );
};

export default Footer;
