import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Lead from '../src/models/Lead.js';
import User from '../src/models/User.js';

const green = '\u001b[32m';
const red = '\u001b[31m';
const reset = '\u001b[0m';

const demoLeads = [
  { name: 'Aarav Mehta', phone: '9000000001', email: 'aarav.mehta@example.com', requirement: 'Looking for a 3 BHK apartment near Whitefield, Bengaluru, with a budget of ₹1.2 crore. Ready to visit this weekend.', timeline: 'Immediate (Ready now)', aiScore: 92, priority: 'HOT', detectedBudget: '₹1.2 crore', aiSummary: 'Ready-to-visit buyer with a clear location, configuration, and stated budget.', suggestedWhatsAppMessage: 'Hello Aarav, thank you for your interest in a 3 BHK near Whitefield. We would be happy to share matching options and arrange a visit this weekend. What time works best for you?' },
  { name: 'Priya Nair', phone: '9000000002', email: 'priya.nair@example.com', requirement: 'Need a dermatologist appointment for recurring skin irritation. Please share clinic timings and consultation availability.', timeline: 'Within 15 - 30 Days', aiScore: 74, priority: 'WARM', detectedBudget: 'Not Specified', aiSummary: 'Healthcare inquiry seeking an appointment and clinic availability; requires a professional response.', suggestedWhatsAppMessage: 'Hello Priya, thank you for contacting us. We can help check the dermatologist appointment availability and clinic timings. Which days are convenient for you?' },
  { name: 'Kabir Shah', phone: '9000000003', email: 'kabir.shah@example.com', requirement: 'We need a new website and lead generation campaign for our consulting firm. Budget around ₹2 Lakhs, hoping to start this month.', timeline: 'Immediate (Ready now)', aiScore: 88, priority: 'HOT', detectedBudget: '₹2 Lakhs', aiSummary: 'Clear digital services scope, budget, and near-term start date indicate strong intent.', suggestedWhatsAppMessage: 'Hi Kabir, thanks for sharing your plans for a new website and lead generation. We would be glad to understand the scope and suggest next steps. When would be a good time to speak?' },
  { name: 'Ananya Iyer', phone: '9000000004', email: 'ananya.iyer@example.com', requirement: 'Exploring a 2 BHK home in Pune for future use. No fixed budget yet; would like to understand the market first.', timeline: 'Exploring / General Inquiry', aiScore: 39, priority: 'COLD', detectedBudget: 'Not Specified', aiSummary: 'Early-stage property research without a set budget or immediate purchase timeframe.', suggestedWhatsAppMessage: 'Hello Ananya, thank you for your interest in Pune homes. We can share a few market insights and options to help with your research. Is there a preferred neighborhood?' },
  { name: 'Rohan Verma', phone: '9000000005', email: 'rohan.verma@example.com', requirement: 'Our family clinic wants an online appointment booking page and a patient-friendly website. Please share how onboarding works.', timeline: 'Within 15 - 30 Days', aiScore: 69, priority: 'WARM', detectedBudget: 'Not Specified', aiSummary: 'Clinic has a defined digital need and wants to understand onboarding; budget and final timing are open.', suggestedWhatsAppMessage: 'Hello Rohan, thanks for reaching out about your clinic website and appointment booking page. We can walk you through the onboarding and requirements. When would you be available for a short call?' },
  { name: 'Sana Khan', phone: '9000000006', email: 'sana.khan@example.com', requirement: 'Need a 2 BHK rental apartment in Hyderabad near Hitech City, preferably furnished. Move-in in about three weeks.', timeline: 'Within 15 - 30 Days', aiScore: 81, priority: 'HOT', detectedBudget: 'Not Specified', aiSummary: 'Specific rental location, configuration, furnishing preference, and move-in window.', suggestedWhatsAppMessage: 'Hello Sana, thank you for sharing your apartment requirements near Hitech City. We can shortlist furnished 2 BHK rentals for your move-in window. What monthly rent range should we consider?' },
  { name: 'Dev Patel', phone: '9000000007', email: 'dev.patel@example.com', requirement: 'Interested in social media management for a small retail brand, but just comparing agencies at the moment.', timeline: 'Exploring / General Inquiry', aiScore: 43, priority: 'COLD', detectedBudget: 'Not Specified', aiSummary: 'Early comparison-stage digital marketing inquiry with a broad scope and no immediate commitment.', suggestedWhatsAppMessage: 'Hi Dev, thank you for considering us for your social media management. We would be happy to learn about your retail brand and share how our service works. Which channels matter most to you?' },
  { name: 'Meera Joshi', phone: '9000000008', email: 'meera.joshi@example.com', requirement: 'I need an appointment with a physiotherapist for a shoulder injury. Please let me know the earliest available slot.', timeline: 'Immediate (Ready now)', aiScore: 85, priority: 'HOT', detectedBudget: 'Not Specified', aiSummary: 'Time-sensitive appointment request; route to clinic staff for availability without offering medical advice.', suggestedWhatsAppMessage: 'Hello Meera, thank you for contacting us. We can check the earliest physiotherapy appointment availability for you. What time of day is easiest for you to visit?' },
  { name: 'Ishaan Rao', phone: '9000000009', email: 'ishaan.rao@example.com', requirement: 'Searching for a small office space around 800 sq ft in Andheri East. Budget is approximately ₹80,000 monthly rent.', timeline: 'Within 15 - 30 Days', aiScore: 77, priority: 'HOT', detectedBudget: '₹80,000 monthly rent', aiSummary: 'Commercial tenant with specific size, location, budget, and a near-term search.', suggestedWhatsAppMessage: 'Hello Ishaan, thanks for sharing your office space requirements in Andheri East. We can look for options around 800 sq ft within your monthly rent range. When can we discuss suitable properties?' },
  { name: 'Tara Das', phone: '9000000010', email: 'tara.das@example.com', requirement: 'Would like a quotation for a basic ecommerce website for handmade products. We are planning for later this year.', timeline: 'Exploring / General Inquiry', aiScore: 53, priority: 'WARM', detectedBudget: 'Not Specified', aiSummary: 'A defined ecommerce project is planned for later in the year; budget and detailed scope remain open.', suggestedWhatsAppMessage: 'Hello Tara, thank you for your interest in an ecommerce website for your handmade products. We would be happy to discuss the project and prepare a suitable estimate. Do you have a preferred launch month?' }
];

async function seed() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required to run the seeder.');
  await mongoose.connect(process.env.MONGO_URI);
  let admin = await User.findOne({ email: 'admin@demo.com' });
  if (!admin) {
    admin = await User.create({
      name: 'LeadPulse Demo Admin',
      email: 'admin@demo.com',
      passwordHash: await bcrypt.hash('password123', 12),
      role: 'admin'
    });
  }

  for (const lead of demoLeads) {
    await Lead.findOneAndUpdate(
      { source: 'Demo Seed', email: lead.email },
      { $set: { ...lead, source: 'Demo Seed', ownerId: admin._id, assignedTo: null, createdBy: admin._id } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }
  console.log(`${green}[seed] Demo admin is ready: admin@demo.com / password123${reset}`);
  console.log(`${green}[seed] ${demoLeads.length} realistic demo leads are ready.${reset}`);
}

try {
  await seed();
} catch (error) {
  console.error(`${red}[seed:error] ${error instanceof Error ? error.message : String(error)}${reset}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
