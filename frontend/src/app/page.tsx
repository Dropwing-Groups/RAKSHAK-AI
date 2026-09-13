'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform, useMotionTemplate, useMotionValue } from 'framer-motion';
import React from 'react';
import styles from './page.module.css';
import { Target, Eye, Zap, ArrowRight, ShieldCheck, Globe, Shield, Activity, Lock, Leaf, Recycle, Wind } from 'lucide-react';

// Animation variants
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 15 } }
};

const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.8 } }
};

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  bentoBgProps?: string;
}

function SpotlightCard({ children, className, bentoBgProps }: SpotlightCardProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <motion.div
      variants={fadeUp}
      className={className}
      onMouseMove={handleMouseMove}
    >
      <motion.div
        className={styles.spotlightGlow}
        style={{
          background: useMotionTemplate`
            radial-gradient(
              650px circle at ${mouseX}px ${mouseY}px,
              rgba(14, 165, 233, 0.15),
              transparent 80%
            )
          `,
        }}
      />
      {bentoBgProps && <div className={bentoBgProps} />}
      {children}
    </motion.div>
  );
}

export default function Home() {
  const { scrollYProgress } = useScroll();
  const yHeroImg = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const yBgGlow1 = useTransform(scrollYProgress, [0, 1], [0, 400]);
  const yBgGlow2 = useTransform(scrollYProgress, [0, 1], [0, -400]);

  return (
    <div className={styles.container}>
      {/* Immersive Background Effects */}
      <motion.div className={styles.bgGlow1} style={{ y: yBgGlow1 }}></motion.div>
      <motion.div className={styles.bgGlow2} style={{ y: yBgGlow2 }}></motion.div>

      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroGrid}>
          <motion.div
            className={styles.heroContent}
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={fadeUp} className={styles.badge}>
              <span className={styles.pulseDot}></span>
              <Shield size={14} style={{ color: 'var(--color-logo-blue)' }} />
              Rakshak Core v2.0 Live
            </motion.div>

            <motion.h1 variants={fadeUp} className={styles.heroTitle}>
              Securing supply chains with <br />
              <span className={styles.highlightText}>Predictive AI.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className={styles.heroSubtitle}>
              Transform your logistics network into an impenetrable fortress. Rakshak AI fuses real-time computer vision, geospatial intelligence, and behavioral analytics to predict and prevent cargo theft before it occurs.
            </motion.p>

            <motion.div variants={fadeUp} className={styles.ctaGroup}>
              <Link href="/dashboard" className={styles.primaryBtn}>
                Launch Command Center <ArrowRight size={18} />
              </Link>
              <Link href="/dashboard" className={styles.secondaryBtn}>
                Watch Live Dashboard
              </Link>
            </motion.div>

            {/* Trust Metrics */}
            <motion.div variants={fadeUp} className={styles.statsRow}>
              <div className={styles.statItem}>
                <h4>99.2%</h4>
                <p>Threat Detection Rate</p>
              </div>
              <div className={styles.statDivider}></div>
              <div className={styles.statItem}>
                <h4>&lt;50ms</h4>
                <p>Vision Model Latency</p>
              </div>
              <div className={styles.statDivider}></div>
              <div className={styles.statItem}>
                <h4>₹2.5B+</h4>
                <p>Cargo Value Secured</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Hero Visual */}
          <motion.div
            className={styles.heroVisual}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{ y: yHeroImg }}
          >
            <div className={styles.visualContainer}>
              <Image
                src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop"
                alt="Logistics Operations"
                className={styles.mainImage}
                width={800}
                height={1000}
                priority
              />
              <div className={styles.imageOverlay}></div>

              {/* Dynamic Floating Elements */}
              <motion.div
                className={styles.floatingCard}
                style={{ top: '15%', left: '-12%', cursor: 'grab' }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8, type: 'spring' }}
                drag
                dragConstraints={{ left: -30, right: 30, top: -30, bottom: 30 }}
                whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
              >
                <ShieldCheck className={styles.floatIconSafe} />
                <div className={styles.floatText}>
                  <strong>TR-102 Secured</strong>
                  <span>Electronics · Mumbai route</span>
                </div>
              </motion.div>

              <motion.div
                className={styles.floatingCard}
                style={{ bottom: '25%', right: '-8%', cursor: 'grab' }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2, type: 'spring' }}
                drag
                dragConstraints={{ left: -30, right: 30, top: -30, bottom: 30 }}
                whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
              >
                <Activity className={styles.floatIconAccent} />
                <div className={styles.floatText}>
                  <strong>TR-1044 Alert</strong>
                  <span>Risk score: 88 · Medical gear</span>
                </div>
              </motion.div>

              <div className={styles.floatingIndicator}>
                <div className={styles.radarPing}></div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Ticker Section */}
      <motion.div
        className={styles.tickerSection}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        variants={fadeIn}
      >
        <p className={styles.tickerLabel}>POWERED BY STATE-OF-THE-ART TECHNOLOGY</p>
        <div className={styles.tickerTrack}>
          <span>TensorFlow</span> • <span>PyTorch</span> • <span>YOLOv8 Object Detection</span> •
          <span>DeepSORT Tracking</span> • <span>Isolation Forests</span> • <span>Django REST</span> •
          <span>Next.js</span> • <span>SVG Map Engine</span> • <span>Supabase</span>
        </div>
      </motion.div>

      {/* Features - Bento Grid */}
      <section className={styles.bentoSection}>
        <motion.div
          className={styles.sectionHeader}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          variants={fadeUp}
        >
          <h2>Enterprise-Grade Capabilities</h2>
          <p>A unified security ecosystem built for scale, speed, and precision.</p>
        </motion.div>

        <motion.div
          className={styles.bentoGrid}
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Large Card */}
          <SpotlightCard className={`${styles.bentoCard} ${styles.bentoLarge}`} bentoBgProps={styles.bentoBgGraphic1}>
            <div className={styles.bentoContent}>
              <div className={styles.iconWrapper}><Target className={styles.icon} /></div>
              <h3>Predictive Risk Modeling</h3>
              <p>Our machine learning models ingest years of historical crime data, cross-referenced with live weather, traffic conditions, and socio-economic markers to map high-risk zones dynamically.</p>
              <ul className={styles.featureList}>
                <li><Shield size={16} /> Route Vulnerability Scoring</li>
                <li><Shield size={16} /> Real-time Weather Integration</li>
                <li><Shield size={16} /> Historical Crime Indexing</li>
              </ul>
            </div>
          </SpotlightCard>

          <SpotlightCard className={styles.bentoCard}>
            <div className={styles.bentoContent}>
              <div className={styles.iconWrapper}><Eye className={styles.icon} /></div>
              <h3>Computer Vision Edge</h3>
              <p>Turn standard cameras into intelligent sensors. Instantly detect loitering, unauthorized access, and weapon presence.</p>
            </div>
          </SpotlightCard>

          <SpotlightCard className={styles.bentoCard}>
            <div className={styles.bentoContent}>
              <div className={styles.iconWrapper}><Globe className={styles.icon} /></div>
              <h3>Global Fleet Tracking</h3>
              <p>Monitor thousands of consignments simultaneously on a unified global dashboard with millisecond latency.</p>
            </div>
          </SpotlightCard>

          <SpotlightCard className={`${styles.bentoCard} ${styles.bentoWide}`} bentoBgProps={styles.bentoBgGraphic2}>
            <div className={styles.bentoContent}>
              <div className={styles.iconWrapper}><Zap className={styles.icon} /></div>
              <h3>Autonomous Threat Response</h3>
              <p>When the Fusion engine detects a multi-vector threat, the system automatically triggers lock-down procedures, reroutes the vehicle, and alerts local authorities without requiring human intervention.</p>
            </div>
          </SpotlightCard>
        </motion.div>
      </section>

      {/* How It Works Timeline */}
      <section className={styles.workflowSection}>
        <motion.div
          className={styles.sectionHeader}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
        >
          <h2>The Rakshak Architecture</h2>
          <p>How our multi-agent AI system defends your freight.</p>
        </motion.div>

        <motion.div
          className={styles.timeline}
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
        >
          <motion.div variants={fadeUp} className={styles.timelineStep}>
            <div className={styles.stepNumber}>01</div>
            <h3>Perception</h3>
            <p>IoT sensors and cameras feed raw telemetry to our Edge AI.</p>
          </motion.div>
          <div className={styles.timelineConnector}></div>
          <motion.div variants={fadeUp} className={styles.timelineStep}>
            <div className={styles.stepNumber}>02</div>
            <h3>Behavioral Analysis</h3>
            <p>Isolation Forests detect anomalies in speed, routing, and stops.</p>
          </motion.div>
          <div className={styles.timelineConnector}></div>
          <motion.div variants={fadeUp} className={styles.timelineStep}>
            <div className={styles.stepNumber}>03</div>
            <h3>Risk Fusion</h3>
            <p>All streams merge into a single, highly accurate risk score.</p>
          </motion.div>
          <div className={styles.timelineConnector}></div>
          <motion.div variants={fadeUp} className={styles.timelineStep}>
            <div className={styles.stepNumber}>04</div>
            <h3>Action</h3>
            <p>System triggers automated lockdown and sends rapid SMS alerts.</p>
          </motion.div>
        </motion.div>
      </section>

      {/* SDG Alignment Section */}
      <section className={styles.sdgSection}>
        <motion.div
          className={styles.sectionHeader}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
        >
          <motion.div variants={fadeUp} className={styles.sdgSectionBadge}>
            <Leaf size={14} />
            UN Sustainable Development Goals
          </motion.div>
          <h2>Advancing the 2030 Agenda</h2>
          <p>RAKSHAK AI actively drives SDG 9, 12, and 13 — protecting cargo, reducing CO₂ emissions, and building resilient logistics infrastructure for India and beyond.</p>
        </motion.div>

        <motion.div
          className={styles.sdgGrid}
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          {/* SDG 9 */}
          <motion.div variants={fadeUp} className={`${styles.sdgCard} ${styles.sdgCard9}`}>
            <div className={styles.sdgCardTop}>
              <div className={styles.sdgNumber} style={{ background: '#F36E26' }}>9</div>
              <div className={styles.sdgIconWrap} style={{ background: 'rgba(243,110,38,0.1)', color: '#F36E26' }}>
                <Shield size={20} />
              </div>
            </div>
            <h3>Industry, Innovation &amp; Infrastructure</h3>
            <p>Our multi-agent AI platform provides resilient, inclusive digital infrastructure for fleet operations — bringing enterprise-grade intelligence to every logistics operator.</p>
            <div className={styles.sdgMini}>
              <div className={styles.sdgMiniRow}><span>AI Platform Uptime</span><strong>99%</strong></div>
              <div className={styles.sdgMiniRow}><span>Active AI Models</span><strong>5 Agents</strong></div>
            </div>
            <div className={styles.sdgBar}><div className={styles.sdgBarFill} style={{ width: '91%', background: '#F36E26' }} /></div>
            <span className={styles.sdgBarLabel}>SDG 9 Impact: 91%</span>
          </motion.div>

          {/* SDG 12 */}
          <motion.div variants={fadeUp} className={`${styles.sdgCard} ${styles.sdgCard12}`}>
            <div className={styles.sdgCardTop}>
              <div className={styles.sdgNumber} style={{ background: '#BF8B2E' }}>12</div>
              <div className={styles.sdgIconWrap} style={{ background: 'rgba(191,139,46,0.1)', color: '#BF8B2E' }}>
                <Recycle size={20} />
              </div>
            </div>
            <h3>Responsible Consumption &amp; Production</h3>
            <p>Preventing cargo theft, spoilage, and fuel waste directly enables responsible supply chains. Every alert resolved is economic and environmental waste avoided.</p>
            <div className={styles.sdgMini}>
              <div className={styles.sdgMiniRow}><span>Cargo Waste Avoided</span><strong>86%</strong></div>
              <div className={styles.sdgMiniRow}><span>Idle Fuel Reduction</span><strong>70%</strong></div>
            </div>
            <div className={styles.sdgBar}><div className={styles.sdgBarFill} style={{ width: '86%', background: '#BF8B2E' }} /></div>
            <span className={styles.sdgBarLabel}>SDG 12 Impact: 86%</span>
          </motion.div>

          {/* SDG 13 */}
          <motion.div variants={fadeUp} className={`${styles.sdgCard} ${styles.sdgCard13}`}>
            <div className={styles.sdgCardTop}>
              <div className={styles.sdgNumber} style={{ background: '#3F7E44' }}>13</div>
              <div className={styles.sdgIconWrap} style={{ background: 'rgba(63,126,68,0.1)', color: '#3F7E44' }}>
                <Wind size={20} />
              </div>
            </div>
            <h3>Climate Action</h3>
            <p>AI-optimised routing eliminates unnecessary detours and idling — directly reducing CO₂ emissions from India&apos;s fastest-growing pollution source: road freight transport.</p>
            <div className={styles.sdgMini}>
              <div className={styles.sdgMiniRow}><span>CO₂ Saved / Fleet</span><strong>1.1 t/day</strong></div>
              <div className={styles.sdgMiniRow}><span>Green Routes Used</span><strong>73%</strong></div>
            </div>
            <div className={styles.sdgBar}><div className={styles.sdgBarFill} style={{ width: '78%', background: '#3F7E44' }} /></div>
            <span className={styles.sdgBarLabel}>SDG 13 Impact: 78%</span>
          </motion.div>
        </motion.div>

        <motion.div
          className={styles.sdgCta}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
        >
          <Link href="/sustainability" className={styles.sdgCtaBtn}>
            View Full Sustainability Report <ArrowRight size={16} />
          </Link>
        </motion.div>
      </section>

      {/* CTA Footer Section */}
      <section className={styles.ctaFooter}>
        <motion.div
          className={styles.ctaFooterInner}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
        >
          <Lock className={styles.ctaIcon} size={48} />
          <h2>Ready to secure your logistics?</h2>
          <p>Join top-tier enterprises deploying Rakshak AI to virtually eliminate cargo theft.</p>
          <Link href="/dashboard" className={styles.primaryBtnLarge}>
            Access the Platform
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
