# Virtual Queue System

A modern queue management system built with Flask that includes real-time monitoring and crowd detection capabilities.

## Features

- Real-time queue management
- Multiple cashier support
- Admin dashboard
- Live crowd monitoring with YOLO object detection
- Queue analytics and statistics
- QR code generation for queue joining
- Socket.IO for real-time updates
- Delay and removal management for queued customers

## Requirements

- Python 3.8+
- Flask
- SQLAlchemy
- SocketIO
- OpenCV
- YOLO (YOLOv8)
- Other dependencies listed in requirements.txt

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd virtual_queue_system
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. Initialize the database:
```bash
flask db upgrade
```

6. Run the application:
```bash
python app.py
```

## Environment Variables

Create a `.env` file with the following variables:
```
DATABASE_URL=sqlite:///queue_system.db
SECRET_KEY=your-secret-key
PORT=8080
```

## Usage

1. Access the admin panel at `/admin`
2. Create a company and configure cashiers
3. Use the generated QR code or company code for customers to join the queue
4. Monitor and manage queues through the admin dashboard

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 