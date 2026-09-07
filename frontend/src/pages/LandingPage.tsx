import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import '../styles/landing.css';

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'CEM Total Child School – Building Bright Minds';
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo" onClick={() => scrollToSection('hero')}>
            <div className="landing-logo-icon">CT</div>
            <span className="landing-logo-text">CEM Total Child</span>
          </div>
          <div className="landing-nav-links">
            <button onClick={() => scrollToSection('about')}>About</button>
            <button onClick={() => scrollToSection('academics')}>Academics</button>
            <button onClick={() => scrollToSection('admissions')}>Admissions</button>
            <button onClick={() => scrollToSection('contact')}>Contact</button>
          </div>
          <div className="landing-nav-actions">
            <Button variant="primary" size="sm" onClick={() => navigate('/login')}>
              Portal Login
            </Button>
            <button className="landing-menu-toggle" aria-label="Menu">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
        <div className="landing-mobile-menu">
          <button onClick={() => scrollToSection('about')}>About</button>
          <button onClick={() => scrollToSection('academics')}>Academics</button>
          <button onClick={() => scrollToSection('admissions')}>Admissions</button>
          <button onClick={() => scrollToSection('contact')}>Contact</button>
          <Button variant="primary" block onClick={() => navigate('/login')}>
            Portal Login
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero" id="hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-content">
            <span className="landing-hero-badge">Excellence in Education</span>
            <h1 className="landing-hero-title">
              Building Bright Minds.<br />
              <span className="landing-hero-highlight">Shaping Better Futures.</span>
            </h1>
            <p className="landing-hero-description">
              CEM Total Child School provides a nurturing, world‑class education
              that prepares students for a lifetime of success. Our holistic
              approach develops confident, compassionate leaders.
            </p>
            <div className="landing-hero-actions">
              <Button size="lg" onClick={() => scrollToSection('about')}>
                Explore Our School
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate('/login')}>
                Portal Login
              </Button>
            </div>
            {/* Removed fake stats */}
          </div>
          <div className="landing-hero-visual">
            <div className="landing-hero-visual-inner">
              <div className="landing-hero-image-placeholder">
                {/* Replace this div with an <img> tag when you have images */}
                <div className="placeholder-content">
                  <span>CT</span>
                  <p>Empowering the next generation</p>
                </div>
              </div>
              <div className="landing-hero-accent-box"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="landing-why" id="about">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-tag">Why Choose</span>
            <h2 className="landing-section-title">CEM Total Child School</h2>
            <p className="landing-section-subtitle">
              We are dedicated to creating a safe, supportive, and stimulating
              environment where every child can flourish.
            </p>
          </div>
          <div className="landing-why-grid">
            <div className="landing-why-card">
              <div className="landing-why-icon">SAFE</div>
              <h3>Safe & Supportive Environment</h3>
              <p>
                Our students thrive in a caring community that prioritises
                wellbeing and emotional security.
              </p>
            </div>
            <div className="landing-why-card">
              <div className="landing-why-icon">FAC</div>
              <h3>Advanced Facilities & Resources</h3>
              <p>
                Modern classrooms, science labs, libraries, and sports
                facilities that support all-round development.
              </p>
            </div>
            <div className="landing-why-card">
              <div className="landing-why-icon">COM</div>
              <h3>Strong Community Involvement</h3>
              <p>
                We partner closely with parents and the local community to
                ensure every child’s success.
              </p>
            </div>
            <div className="landing-why-card">
              <div className="landing-why-icon">EXP</div>
              <h3>Academic Excellence</h3>
              <p>
                A rigorous curriculum delivered by passionate teachers who
                inspire a love for lifelong learning.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights / Features */}
      <section className="landing-highlights">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-tag">Our Highlights</span>
            <h2 className="landing-section-title">What Makes Us Special</h2>
          </div>
          <div className="landing-highlights-grid">
            <div className="landing-highlight-card">
              <div className="landing-highlight-icon">CUR</div>
              <h3>Holistic Curriculum</h3>
              <p>
                Beyond academics, we offer arts, sports, and character education
                to produce well-rounded individuals.
              </p>
            </div>
            <div className="landing-highlight-card">
              <div className="landing-highlight-icon">INN</div>
              <h3>Innovative Teaching</h3>
              <p>
                Our teachers use modern pedagogical methods, technology, and
                personalized support to meet every student’s needs.
              </p>
            </div>
            <div className="landing-highlight-card">
              <div className="landing-highlight-icon">GLO</div>
              <h3>Global Perspective</h3>
              <p>
                We prepare students for a globalised world through exchange
                programmes, languages, and cultural awareness.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Excellence */}
      <section className="landing-academics" id="academics">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-tag">Academic Excellence</span>
            <h2 className="landing-section-title">A Foundation for Success</h2>
            <p className="landing-section-subtitle">
              Our academic programme is designed to challenge and inspire,
              fostering critical thinking and a passion for knowledge.
            </p>
          </div>
          <div className="landing-academics-grid">
            <div className="landing-academic-item">
              <span className="landing-academic-number">01</span>
              <h4>Early Years</h4>
              <p>Nurturing curiosity through play-based learning and exploration.</p>
            </div>
            <div className="landing-academic-item">
              <span className="landing-academic-number">02</span>
              <h4>Primary School</h4>
              <p>Building strong foundations in literacy, numeracy, and creative thinking.</p>
            </div>
            
            <div className="landing-academic-item">
              <span className="landing-academic-number">03</span>
              <h4>Co‑curricular</h4>
              <p>Sports, music, arts, and clubs that develop talent and teamwork.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Student Development / Activities */}
      <section className="landing-activities">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-tag">Student Development</span>
            <h2 className="landing-section-title">Beyond the Classroom</h2>
            <p className="landing-section-subtitle">
              We believe education extends far beyond textbooks. Our students
              engage in diverse activities that build character and skills.
            </p>
          </div>
          <div className="landing-activities-grid">
            <div className="landing-activity-card">
              <div className="landing-activity-icon">SPT</div>
              <h4>Sports</h4>
              <p>Football, basketball, athletics, swimming, and more.</p>
            </div>
            <div className="landing-activity-card">
              <div className="landing-activity-icon">ART</div>
              <h4>Music & Arts</h4>
              <p>Choir, band, drama, painting, and creative expression.</p>
            </div>
            <div className="landing-activity-card">
              <div className="landing-activity-icon">STM</div>
              <h4>STEM Clubs</h4>
              <p>Robotics, coding, science fairs, and innovation challenges.</p>
            </div>
            <div className="landing-activity-card">
              <div className="landing-activity-icon">COM</div>
              <h4>Community Service</h4>
              <p>Environmental projects, charity work, and leadership initiatives.</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="landing-about">
        <div className="landing-section-inner">
          <div className="landing-about-content">
            <div className="landing-about-text">
              <span className="landing-section-tag">About Our School</span>
              <h2 className="landing-section-title">Where Every Child Thrives</h2>
              <p>
                At CEM Total Child School, we are more than an educational
                institution – we are a family. Our mission is to provide a
                high‑quality, holistic education that nurtures the intellectual,
                social, and emotional growth of every student.
              </p>
              <p>
                With a dedicated team of educators, modern facilities, and a
                vibrant school community, we create an environment where
                students are inspired to reach their full potential.
              </p>
              <Button variant="primary" onClick={() => scrollToSection('admissions')}>
                Learn More About Admissions
              </Button>
            </div>
            <div className="landing-about-image">
              <div className="landing-about-placeholder">
                <span>CT</span>
                {/* Replace with <img> when you have an image */}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action / Admissions */}
      <section className="landing-cta" id="admissions">
        <div className="landing-cta-inner">
          <h2>Ready to Join Our Community?</h2>
          <p>
            Admissions are now open for the upcoming academic year. Give your
            child the gift of exceptional education.
          </p>
          <div className="landing-cta-actions">
            <Button variant="primary" size="lg" onClick={() => navigate('/login')}>
              Portal Login
            </Button>
            <Button variant="outline" size="lg" style={{ borderColor: 'white', color: 'white' }}>
              Request Information
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer" id="contact">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <div className="landing-footer-logo">CT</div>
            <span>CEM Total Child School</span>
          </div>
          <div className="landing-footer-links">
            <a href="#">About</a>
            <a href="#">Academics</a>
            <a href="#">Admissions</a>
            <a href="#">Contact</a>
          </div>
          <div className="landing-footer-contact">

          </div>
          <div className="landing-footer-copy">
            &copy; {new Date().getFullYear()} CEM Total Child School. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}