import React, { useState } from 'react';

const Contact = ({ data }) => {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = e => {
    e.preventDefault();
    window.open(`mailto:${data?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${name}: ${message}`)}`);
  };

  return (
    <section id="contact">
      <div className="section-inner">

        <p className="section-tag reveal">Open Comms</p>
        <h2 className="section-title reveal reveal-delay-1">
          Get In <span>Touch</span>
        </h2>

        <div className="contact-layout">

          {/* ── Terminal form ── */}
          <div className="terminal-window glass-card reveal reveal-delay-2">
            <div className="terminal-titlebar">
              <div className="terminal-dot red"    />
              <div className="terminal-dot yellow" />
              <div className="terminal-dot green"  />
              <span className="terminal-titlebar-text">comms_terminal_v2.sh</span>
            </div>
            <div className="terminal-body">
              <p className="terminal-prompt">Initiating secure transmission...</p>

              <form onSubmit={handleSubmit}>
                <div className="form-field">
                  <label className="form-label" htmlFor="ctName">Callsign (Name)</label>
                  <input
                    id="ctName"
                    className="form-input"
                    type="text"
                    placeholder="Commander ..."
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="ctEmail">Frequency (Email)</label>
                  <input
                    id="ctEmail"
                    className="form-input"
                    type="email"
                    placeholder="signal@base.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="ctSubject">Transmission Header</label>
                  <input
                    id="ctSubject"
                    className="form-input"
                    type="text"
                    placeholder="Subject..."
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="ctMessage">Message Payload</label>
                  <textarea
                    id="ctMessage"
                    className="form-textarea"
                    placeholder="Enter transmission..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn-transmit">
                  &#9654;&nbsp; Transmit Message
                </button>
              </form>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="contact-sidebar">
            <div className="contact-sidebar-block glass-card reveal reveal-delay-3">
              <div className="contact-sidebar-title">Coordinates</div>
              <div className="contact-info-item">
                <i className="fa fa-map-marker" />
                <span>{data?.address?.city}, {data?.address?.state}</span>
              </div>
              <div className="contact-info-item">
                <i className="fa fa-phone" />
                <span>{data?.phone}</span>
              </div>
              <div className="contact-info-item">
                <i className="fa fa-envelope" />
                <span>{data?.email}</span>
              </div>
            </div>

            <div className="contact-sidebar-block glass-card reveal reveal-delay-4">
              <div className="contact-sidebar-title">Social Links</div>
              {(data?.social || []).map(s => (
                <div key={s.name} className="contact-info-item">
                  <i className={s.className} />
                  <a href={s.url} target="_blank" rel="noopener noreferrer"
                     style={{ textTransform: 'capitalize' }}>
                    {s.name}
                  </a>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Contact;
