# Smart-Q: Virtual Queue Management System

An intelligent queue management system developed using Flask, designed to reduce waiting times and enhance customer experience. The system supports real-time monitoring, crowd detection, and offers a smooth way for businesses to manage queues efficiently.

## 🚀 Key Features

• 📌 Real-time queue tracking with live updates
• 🏦 Multi-counter/cashier support for parallel servicing
• 📊 Admin dashboard for complete queue oversight
• 👥 Crowd detection powered by YOLOv8 + OpenCV
• 📈 Queue analytics & statistics for better decision-making
• 📷 QR code integration for easy queue joining
• ⚡ Socket.IO support for instant communication
• ⏳ Delay handling & customer removal options

## 🛠️ Tech Stack & Requirements

• Python 3.8+
• Flask
• SQLAlchemy
• Flask-SocketIO
• OpenCV
• YOLO (YOLOv8)

## ⚙️ Installation
1. Clone the repository:  
   `git clone [repo-url]`  
2. Install dependencies:  
   `pip install -r requirements.txt`  
3. Run the application:  
   `python app.py`

## Environment Variables

Create a `.env` file with the following variables:
```
DATABASE_URL=sqlite:///queue_system.db
SECRET_KEY=your-secret-key
PORT=8080
```

## 📖 Usage

• 🔑 Access the Admin Panel at /admin
• 🏢 Add a company & configure counters
• 📱 Customers can join via QR code or company code
• 👨‍💻 Monitor/manage queues through the dashboard

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details. 
