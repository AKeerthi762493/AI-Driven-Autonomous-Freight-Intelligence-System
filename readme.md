# 🚆 AI-Driven Autonomous Freight Intelligence System (AFIS)

An intelligent freight management platform designed to optimize railway logistics using data-driven decision-making, automation, and real-time insights.

---

## 📌 Project Overview

The **AI-Driven Autonomous Freight Intelligence System (AFIS)** improves railway freight operations by:

* Automating freight booking and tracking
* Optimizing wagon allocation
* Providing route optimization
* Simulating railway operations
* Integrating real-world APIs

---

## 🚀 Features

### 🏭 Industry Portal

* Freight booking system
* Shipment tracking
* Dashboard insights

### 🚉 Railway Operations Portal

* Approval workflow
* Wagon tracking
* Rake formation
* Route optimization
* Demand management
* Alerts & analytics
* AI-based recommendations

---

## 🛠️ Tech Stack

### Frontend

* React.js (Vite)
* TypeScript
* Tailwind CSS / ShadCN UI

### Backend

* Node.js
* Express.js
* TypeScript

### Database

* MongoDB (Mongoose)

### APIs Used

* RapidAPI (Railway Data)
* OpenRouteService (ORS)
* Data.gov.in

---

## ⚙️ Installation & Setup

### 📥 Clone Repository

```bash
git clone https://github.com/AKeerthi762493/AI-Driven-Autonomous-Freight-Intelligence-System.git
cd AI-Driven-Autonomous-Freight-Intelligence-System
```

---

## ▶️ Frontend Setup

```bash
cd afis-frontend
npm install --legacy-peer-deps
npm run dev
```

Frontend will run at:
👉 http://localhost:5173

---

## ▶️ Backend Setup

```bash
cd afis-backend

# Seed initial data
npx ts-node src/utils/seedData.ts

# Import real-world data
npx ts-node src/utils/importRealData.ts

# Start backend server
npm run dev
```

Backend will run at:
👉 http://localhost:5000

---

## 🔐 Environment Variables

Create a `.env` file inside the backend folder:

```env
RAPIDAPI_KEY=your_key
RAPIDAPI_HOST=your_host
ORS_API_KEY=your_key
DATA_GOV_KEY=your_key
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_secret
```

---

## 📊 System Workflow

1. Industry submits freight request
2. System stores request in database
3. Railway operator reviews request
4. Wagon tracking and allocation
5. Route optimization suggests best path
6. Alerts and analytics improve decision-making

---

## 🌍 Future Enhancements

* Real-time GPS-based wagon tracking
* Advanced AI/ML models
* Integration with official railway systems
* IoT-based monitoring

---

## 👨‍💻 Author

**Keerthi A**
B.E Computer Science Engineering

---

## 📖 License

This project is for academic and demonstration purposes.
