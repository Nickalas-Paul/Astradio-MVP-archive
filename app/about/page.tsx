'use client';

import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';

export default function AboutPage() {
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <h1 className="text-5xl font-bold bg-gradient-to-r from-text via-emerald to-violet bg-clip-text text-transparent">
            About Astradio
          </h1>
          <p className="text-xl text-subtext max-w-3xl mx-auto">
            Where ancient wisdom meets modern technology. Astradio transforms your astrological chart 
            into personalized musical compositions using advanced machine learning and Swiss Ephemeris calculations.
          </p>
        </motion.div>

        {/* Mission Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold text-text">
              Our Mission
            </h2>
            <p className="text-lg text-subtext leading-relaxed">
              Astradio bridges the gap between celestial mechanics and musical expression. 
              We believe that the positions of the planets at the moment of your birth contain 
              unique musical signatures that can be translated into beautiful, personalized compositions.
            </p>
            <p className="text-lg text-subtext leading-relaxed">
              Our goal is to make astrology accessible, engaging, and musically inspiring for everyone, 
              regardless of their background in either field.
            </p>
          </div>
        </motion.div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-8"
        >
          <h2 className="text-3xl font-semibold text-center text-text">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-emerald/20 border border-emerald rounded-full flex items-center justify-center mx-auto">
                <span className="text-3xl">🌟</span>
              </div>
              <h3 className="text-xl font-semibold text-text">Astrological Analysis</h3>
              <p className="text-subtext">
                Using Swiss Ephemeris, we calculate precise planetary positions, aspects, 
                and house placements from your birth data.
              </p>
            </div>
            
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-violet/20 border border-violet rounded-full flex items-center justify-center mx-auto">
                <span className="text-3xl">🧠</span>
              </div>
              <h3 className="text-xl font-semibold text-text">AI Composition</h3>
              <p className="text-subtext">
                Our machine learning model translates astrological patterns into musical parameters, 
                generating unique compositions for each chart.
              </p>
            </div>
            
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-warning/20 border border-warning rounded-full flex items-center justify-center mx-auto">
                <span className="text-3xl">🎵</span>
              </div>
              <h3 className="text-xl font-semibold text-text">Musical Generation</h3>
              <p className="text-subtext">
                Advanced audio synthesis creates layered compositions with melody, harmony, 
                rhythm, and texture elements.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Technology Stack */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="card"
        >
          <h2 className="text-3xl font-semibold text-text mb-6">
            Technology Stack
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-emerald">Backend</h3>
              <ul className="space-y-2 text-subtext">
                <li>• <strong>Swiss Ephemeris:</strong> Precise astronomical calculations</li>
                <li>• <strong>TensorFlow.js:</strong> Machine learning model inference</li>
                <li>• <strong>Node.js:</strong> Server-side processing</li>
                <li>• <strong>Express:</strong> API framework</li>
                <li>• <strong>PostgreSQL:</strong> Data persistence</li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-violet">Frontend</h3>
              <ul className="space-y-2 text-subtext">
                <li>• <strong>Next.js:</strong> React framework with App Router</li>
                <li>• <strong>TypeScript:</strong> Type-safe development</li>
                <li>• <strong>Tailwind CSS:</strong> Utility-first styling</li>
                <li>• <strong>Framer Motion:</strong> Smooth animations</li>
                <li>• <strong>Zustand:</strong> State management</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Team Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="card"
        >
          <h2 className="text-3xl font-semibold text-text mb-6">
            The Team
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald to-violet rounded-full flex items-center justify-center">
                <span className="text-bg font-bold text-xl">A</span>
              </div>
              <h3 className="text-xl font-semibold text-text">Astradio Team</h3>
              <p className="text-subtext">
                A passionate group of developers, musicians, and astrologers working together 
                to create the future of personalized musical experiences.
              </p>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-text">Special Thanks</h3>
              <ul className="space-y-2 text-subtext">
                <li>• Swiss Ephemeris for astronomical accuracy</li>
                <li>• The open-source community for inspiration</li>
                <li>• Beta testers for valuable feedback</li>
                <li>• The astrology community for guidance</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Contact Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="card text-center"
        >
          <h2 className="text-3xl font-semibold text-text mb-4">
            Get In Touch
          </h2>
          <p className="text-lg text-subtext mb-6">
            Have questions, feedback, or want to collaborate? We'd love to hear from you.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="btn-primary">
              Contact Support
            </button>
            <button className="btn-secondary">
              Join Community
            </button>
            <button className="btn-secondary">
              Report Bug
            </button>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="text-center space-y-4 py-8 border-t border-border"
        >
          <p className="text-subtext">
            © 2025 Astradio. All rights reserved.
          </p>
          <p className="text-xs text-subtext">
            Made with 🌟 for the cosmic music community
          </p>
        </motion.div>
      </div>
    </AppShell>
  );
}
