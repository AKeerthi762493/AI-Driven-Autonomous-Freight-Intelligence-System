import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';

// ── Inline minimal models ────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  name: String, email: String, password: String, role: String,
  company: String, phone: String, createdAt: { type: Date, default: Date.now },
});
const FreightSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  commodityType: String, sourceStation: String, destinationStation: String,
  quantity: Number, unit: String, status: String,
  operatorNotes: String, estimatedDelivery: Date,
  trackingEvents: [{ event: String, timestamp: Date, location: String }],
  createdAt: { type: Date, default: Date.now },
});
const WagonSchema = new mongoose.Schema({
  wagonNumber: String, wagonType: String, capacity: Number,
  status: String, currentLocation: String,
  nextMaintenanceDue: Date, lastMaintenanceDate: Date,
  createdAt: { type: Date, default: Date.now },
});
const AlertSchema = new mongoose.Schema({
  message: String, severity: String, category: String,
  isResolved: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
  relatedEntity: String,
});
const DemandSchema = new mongoose.Schema({
  station: String, commodity: String, month: String,
  actualDemand: Number, predictedDemand: Number,
  year: Number, monthIndex: Number,
  createdAt: { type: Date, default: Date.now },
});
const RakeSchema = new mongoose.Schema({
  rakeNumber: String, status: String, currentLocation: String,
  wagons: [mongoose.Schema.Types.ObjectId], totalCapacity: Number,
  driver: String, createdAt: { type: Date, default: Date.now },
});

const User    = mongoose.models.User    || mongoose.model('User',    UserSchema);
const Freight = mongoose.models.FreightRequest || mongoose.model('FreightRequest', FreightSchema);
const Wagon   = mongoose.models.Wagon   || mongoose.model('Wagon',   WagonSchema);
const Alert   = mongoose.models.Alert   || mongoose.model('Alert',   AlertSchema);
const Demand  = mongoose.models.Demand  || mongoose.model('Demand',  DemandSchema);
const Rake    = mongoose.models.Rake    || mongoose.model('Rake',    RakeSchema);

// ── Constants ────────────────────────────────────────────────────────────────
const STATIONS = [
  'Mumbai','Delhi','Chennai','Kolkata','Bengaluru','Hyderabad',
  'Ahmedabad','Pune','Jaipur','Surat','Nagpur','Lucknow',
  'Patna','Varanasi','Raipur','Bhopal','Vizag','Howrah',
  'Coimbatore','Mysuru','Bhubaneswar','Vijayawada',
];

const COMMODITIES = ['Coal','Steel','Cement','Fertilizer','Grains','Petroleum','Iron Ore','Containers','Limestone','Automobiles'];

const WAGON_TYPES = [
  { type:'BOXN',  capacity:58, desc:'Box wagon for general goods'      },
  { type:'BCNA',  capacity:60, desc:'Covered hopper for bulk material' },
  { type:'BFNSM', capacity:62, desc:'Flat wagon for heavy machinery'   },
  { type:'BTPN',  capacity:64, desc:'Tank wagon for petroleum'         },
  { type:'BOBR',  capacity:56, desc:'Open wagon for coal/ore'          },
];

const WAGON_STATUSES = ['available','available','available','assigned','in-transit','maintenance'];

// ── 11 Industry Companies ────────────────────────────────────────────────────
const COMPANIES = [
  { name:'Rajesh Kumar',      email:'rajesh@coalindia.com',    company:'Coal India Ltd',           role:'industry' },
  { name:'Priya Sharma',      email:'priya@sail.com',          company:'Steel Authority of India', role:'industry' },
  { name:'Amit Patel',        email:'amit@tatasteel.com',      company:'Tata Steel Ltd',           role:'industry' },
  { name:'Sunita Reddy',      email:'sunita@ongc.com',         company:'ONGC Petroleum',           role:'industry' },
  { name:'Vikram Singh',      email:'vikram@iffco.com',        company:'IFFCO Fertilizers',        role:'industry' },
  { name:'Meera Nair',        email:'meera@ultratech.com',     company:'UltraTech Cement',         role:'industry' },
  { name:'Arjun Gupta',       email:'arjun@hindalco.com',      company:'Hindalco Industries',      role:'industry' },
  { name:'Deepa Krishnan',    email:'deepa@iocl.com',          company:'Indian Oil Corporation',   role:'industry' },
  { name:'Rohit Verma',       email:'rohit@jsw.com',           company:'JSW Steel',                role:'industry' },
  { name:'Kavita Joshi',      email:'kavita@ambuja.com',       company:'Ambuja Cements',           role:'industry' },
  { name:'Suresh Rao',        email:'suresh@fci.com',          company:'Food Corporation of India',role:'industry' },
];

// ── Commodity per company mapping ────────────────────────────────────────────
const COMPANY_COMMODITY: Record<string, string[]> = {
  'Coal India Ltd':            ['Coal'],
  'Steel Authority of India':  ['Steel','Iron Ore'],
  'Tata Steel Ltd':            ['Steel','Iron Ore','Limestone'],
  'ONGC Petroleum':            ['Petroleum'],
  'IFFCO Fertilizers':         ['Fertilizer'],
  'UltraTech Cement':          ['Cement','Limestone'],
  'Hindalco Industries':       ['Containers','Iron Ore'],
  'Indian Oil Corporation':    ['Petroleum','Containers'],
  'JSW Steel':                 ['Steel','Iron Ore'],
  'Ambuja Cements':            ['Cement'],
  'Food Corporation of India': ['Grains'],
};

const rand = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);
const daysAhead = (d: number) => new Date(Date.now() + d * 24 * 60 * 60 * 1000);

// ── Main seed function ────────────────────────────────────────────────────────
async function seed() {
  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/afis_db';
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Freight.deleteMany({}),
    Wagon.deleteMany({}),
    Alert.deleteMany({}),
    Demand.deleteMany({}),
    Rake.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing data');

  // ── 1. USERS ────────────────────────────────────────────────────────────────
  const password = await bcrypt.hash('password123', 10);
  const opPassword = await bcrypt.hash('operator123', 10);

  const userDocs = await User.insertMany([
    // Operator
    { name:'Operations Manager', email:'operator@afis.com',  password: opPassword, role:'operator', company:'Indian Railways' },
    { name:'Senior Planner',     email:'planner@afis.com',   password: opPassword, role:'operator', company:'Indian Railways' },
    // Industry users
    ...COMPANIES.map(c => ({
      name: c.name, email: c.email, password,
      role: c.role, company: c.company,
    })),
    // Default demo user
    { name:'Industry Demo', email:'industry@afis.com', password: await bcrypt.hash('industry123', 10), role:'industry', company:'Demo Corp' },
  ]);
  console.log(`👥 Created ${userDocs.length} users`);

  const industryUsers = userDocs.filter((u: any) => u.role === 'industry');

  // ── 2. WAGONS (300) ─────────────────────────────────────────────────────────
  const wagons = [];
  for (let i = 1; i <= 300; i++) {
    const wType = rand(WAGON_TYPES);
    const status = rand(WAGON_STATUSES);
    const location = rand(STATIONS);
    wagons.push({
      wagonNumber:       `WGN-${String(i).padStart(4,'0')}`,
      wagonType:         wType.type,
      capacity:          wType.capacity + randInt(-2, 2),
      status,
      currentLocation:   status === 'in-transit' ? `En route ${location}` : location,
      nextMaintenanceDue: daysAhead(randInt(5, 90)),
      lastMaintenanceDate: daysAgo(randInt(30, 180)),
    });
  }
  const wagonDocs = await Wagon.insertMany(wagons);
  console.log(`🚃 Created ${wagonDocs.length} wagons`);

  // ── 3. FREIGHT REQUESTS (80) ─────────────────────────────────────────────────
  const statuses = ['pending','pending','approved','approved','in-transit','in-transit','delivered','rejected'];
  const freights = [];

  for (let i = 0; i < 80; i++) {
    const user = rand(industryUsers) as any;
    const commodities = COMPANY_COMMODITY[user.company] || COMMODITIES;
    const commodity = rand(commodities);
    const source = rand(STATIONS);
    const dest = rand(STATIONS.filter(s => s !== source));
    const status = rand(statuses);
    const createdDaysAgo = randInt(1, 60);
    const qty = commodity === 'Coal' ? randInt(1000, 50000)
              : commodity === 'Steel' ? randInt(500, 10000)
              : commodity === 'Petroleum' ? randInt(200, 5000)
              : randInt(100, 8000);

    // Build tracking timeline
    const events: any[] = [];
    const baseDate = daysAgo(createdDaysAgo);
    events.push({ event: 'Booking submitted', timestamp: baseDate, location: source });

    if (['approved','in-transit','delivered'].includes(status)) {
      events.push({
        event: 'Approved by operator',
        timestamp: new Date(baseDate.getTime() + 2*60*60*1000),
        location: source,
      });
    }
    if (['in-transit','delivered'].includes(status)) {
      events.push({
        event: `Departed from ${source}`,
        timestamp: new Date(baseDate.getTime() + 6*60*60*1000),
        location: source,
      });
      events.push({
        event: `In transit via ${rand(STATIONS.filter(s=>s!==source&&s!==dest))}`,
        timestamp: new Date(baseDate.getTime() + 15*60*60*1000),
        location: rand(STATIONS),
      });
    }
    if (status === 'delivered') {
      events.push({
        event: `Arrived at ${dest}`,
        timestamp: new Date(baseDate.getTime() + 28*60*60*1000),
        location: dest,
      });
    }
    if (status === 'rejected') {
      events.push({
        event: 'Rejected — insufficient wagon availability',
        timestamp: new Date(baseDate.getTime() + 3*60*60*1000),
        location: source,
      });
    }

    freights.push({
      userId: user._id,
      commodityType: commodity,
      sourceStation: source,
      destinationStation: dest,
      quantity: qty,
      unit: 'tonnes',
      status,
      operatorNotes: status === 'approved' ? 'Approved — capacity available'
                   : status === 'rejected' ? 'Insufficient wagon availability this week'
                   : '',
      estimatedDelivery: ['approved','in-transit'].includes(status)
        ? daysAhead(randInt(1, 7)) : undefined,
      trackingEvents: events,
      createdAt: baseDate,
    });
  }
  await Freight.insertMany(freights);
  console.log(`📦 Created 80 freight requests`);

  // ── 4. DEMAND RECORDS (2000) ──────────────────────────────────────────────
  const demandRecords = [];
  const demandCommodities = ['Coal','Steel','Petroleum','Fertilizer','Cement','Grains'];

  // Base demand values per station (realistic Indian Railways volumes)
  const stationBase: Record<string, number> = {
    Mumbai: 5200, Delhi: 4800, Kolkata: 4200, Chennai: 3900,
    Bengaluru: 3500, Hyderabad: 3200, Ahmedabad: 3000, Pune: 2800,
    Nagpur: 2600, Raipur: 2400, Vizag: 2200, Howrah: 2000,
    Jaipur: 1800, Surat: 1600, Lucknow: 1500, Patna: 1400,
    Varanasi: 1300, Bhopal: 1200, Bhubaneswar: 1100, Vijayawada: 1000,
    Coimbatore: 900, Mysuru: 800,
  };

  for (const station of STATIONS) {
    for (const commodity of demandCommodities) {
      const base = (stationBase[station] || 1000) *
        (commodity === 'Coal' ? 1.0
       : commodity === 'Steel' ? 0.7
       : commodity === 'Petroleum' ? 0.5
       : commodity === 'Fertilizer' ? 0.4
       : commodity === 'Cement' ? 0.6
       : 0.3);

      // 15 months of historical data
      for (let m = 0; m < 15; m++) {
        const date = new Date();
        date.setMonth(date.getMonth() - (14 - m));
        const seasonal = 1 + 0.15 * Math.sin((m / 12) * 2 * Math.PI);
        const trend    = 1 + (m / 14) * 0.12;
        const noise    = 0.9 + Math.random() * 0.2;
        const actual   = Math.round(base * seasonal * trend * noise);
        const predicted = Math.round(actual * (0.95 + Math.random() * 0.1));

        demandRecords.push({
          station, commodity,
          month:     date.toLocaleString('default', { month:'long', year:'numeric' }),
          monthIndex: m,
          year:      date.getFullYear(),
          actualDemand:    actual,
          predictedDemand: predicted,
          createdAt: date,
        });
      }
    }
  }
  await Demand.insertMany(demandRecords);
  console.log(`📊 Created ${demandRecords.length} demand records`);

  // ── 5. ALERTS (10 realistic) ──────────────────────────────────────────────
  await Alert.insertMany([
    {
      message:  'Train #12952 Mumbai Rajdhani delayed by 3h at Vadodara Junction due to signal failure',
      severity: 'critical', category: 'delay',
      timestamp: daysAgo(0),
    },
    {
      message:  'High congestion detected at Nagpur Junction — 14 freight trains queued',
      severity: 'critical', category: 'congestion',
      timestamp: new Date(Date.now() - 28*60*1000),
    },
    {
      message:  'Track maintenance scheduled: Delhi-Jaipur corridor, 03:00-06:00 IST tomorrow',
      severity: 'warning', category: 'maintenance',
      timestamp: new Date(Date.now() - 60*60*1000),
    },
    {
      message:  'Weather alert: Heavy rainfall expected in Mumbai region — possible delays on Western Railway',
      severity: 'warning', category: 'delay',
      timestamp: new Date(Date.now() - 2*60*60*1000),
    },
    {
      message:  'Port congestion at Vizag — container unloading delayed by 2h due to crane malfunction',
      severity: 'warning', category: 'congestion',
      timestamp: new Date(Date.now() - 3*60*60*1000),
    },
    {
      message:  'Wagon WGN-0042 overdue for maintenance — last serviced 187 days ago at Nagpur yard',
      severity: 'warning', category: 'maintenance',
      timestamp: new Date(Date.now() - 4*60*60*1000),
    },
    {
      message:  'Demand surge detected at Raipur — Coal bookings up 340% this week vs last month',
      severity: 'info', category: 'demand',
      timestamp: new Date(Date.now() - 5*60*60*1000),
    },
    {
      message:  'Route delay: Kolkata → Chennai via Visakhapatnam. Delay: 45 minutes due to track work',
      severity: 'warning', category: 'route',
      timestamp: new Date(Date.now() - 6*60*60*1000),
    },
    {
      message:  'Low wagon availability at Mumbai Central — only 12 BOXN wagons remaining for allocation',
      severity: 'warning', category: 'wagon',
      timestamp: new Date(Date.now() - 8*60*60*1000),
    },
    {
      message:  'System: Automated rake formation completed — 3 rakes formed for Delhi corridor',
      severity: 'info', category: 'system',
      timestamp: new Date(Date.now() - 12*60*60*1000),
    },
  ]);
  console.log('🚨 Created 10 realistic alerts');

  // ── 6. RAKES (5) ────────────────────────────────────────────────────────────
  const availableWagons = wagonDocs.filter((w: any) => w.status === 'available').slice(0, 40);
  const rakeData = [
    { rakeNumber:'RAKE-A1', location:'Mumbai', driver:'Ramesh Kumar',  count:8  },
    { rakeNumber:'RAKE-B2', location:'Delhi',  driver:'Sunil Sharma',  count:8  },
    { rakeNumber:'RAKE-C3', location:'Nagpur', driver:'Vijay Singh',   count:8  },
    { rakeNumber:'RAKE-D4', location:'Chennai',driver:'Arun Nair',     count:8  },
    { rakeNumber:'RAKE-E5', location:'Howrah', driver:'Mohan Das',     count:8  },
  ];

  for (let i = 0; i < rakeData.length; i++) {
    const r = rakeData[i];
    const assignedWagons = availableWagons.slice(i*r.count, (i+1)*r.count);
    const wagonIds = assignedWagons.map((w: any) => w._id);
    const totalCap = assignedWagons.reduce((s: number, w: any) => s + w.capacity, 0);
    await Rake.create({
      rakeNumber: r.rakeNumber, currentLocation: r.location,
      driver: r.driver, wagons: wagonIds, totalCapacity: totalCap,
      status: i < 2 ? 'active' : 'idle',
    });
  }
  console.log('🚂 Created 5 rakes');

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete! Summary:');
  console.log(`   👥 Users:           ${userDocs.length} (2 operators + 11 industry + 1 demo)`);
  console.log(`   🚃 Wagons:          300 (BOXN, BCNA, BFNSM, BTPN, BOBR)`);
  console.log(`   📦 Freight:         80 requests with tracking timelines`);
  console.log(`   📊 Demand records:  ${demandRecords.length} (15 months history)`);
  console.log(`   🚨 Alerts:          10 realistic Indian Railways alerts`);
  console.log(`   🚂 Rakes:           5 formed rakes`);
  console.log('\n🔑 Login credentials:');
  console.log('   Operator:  operator@afis.com  / operator123');
  console.log('   Industry:  industry@afis.com  / industry123');
  console.log('   Coal India: rajesh@coalindia.com / password123');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});