import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight, CircleCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../api';
import { ErrorMessage, StatusBadge } from '../components/ui';
import { useToast } from '../components/useToast';

const intakeSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  phone: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit phone number'),
  email: z.union([z.string().email('Enter a valid email'), z.literal('')]).optional(),
  requirement: z.string().trim().min(5, 'Tell us a little about your requirement'),
  timeline: z.enum(['Immediate (Ready now)', 'Within 15 - 30 Days', 'Exploring / General Inquiry'])
});

export function Landing() {
  const toast = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [trackingReference, setTrackingReference] = useState('');
  const [trackingLead, setTrackingLead] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [submittedReference, setSubmittedReference] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(intakeSchema),
    defaultValues: { name: '', phone: '', email: '', requirement: '', timeline: 'Immediate (Ready now)' }
  });

  async function submit(values) {
    setServerError(null);
    try {
      const { data } = await api.post('/leads/inquire', {
        name: values.name,
        phone: values.phone,
        email: values.email || '',
        requirement: values.requirement,
        timeline: values.timeline
      });
      setSubmittedReference(data.data.trackingReference);
      setSubmitted(true);
      toast.success('Enquiry Submitted Successfully! Thank you. Our team will follow up shortly.');
    }
    catch (error) { setServerError(error); }
  }

  async function trackInquiry(event) {
    event.preventDefault();
    setTrackingLoading(true);
    setTrackingError('');
    setTrackingLead(null);
    try {
      const { data } = await api.get('/leads/track', { params: { reference: trackingReference.trim() } });
      setTrackingLead(data.data.lead);
    } catch (error) { setTrackingError(error.response?.data?.message || 'Inquiry status could not be loaded.'); }
    finally { setTrackingLoading(false); }
  }

  return <div className="landing">
    <header className="landing-nav"><Link className="brand landing-brand animate-brand-reveal" to="/"><span className="brand-mark"><Sparkles size={17} /></span><span>LeadPulse <span className="brand-light">AI</span></span></Link><nav><a href="#lead-form">Contact</a><a href="#track-inquiry">Track inquiry</a></nav></header>
    <main>
      <section className="landing-hero">
        <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-line" /> THE INQUIRY DESERVES A FOLLOW-UP</p><h1>Good leads.<br /><span>Handled well.</span></h1><p className="hero-intro">Tell us what you’re building. We’ll get your request to the right person and follow up with a clear next step.</p><a href="#lead-form" className="button button-primary hero-cta">Tell us about your project <ArrowRight size={16} /></a><div className="trust-line"><ShieldCheck size={16} /><span>Your details are only used to respond to your request.</span></div>
          <div className="hero-proof"><div className="proof-avatars"><span>J</span><span>M</span><span>A</span></div><span>Small teams, moving faster<br /><strong>Thoughtful follow-up starts here.</strong></span></div>
        </div>
        <div className="intake-panel" id="lead-form">
          <div className="form-panel-heading"><span className="panel-kicker">PROJECT INQUIRY <i /></span><span className="form-count">01 <span>/</span> 01</span></div>
          {submitted ? <div className="intake-success"><div className="intake-success-banner"><CircleCheck size={25} /><span><strong>Enquiry Submitted Successfully!</strong><small>Thank you. Our team will follow up shortly.</small></span></div><p className="eyebrow">REQUEST RECEIVED</p><h2>Thanks for reaching out.</h2><p>Your project is in the right place. Save this reference to check your inquiry status later.</p><div className="tracking-reference"><span>INQUIRY REFERENCE</span><code>{submittedReference}</code></div><button className="text-button" onClick={() => { setSubmitted(false); setSubmittedReference(''); }}>Send another request <ChevronRight size={15} /></button></div> : <form onSubmit={handleSubmit(submit)} className="intake-form">
            <div><label htmlFor="name">Your name <span>*</span></label><input id="name" autoComplete="name" placeholder="e.g. Jordan Lee" {...register('name')} />{errors.name && <small className="field-error">{errors.name.message}</small>}</div>
            <div className="form-two-col"><div><label htmlFor="phone">Phone <span>*</span></label><input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength="10" placeholder="10-digit phone number" {...register('phone')} />{errors.phone && <small className="field-error">{errors.phone.message}</small>}</div><div><label htmlFor="email">Email (optional)</label><input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />{errors.email && <small className="field-error">{errors.email.message}</small>}</div></div>
            <div><label htmlFor="requirement">Your requirement <span>*</span></label><textarea id="requirement" rows="3" placeholder="Describe your requirement, preference, budget, or preferred time..." {...register('requirement')} />{errors.requirement && <small className="field-error">{errors.requirement.message}</small>}</div>
            <div><label htmlFor="timeline">Timeline</label><select id="timeline" {...register('timeline')}><option>Immediate (Ready now)</option><option>Within 15 - 30 Days</option><option>Exploring / General Inquiry</option></select>{errors.timeline && <small className="field-error">{errors.timeline.message}</small>}</div>
            <ErrorMessage error={serverError} />
            <button className="button button-primary intake-submit" disabled={isSubmitting}>{isSubmitting ? <><span className="spinner spinner-light" /> Sending request</> : <>Send inquiry <ArrowRight size={16} /></>}</button>
            <p className="form-privacy"><Check size={13} /> No spam. Just a considered response.</p>
          </form>}
        </div>
      </section>
      <section className="signal-strip" id="how-it-works"><div><span>01</span><strong>Capture</strong><small>One clear place for every inquiry.</small></div><div><span>02</span><strong>Understand</strong><small>Context and intent stay attached.</small></div><div><span>03</span><strong>Follow through</strong><small>Every next step has an owner.</small></div><a href="#lead-form">Start a conversation <ArrowRight size={15} /></a></section>
      <section className="tracking-section" id="track-inquiry"><div className="tracking-copy"><p className="eyebrow"><span className="eyebrow-line" /> CUSTOMER PORTAL</p><h2>Track your inquiry.</h2><p>Enter the private reference provided after you submitted your request.</p></div><div className="tracking-content"><form className="tracking-form" onSubmit={trackInquiry}><label htmlFor="tracking-reference">Inquiry reference</label><div><input id="tracking-reference" autoComplete="off" value={trackingReference} onChange={(event) => { setTrackingReference(event.target.value); setTrackingLead(null); setTrackingError(''); }} required /><button className="button button-secondary" disabled={trackingLoading}>{trackingLoading ? 'Checking…' : 'Check status'} <ArrowRight size={14} /></button></div></form>{trackingError && <p className="tracking-error" role="alert">{trackingError}</p>}{trackingLead && <article className="tracking-result"><div><strong>{trackingLead.name}</strong><StatusBadge value={trackingLead.status} /></div><p>{trackingLead.requirement}</p><small>Updated {new Date(trackingLead.updatedAt).toLocaleString()}</small></article>}</div></section>
      <footer className="landing-footer"><Link className="brand landing-brand" to="/"><span className="brand-mark"><Sparkles size={16} /></span><span>LeadPulse <span className="brand-light">AI</span></span></Link><span>Considered work starts with a conversation.</span></footer>
    </main>
  </div>;
}